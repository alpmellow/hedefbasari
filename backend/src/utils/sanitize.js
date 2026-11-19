function sanitizePublicState(stateDoc) {
  const obj = stateDoc.toObject ? stateDoc.toObject() : { ...stateDoc };
  return {
    staff: (obj.staff || []).map((t) => ({
      id: t.id,
      fullName: t.fullName,
      branch: t.branch,
      photoUrl: t.photoUrl,
      biography: t.biography,
      weeklySchedule: t.weeklySchedule || []
    })),
    stats: {
      studentCount: (obj.students || []).length,
      staffCount: (obj.staff || []).length,
      appointmentCount: (obj.appointments || []).length
    }
  };
}

function sanitizeStateForRole(stateDoc, role = 'student', userId = null) {
  const obj = stateDoc.toObject ? stateDoc.toObject() : { ...stateDoc };

  const cleanAdminAuth = {
    username: obj.adminAuth?.username || 'hedef_admin',
    photoUrl: obj.adminAuth?.photoUrl || ''
  };

  if (role === 'admin') {
    return {
      staff: obj.staff || [],
      students: obj.students || [],
      appointments: obj.appointments || [],
      assignments: obj.assignments || [],
      exams: obj.exams || [],
      notifications: obj.notifications || [],
      adminAuth: cleanAdminAuth,
      maintenanceMeta: obj.maintenanceMeta || {}
    };
  }

  if (role === 'teacher') {
    return {
      staff: (obj.staff || []).map((t) =>
        t.id === userId ? t : { ...t, tcNo: undefined, securityKey: undefined }
      ),
      students: (obj.students || []).map((s) => ({
        id: s.id,
        fullName: s.fullName,
        className: s.className,
        paymentStatus: s.paymentStatus
      })),
      appointments: obj.appointments || [],
      assignments: obj.assignments || [],
      exams: obj.exams || [],
      notifications: obj.notifications || [],
      adminAuth: cleanAdminAuth,
      maintenanceMeta: obj.maintenanceMeta || {}
    };
  }

  // Öğrenci rolü: Başka öğrencilerin TC/PIN, ödev ve deneme bilgilerini gizle
  return {
    staff: (obj.staff || []).map((t) => ({
      id: t.id,
      fullName: t.fullName,
      branch: t.branch,
      photoUrl: t.photoUrl,
      biography: t.biography,
      weeklySchedule: t.weeklySchedule || []
    })),
    students: (obj.students || []).map((s) =>
      s.id === userId
        ? { id: s.id, tcNo: s.tcNo, fullName: s.fullName, className: s.className, paymentStatus: s.paymentStatus }
        : { id: s.id, fullName: s.fullName, className: s.className }
    ),
    appointments: obj.appointments || [],
    assignments: (obj.assignments || []).filter((a) => a.studentId === userId),
    exams: (obj.exams || []).filter((ex) => ex.studentId === userId),
    notifications: (obj.notifications || []).filter((n) => n.targetUserId === userId),
    adminAuth: cleanAdminAuth,
    maintenanceMeta: obj.maintenanceMeta || {}
  };
}

module.exports = { sanitizePublicState, sanitizeStateForRole };