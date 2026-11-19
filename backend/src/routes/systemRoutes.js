const express = require('express');
const { ensureSeedState } = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');
const { sanitizePublicState, sanitizeStateForRole } = require('../utils/sanitize');
const { withStateLock } = require('../utils/mutex');

const MAX_WEEKLY_QUOTA = 12;
const MAX_GROUP_QUOTA = 8;
const MAX_NOTIFS_PER_USER_DB = 15;

function isSafeImageUrl(url) {
  if (!url) return true;
  if (typeof url !== 'string' || url.length > 350000) return false;
  return /^https:\/\/.+/i.test(url) || /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(url);
}

function isActiveAccount(state, role, userId) {
  if (role === 'admin') return true;
  if (role === 'teacher') return (state.staff || []).some((t) => t.id === userId);
  if (role === 'student') return (state.students || []).some((s) => s.id === userId);
  return false;
}

function sanitizeIncomingExams(list) {
  return list
    .filter((ex) => ex && typeof ex === 'object' && ex.id && ex.studentId && typeof ex.examName === 'string')
    .map((ex) => ({
      ...ex,
      examName: String(ex.examName).trim().slice(0, 80),
      examType: ex.examType === 'AYT' ? 'AYT' : 'TYT',
      totalNet: Number.isFinite(Number(ex.totalNet)) ? Number(Number(ex.totalNet).toFixed(2)) : 0,
      sections: ex.sections && typeof ex.sections === 'object' ? ex.sections : {}
    }));
}

function pruneNotifications(list) {
  const counts = {};
  return (list || []).filter((n) => {
    const uid = n.targetUserId || 'global';
    counts[uid] = (counts[uid] || 0) + 1;
    return counts[uid] <= MAX_NOTIFS_PER_USER_DB;
  });
}

function mergeTeacherAppointments(dbAppointments, incomingAppointments, teacherId) {
  const updated = dbAppointments.map((slot) => ({
    ...slot,
    maxQuota: MAX_GROUP_QUOTA,
    participants: [...(slot.participants || [])]
  }));

  const slotKey = (s) => String(s.teacherId) + '__' + String(s.day) + '__' + String(Number(s.hourSlot));

  for (const incSlot of incomingAppointments) {
    if (incSlot.teacherId !== teacherId || incSlot.archivedFromDesk) continue;
    const proactiveParts = (incSlot.participants || []).filter((p) => p.status === 'Proactive');
    if (proactiveParts.length === 0) continue;

    for (const pPart of proactiveParts) {
      const studentId = pPart.studentId;

      const studentWeeklyCount = updated.filter((s) =>
        (s.participants || []).some((p) => p.studentId === studentId && p.status !== 'Rejected')
      ).length;
      if (studentWeeklyCount >= MAX_WEEKLY_QUOTA) continue;

      const hasTimeConflict = updated.some(
        (dbS) =>
          !dbS.archivedFromDesk &&
          dbS.day === incSlot.day &&
          Number(dbS.hourSlot) === Number(incSlot.hourSlot) &&
          dbS.teacherId !== teacherId &&
          (dbS.participants || []).some((p) => p.studentId === studentId && p.status !== 'Rejected')
      );
      if (hasTimeConflict) continue;

      const existingDbSlot = updated.find(
        (dbS) => !dbS.archivedFromDesk && slotKey(dbS) === slotKey(incSlot)
      );

      if (existingDbSlot) {
        const alreadyIn = existingDbSlot.participants.some(
          (p) => p.studentId === studentId && p.status !== 'Rejected'
        );
        const activeCount = existingDbSlot.participants.filter((p) => p.status !== 'Rejected').length;
        if (!alreadyIn && activeCount < MAX_GROUP_QUOTA) {
          existingDbSlot.participants = existingDbSlot.participants.filter((p) => p.studentId !== studentId);
          existingDbSlot.participants.push(pPart);
        }
      } else {
        updated.push({
          ...incSlot,
          maxQuota: MAX_GROUP_QUOTA,
          participants: [pPart]
        });
      }
    }
  }

  return updated;
}

function mergeStudentAppointments(dbAppointments, incomingAppointments, studentId) {
  const updated = dbAppointments.map((slot) => ({
    ...slot,
    maxQuota: MAX_GROUP_QUOTA,
    participants: [...(slot.participants || [])]
  }));

  const slotKey = (s) => String(s.teacherId) + '__' + String(s.day) + '__' + String(Number(s.hourSlot));

  for (const dbSlot of updated) {
    if (dbSlot.archivedFromDesk) continue;
    const hasStudentInDb = dbSlot.participants.some((p) => p.studentId === studentId && p.status !== 'Rejected');
    if (!hasStudentInDb) continue;

    const matchingInc = incomingAppointments.find(
      (inc) => !inc.archivedFromDesk && slotKey(inc) === slotKey(dbSlot)
    );
    const stillHasStudent = matchingInc?.participants?.some((p) => p.studentId === studentId && p.status !== 'Rejected');

    if (!stillHasStudent) {
      dbSlot.participants = dbSlot.participants.filter((p) => p.studentId !== studentId);
    }
  }

  let currentUsedQuota = updated.filter((s) =>
    (s.participants || []).some((p) => p.studentId === studentId && p.status !== 'Rejected')
  ).length;

  for (const incSlot of incomingAppointments) {
    if (incSlot.archivedFromDesk) continue;
    const myIncPart = (incSlot.participants || []).find((p) => p.studentId === studentId && p.status !== 'Rejected');
    if (!myIncPart) continue;

    const hasTimeConflict = updated.some(
      (dbS) =>
        !dbS.archivedFromDesk &&
        dbS.day === incSlot.day &&
        Number(dbS.hourSlot) === Number(incSlot.hourSlot) &&
        dbS.teacherId !== incSlot.teacherId &&
        (dbS.participants || []).some((p) => p.studentId === studentId && p.status !== 'Rejected')
    );
    if (hasTimeConflict) continue;

    const existingDbSlot = updated.find(
      (dbS) => !dbS.archivedFromDesk && slotKey(dbS) === slotKey(incSlot)
    );

    if (existingDbSlot) {
      const alreadyInSlot = existingDbSlot.participants.some((p) => p.studentId === studentId && p.status !== 'Rejected');
      if (!alreadyInSlot && currentUsedQuota < MAX_WEEKLY_QUOTA) {
        const activeCount = existingDbSlot.participants.filter((p) => p.status !== 'Rejected').length;
        if (activeCount < MAX_GROUP_QUOTA) {
          const lockedType = existingDbSlot.sessionType || myIncPart.sessionType;
          const lockedTopic =
            existingDbSlot.sessionTopic ||
            myIncPart.sessionTopic ||
            (lockedType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');

          existingDbSlot.participants = existingDbSlot.participants.filter((p) => p.studentId !== studentId);
          existingDbSlot.participants.push({
            ...myIncPart,
            sessionType: lockedType,
            sessionTopic: lockedTopic
          });
          currentUsedQuota += 1;
        }
      }
    } else if (currentUsedQuota < MAX_WEEKLY_QUOTA) {
      const fallbackTopic =
        incSlot.sessionTopic ||
        myIncPart.sessionTopic ||
        (incSlot.sessionType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');
      updated.push({
        ...incSlot,
        maxQuota: MAX_GROUP_QUOTA,
        sessionTopic: fallbackTopic,
        participants: [{ ...myIncPart, sessionTopic: fallbackTopic }]
      });
      currentUsedQuota += 1;
    }
  }

  return updated.filter((slot) =>
    slot.archivedFromDesk
      ? (slot.participants || []).length > 0
      : (slot.participants || []).some((p) => p.status !== 'Rejected')
  );
}

module.exports = function (io) {
  const router = express.Router();

  router.get('/public', async (req, res) => {
    try {
      const state = await ensureSeedState();
      res.json(sanitizePublicState(state));
    } catch (err) {
      res.status(500).json({ error: 'Vitrin verisi okunamadı.' });
    }
  });

  router.get('/state', verifyToken, async (req, res) => {
    try {
      const state = await ensureSeedState();
      if (!isActiveAccount(state, req.user.role, req.user.id)) {
        return res.status(401).json({ error: 'Hesabınız sistemde artık aktif değil.' });
      }
      res.json(sanitizeStateForRole(state, req.user.role, req.user.id));
    } catch (err) {
      res.status(500).json({ error: 'Veritabanı okunamadı.' });
    }
  });

  router.post('/sync', verifyToken, async (req, res) => {
    try {
      let accountRevoked = false;

      await withStateLock(async () => {
        const {
          staff,
          students,
          appointments,
          assignments,
          exams,
          notifications,
          maintenanceMeta,
          senderSocketId
        } = req.body || {};

        const state = await ensureSeedState();
        const userRole = req.user.role;
        const userId = req.user.id;

        if (!isActiveAccount(state, userRole, userId)) {
          accountRevoked = true;
          return;
        }

        if (userRole === 'admin') {
          if (Array.isArray(staff)) {
            const existingStaffMap = new Map((state.staff || []).map((t) => [t.id, t]));
            state.staff = staff.map((t) => {
              const prev = existingStaffMap.get(t.id);
              return {
                ...t,
                tcNo: t.tcNo || prev?.tcNo || '',
                securityKey: t.securityKey || prev?.securityKey || '',
                photoUrl: isSafeImageUrl(t.photoUrl) ? t.photoUrl : (prev?.photoUrl || '')
              };
            });
          }
          if (Array.isArray(students)) {
            const existingStudentMap = new Map((state.students || []).map((s) => [s.id, s]));
            state.students = students.map((s) => {
              const prev = existingStudentMap.get(s.id);
              return {
                ...s,
                tcNo: s.tcNo || prev?.tcNo || '',
                pin: s.pin || prev?.pin || ''
              };
            });
          }
          if (Array.isArray(appointments)) state.appointments = appointments;
          if (Array.isArray(assignments)) state.assignments = assignments;
          if (Array.isArray(exams)) state.exams = sanitizeIncomingExams(exams);
          if (Array.isArray(notifications)) state.notifications = pruneNotifications(notifications);
          if (maintenanceMeta) state.maintenanceMeta = { ...state.maintenanceMeta, ...maintenanceMeta };
        } else if (userRole === 'teacher') {
          if (Array.isArray(appointments)) {
            state.appointments = mergeTeacherAppointments(state.appointments || [], appointments, userId);
          }
          if (Array.isArray(assignments)) {
            const otherTeachersAssignments = (state.assignments || []).filter((a) => a.teacherId !== userId);
            const myTeacherAssignments = assignments.filter((a) => a.teacherId === userId);
            state.assignments = [...myTeacherAssignments, ...otherTeachersAssignments];
          }
          if (Array.isArray(notifications)) {
            const existingNotifIds = new Set((state.notifications || []).map((n) => n.id));
            const newNotifs = notifications.filter((n) => !existingNotifIds.has(n.id));
            state.notifications = pruneNotifications([...newNotifs, ...(state.notifications || [])]);
          }
        } else if (userRole === 'student') {
          if (Array.isArray(appointments)) {
            state.appointments = mergeStudentAppointments(state.appointments || [], appointments, userId);
          }
          if (Array.isArray(assignments)) {
            const studentUpdates = new Map(assignments.map((a) => [a.id, a]));
            state.assignments = (state.assignments || []).map((orig) => {
              if (orig.studentId === userId && studentUpdates.has(orig.id)) {
                const upd = studentUpdates.get(orig.id);
                return { ...orig, isCompleted: Boolean(upd.isCompleted), completedAt: upd.completedAt };
              }
              return orig;
            });
          }
          if (Array.isArray(notifications)) {
            const otherUsersNotifs = (state.notifications || []).filter((n) => n.targetUserId !== userId);
            const myCurrentNotifs = notifications.filter((n) => n.targetUserId === userId);
            state.notifications = pruneNotifications([...myCurrentNotifs, ...otherUsersNotifs]);
          }
        }

        state.markModified('staff');
        state.markModified('students');
        state.markModified('appointments');
        state.markModified('assignments');
        state.markModified('exams');
        state.markModified('notifications');
        state.markModified('maintenanceMeta');
        await state.save();

        io.emit('system:refresh_required', {
          senderSocketId: senderSocketId || null
        });
      });

      if (accountRevoked) {
        return res.status(401).json({ error: 'Hesabınız sistemde artık aktif değil.' });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Sync Hatası:', err);
      res.status(500).json({ error: 'Veritabanı kaydı başarısız.' });
    }
  });

  return router;
};