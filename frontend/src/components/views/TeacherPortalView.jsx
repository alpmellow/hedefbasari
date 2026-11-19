import React, { useState, useEffect, useMemo } from 'react';
import UserAvatar from '../common/UserAvatar';
import { BookOpen, Send, Calendar, Users, Trash2, Clock, CheckCircle2 } from '../common/Icons';
import { TUTORING_PURPOSES, HEDEFBASARI_CLASS_OPTIONS, MAX_WEEKLY_APPOINTMENTS, MAX_SLOT_QUOTA } from '../../constants';
import { getPurposeBadgeStyle, getNextMondayMidnightMs, formatSlotLabel } from '../../utils/helpers';

export default function TeacherPortalView({
  currentTeacher, students, appointments, setAppointments, assignments, setAssignments, lastWeeklyResetLabel, emitSocketEvent
}) {
  const freeSlots = useMemo(() => (currentTeacher?.weeklySchedule || []).filter((s) => s.status === 'free'), [currentTeacher]);
  const myUpcomingSlots = useMemo(() => {
    return appointments.filter((slot) => slot.teacherId === currentTeacher?.id && !slot.archivedFromDesk && slot.participants.some((p) => p.status !== 'Rejected'));
  }, [appointments, currentTeacher?.id]);

  const [hwForm, setHwForm] = useState({ studentId: students[0]?.id || '', title: '', description: '', hoursUntilDeadline: 24 });
  const [hwAlert, setHwAlert] = useState({ type: '', text: '' });

  const [summonForm, setSummonForm] = useState({
    studentId: students[0]?.id || '',
    slotValue: freeSlots[0] ? `${freeSlots[0].day}:${freeSlots[0].hourSlot}` : '',
    sessionType: 'Öğrenci Kontrolü',
    sessionTopic: ''
  });
  const [summonAlert, setSummonAlert] = useState({ type: '', text: '' });

  const [analysisScope, setAnalysisScope] = useState('my_students');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatWeeklyCountdown = () => {
    const diff = Math.max(0, getNextMondayMidnightMs() - nowMs);
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    return `${d}g ${h}s ${m}dk`;
  };

  const formatHomeworkDeadlineStatus = (hw) => {
    if (hw.isCompleted) {
      return { label: 'Zamanında / Tamamlandı', colorClass: 'text-emerald-400', isOverdue: false };
    }
    if (!hw.deadline) {
      return { label: 'Süre belirtilmedi', colorClass: 'text-slate-400', isOverdue: false };
    }
    const diff = new Date(hw.deadline).getTime() - nowMs;
    if (diff <= 0) {
      return { label: 'Süresi Doldu!', colorClass: 'text-rose-400 font-extrabold', isOverdue: true };
    }
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    if (d > 0) {
      return { label: `${d}g ${h}s kaldı`, colorClass: 'text-cyan-300', isOverdue: false };
    }
    return { label: `${h}s ${m}dk kaldı`, colorClass: 'text-amber-300', isOverdue: false };
  };

  const handleAssignHomework = (e) => {
    e.preventDefault();
    setHwAlert({ type: '', text: '' });

    const targetStudent = students.find((s) => s.id === (hwForm.studentId || students[0]?.id));
    if (!targetStudent) return;

    const newAssignment = {
      id: `assign-${Date.now()}`,
      teacherId: currentTeacher.id,
      teacherName: currentTeacher.fullName,
      studentId: targetStudent.id,
      studentName: targetStudent.fullName,
      title: hwForm.title.trim(),
      description: hwForm.description.trim(),
      deadline: new Date(Date.now() + Number(hwForm.hoursUntilDeadline) * 3600 * 1000).toISOString(),
      isCompleted: false,
      completedAt: null
    };

    setAssignments((prev) => [newAssignment, ...prev]);
    setHwForm({ ...hwForm, title: '', description: '' });
    setHwAlert({ type: 'success', text: `${targetStudent.fullName} öğrencisine ödev başarıyla atandı.` });

    emitSocketEvent('assignments:new', `${currentTeacher.fullName}, ${targetStudent.fullName} adlı öğrenciye yeni ödev atadı: "${newAssignment.title}"`, {
      targetUserId: targetStudent.id,
      title: 'Yeni Ödev Atandı',
      message: `${currentTeacher.fullName}: "${newAssignment.title}" ödevini atadı.`,
      type: 'info',
      category: 'homework'
    });
  };

  const handleToggleHomeworkComplete = (hw) => {
    const nextState = !hw.isCompleted;
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === hw.id
          ? { ...a, isCompleted: nextState, completedAt: nextState ? new Date().toISOString() : null }
          : a
      )
    );
  };

  const handleDeleteHomework = (hwId) => {
    setAssignments((prev) => prev.filter((a) => a.id !== hwId));
  };

  const handleProactiveSummon = (e) => {
    e.preventDefault();
    setSummonAlert({ type: '', text: '' });

    const targetStudent = students.find((s) => s.id === (summonForm.studentId || students[0]?.id));
    const activeSlotVal = summonForm.slotValue || (freeSlots[0] ? `${freeSlots[0].day}:${freeSlots[0].hourSlot}` : '');
    if (!targetStudent || !activeSlotVal) return;

    const [day, hourStr] = activeSlotVal.split(':');
    const hourSlot = Number(hourStr);
    const defaultTopic = summonForm.sessionType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Koçluk & Öğrenci Kontrolü';
    const cleanTopic = summonForm.sessionTopic.trim() || defaultTopic;
    const slotLabelStr = formatSlotLabel(hourSlot);

    const studentWeeklyCount = appointments.filter((slot) =>
      slot.participants.some((p) => p.studentId === targetStudent.id && p.status !== 'Rejected')
    ).length;
    if (studentWeeklyCount >= MAX_WEEKLY_APPOINTMENTS) {
      setSummonAlert({ type: 'error', text: `${targetStudent.fullName} bu haftaki maksimum etüt kotasını (${MAX_WEEKLY_APPOINTMENTS}/${MAX_WEEKLY_APPOINTMENTS}) doldurmuş durumda.` });
      return;
    }

    const conflictingTeacherSlot = appointments.find(
      (a) =>
        !a.archivedFromDesk &&
        a.day === day &&
        Number(a.hourSlot) === hourSlot &&
        a.teacherId !== currentTeacher.id &&
        a.participants.some((p) => p.studentId === targetStudent.id && p.status !== 'Rejected')
    );
    if (conflictingTeacherSlot) {
      setSummonAlert({
        type: 'error',
        text: `Saat Çakışması: ${targetStudent.fullName} öğrencisinin ${day} ${slotLabelStr} saatinde ${conflictingTeacherSlot.teacherName} ile başka bir etüdü var!`
      });
      return;
    }

    const existingSlot = appointments.find(
      (a) => a.teacherId === currentTeacher.id && a.day === day && !a.archivedFromDesk && Number(a.hourSlot) === hourSlot
    );

    if (existingSlot) {
      const activeCount = existingSlot.participants.filter((p) => p.status !== 'Rejected').length;
      if (activeCount >= MAX_SLOT_QUOTA) {
        setSummonAlert({ type: 'error', text: `Bu saat diliminde ${MAX_SLOT_QUOTA} kişilik grup kotası dolmuş durumda!` });
        return;
      }
      if (existingSlot.participants.some((p) => p.studentId === targetStudent.id && p.status !== 'Rejected')) {
        setSummonAlert({ type: 'error', text: `${targetStudent.fullName} zaten bu etüt saatinde kayıtlı.` });
        return;
      }

      const lockedTopic = existingSlot.sessionTopic || cleanTopic;
      setAppointments((prev) =>
        prev.map((slot) =>
          slot.id === existingSlot.id
            ? {
                ...slot,
                maxQuota: MAX_SLOT_QUOTA,
                participants: [
                  ...slot.participants.filter((p) => p.studentId !== targetStudent.id),
                  {
                    studentId: targetStudent.id,
                    studentName: targetStudent.fullName,
                    studentClass: targetStudent.className,
                    sessionType: summonForm.sessionType,
                    sessionTopic: lockedTopic,
                    status: 'Proactive',
                    requestedAt: 'Koç Çağrısı'
                  }
                ]
              }
            : slot
        )
      );
    } else {
      const newSlot = {
        id: `slot-${Date.now()}`,
        teacherId: currentTeacher.id,
        teacherName: currentTeacher.fullName,
        teacherBranch: currentTeacher.branch,
        day,
        hourSlot,
        maxQuota: MAX_SLOT_QUOTA,
        archivedFromDesk: false,
        sessionType: summonForm.sessionType,
        sessionTopic: cleanTopic,
        expiresAtMs: Date.now() + 24 * 3600 * 1000,
        participants: [
          {
            studentId: targetStudent.id,
            studentName: targetStudent.fullName,
            studentClass: targetStudent.className,
            sessionType: summonForm.sessionType,
            sessionTopic: cleanTopic,
            status: 'Proactive',
            requestedAt: 'Koç Çağrısı'
          }
        ]
      };
      setAppointments((prev) => [...prev, newSlot]);
    }

    setSummonAlert({ type: 'success', text: `${targetStudent.fullName}, ${day} ${slotLabelStr} etüdüne başarıyla çağrıldı!` });
    emitSocketEvent('teacher:proactive_summon', `${currentTeacher.fullName}, ${targetStudent.fullName} öğrencisini ${day} ${slotLabelStr} saatine çağırdı!`, {
      targetUserId: targetStudent.id,
      title: 'Proaktif Öğretmen Çağrısı!',
      message: `${currentTeacher.fullName} sizi ${day} günü ${slotLabelStr} etüdüne (${cleanTopic}) çağırdı.`,
      type: 'warning',
      category: 'summon'
    });
  };

  const enrichedStudents = useMemo(() => {
    return students.map((st) => {
      const allStAppointments = appointments.filter((slot) =>
        slot.participants.some((p) => p.studentId === st.id && p.status !== 'Rejected')
      );
      const myTeacherAppointments = allStAppointments.filter((slot) => slot.teacherId === currentTeacher?.id);

      const allStHomeworks = assignments.filter((a) => a.studentId === st.id);
      const myTeacherHomeworks = allStHomeworks.filter((a) => a.teacherId === currentTeacher?.id);
      const hasPendingMyHomework = myTeacherHomeworks.some((a) => !a.isCompleted);
      const hasInteractionWithMe = myTeacherAppointments.length > 0 || myTeacherHomeworks.length > 0;

      return {
        ...st,
        allStAppointments,
        myTeacherAppointments,
        allStHomeworks,
        myTeacherHomeworks,
        hasPendingMyHomework,
        hasInteractionWithMe
      };
    });
  }, [students, appointments, assignments, currentTeacher?.id]);

  const myInteractingCount = useMemo(() => enrichedStudents.filter((s) => s.hasInteractionWithMe).length, [enrichedStudents]);
  const myPendingHwStudentCount = useMemo(() => enrichedStudents.filter((s) => s.hasPendingMyHomework).length, [enrichedStudents]);

  const filteredAnalysisStudents = useMemo(() => {
    return enrichedStudents.filter((st) => {
      if (analysisScope === 'my_students' && !st.hasInteractionWithMe) return false;
      if (analysisScope === 'pending_hw' && !st.hasPendingMyHomework) return false;
      if (selectedClassFilter !== 'ALL' && st.className !== selectedClassFilter) return false;
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.trim().toLocaleLowerCase('tr-TR');
        const fullNameMatch = (st.fullName || '').toLocaleLowerCase('tr-TR').includes(q);
        const classMatch = (st.className || '').toLocaleLowerCase('tr-TR').includes(q);
        if (!fullNameMatch && !classMatch) return false;
      }
      return true;
    });
  }, [enrichedStudents, analysisScope, selectedClassFilter, studentSearchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <UserAvatar src={currentTeacher?.photoUrl} name={currentTeacher?.fullName} className="w-16 h-16" rounded="rounded-full" ringClass="ring-2 ring-emerald-400" textClass="text-lg" />
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">Öğretmen & Akademik Koçluk Portalı</span>
            <h1 className="text-2xl font-black text-white">{currentTeacher?.fullName}</h1>
            <p className="text-xs text-slate-400">{currentTeacher?.branch}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Etkileşimdeki Öğrencilerim: </span>
            <strong className="text-cyan-400">{myInteractingCount} Öğrenci</strong>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Haftalık Açık Etüt Saatiniz: </span>
            <strong className="text-emerald-400">{freeSlots.length} Saat</strong>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <form onSubmit={handleAssignHomework} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" /> Öğrenciye Ödev Ata
          </h2>

          {hwAlert.text && (
            <div className={`p-3 rounded-xl text-xs font-bold ${hwAlert.type === 'error' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {hwAlert.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Öğrenci Seçin</label>
            <select
              value={hwForm.studentId}
              onChange={(e) => setHwForm({ ...hwForm, studentId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.className})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Ödev Başlığı</label>
            <input type="text" required placeholder="Örn: AYT İntegral Alan Hesabı" value={hwForm.title} onChange={(e) => setHwForm({ ...hwForm, title: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Açıklama</label>
            <textarea rows={2} required placeholder="Test detayları, sayfa aralığı veya soru hedefi..." value={hwForm.description} onChange={(e) => setHwForm({ ...hwForm, description: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Teslim Süresi</label>
            <select value={hwForm.hoursUntilDeadline} onChange={(e) => setHwForm({ ...hwForm, hoursUntilDeadline: Number(e.target.value) })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm">
              <option value="24">1 Gün İçinde</option>
              <option value="48">2 Gün İçinde</option>
              <option value="72">3 Gün İçinde</option>
              <option value="96">4 Gün İçinde</option>
              <option value="120">5 Gün İçinde</option>
              <option value="144">6 Gün İçinde</option>
              <option value="168">7 Gün İçinde</option>
            </select>
          </div>

          <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition">
            Ödevi Ata & Anlık Bildirim Gönder
          </button>
        </form>

        <form onSubmit={handleProactiveSummon} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-400" /> Proaktif Randevu (Öğrenciyi Çağır)
          </h2>
          <p className="text-xs text-slate-400">Öğretmen kendi boş saatine öğrenciyi doğrudan çağırabilir (Çakışma ve {MAX_SLOT_QUOTA} kişilik grup kotası otomatik denetlenir).</p>

          {summonAlert.text && (
            <div className={`p-3 rounded-xl text-xs font-bold ${summonAlert.type === 'error' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {summonAlert.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Öğrenci</label>
            <select value={summonForm.studentId} onChange={(e) => setSummonForm({ ...summonForm, studentId: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm">
              {students.map((s) => (<option key={s.id} value={s.id}>{s.fullName} ({s.className})</option>))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Boş Etüt Saatiniz</label>
            <select value={summonForm.slotValue} onChange={(e) => setSummonForm({ ...summonForm, slotValue: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm">
              {freeSlots.map((s) => (
                <option key={`${s.day}:${s.hourSlot}`} value={`${s.day}:${s.hourSlot}`}>
                  {s.day} — {formatSlotLabel(s.hourSlot)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1">Etüt Amacı</label>
              <select value={summonForm.sessionType} onChange={(e) => setSummonForm({ ...summonForm, sessionType: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-sm font-bold text-white">
                {TUTORING_PURPOSES.map((purpose) => (<option key={purpose} value={purpose}>{purpose}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1">Konu Başlığı (İsteğe Bağlı)</label>
              <input
                type="text"
                maxLength={30}
                placeholder={summonForm.sessionType === 'Soru Çözümü' ? 'Boş: Genel Soru Çözümü' : 'Boş: Koçluk & Kontrol'}
                value={summonForm.sessionTopic}
                onChange={(e) => setSummonForm({ ...summonForm, sessionTopic: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-sm font-bold text-white placeholder-slate-500"
              />
            </div>
          </div>

          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition">
            Öğrenciyi Boş Saate Çağır
          </button>
        </form>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-400" /> Yaklaşan Etütlerim & Yoklama Listesi
        </h2>
        {myUpcomingSlots.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">Şu an için adınıza kayıtlı yaklaşan etüt bulunmuyor.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myUpcomingSlots.map((slot) => {
              const activeParticipants = slot.participants.filter((p) => p.status !== 'Rejected');
              const lockedTopic = slot.sessionTopic || activeParticipants[0]?.sessionTopic || (slot.sessionType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');
              const maxCap = slot.maxQuota || MAX_SLOT_QUOTA;
              return (
                <div key={slot.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex flex-col border-b border-slate-800 pb-2 mb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-white text-xs sm:text-sm">{slot.day} • {formatSlotLabel(slot.hourSlot)}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 shrink-0">{activeParticipants.length} / {maxCap} Öğrenci</span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-bold text-cyan-400">Konu: {lockedTopic}</div>
                  </div>
                  <ul className="space-y-2">
                    {activeParticipants.map((p) => (
                      <li key={p.studentId} className="text-xs flex flex-col gap-1 bg-slate-900 p-2 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{p.studentName}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${p.status === 'Approved' || p.status === 'Proactive' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                            {p.status === 'Approved' ? 'Onaylı' : p.status === 'Proactive' ? 'Siz Çağırdınız' : 'Bekliyor'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                          <span>{p.studentClass}</span>
                          <span className={`px-1.5 py-0.5 rounded border ${getPurposeBadgeStyle(p.sessionType)}`}>{p.sessionType}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-extrabold text-white">Akıllı Öğrenci Analizi, Randevu Geçmişi ve Ödev Takibi</h2>
            </div>
            <p className="text-xs text-slate-400">
              Varsayılan olarak yalnızca <strong className="text-cyan-300">sizinle etüdü veya ödevi olan öğrenciler</strong> listelenir. Son sıfırlama: <strong className="text-emerald-400">{lastWeeklyResetLabel}</strong>
            </p>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pazartesi 00:00 Sıfırlamaya Kalan</span>
            <span className="font-mono text-xs font-extrabold text-emerald-400">{formatWeeklyCountdown()}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAnalysisScope('my_students')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                analysisScope === 'my_students'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              Benim Öğrencilerim ({myInteractingCount})
            </button>
            <button
              type="button"
              onClick={() => setAnalysisScope('pending_hw')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                analysisScope === 'pending_hw'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              Ödevi Bekleyenler ({myPendingHwStudentCount})
            </button>
            <button
              type="button"
              onClick={() => setAnalysisScope('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                analysisScope === 'all'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              Tüm Kayıtlı Öğrenciler ({students.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200"
            >
              <option value="ALL">Tüm Sınıflar</option>
              {HEDEFBASARI_CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Öğrenci adı ile ara..."
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500"
            />
          </div>
        </div>

        {filteredAnalysisStudents.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-400">
              {analysisScope === 'my_students'
                ? 'Bu hafta henüz sizden etüt alan veya ödev verdiğiniz bir öğrenci bulunmuyor.'
                : 'Seçilen filtreye uygun öğrenci bulunamadı.'}
            </p>
            {analysisScope !== 'all' && (
              <button
                type="button"
                onClick={() => setAnalysisScope('all')}
                className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold"
              >
                Kurumdaki Tüm Öğrencileri Göster ({students.length})
              </button>
            )}
          </div>
        ) : (
          <div className="max-h-[620px] overflow-y-auto pr-1.5 grid md:grid-cols-2 gap-4">
            {filteredAnalysisStudents.map((st) => (
              <div key={st.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar src="" name={st.fullName} className="w-9 h-9" ringClass="ring-1 ring-indigo-500/40" />
                      <div>
                        <h3 className="font-extrabold text-white text-sm">{st.fullName}</h3>
                        <span className="text-[11px] text-slate-400">{st.className}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Benimle Etüt: {st.myTeacherAppointments.length}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/15 text-indigo-300">
                        Toplam Kota: {st.allStAppointments.length} / {MAX_WEEKLY_APPOINTMENTS}
                      </span>
                    </div>
                  </div>

                  {st.myTeacherAppointments.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bu Hafta Benimle Olan Etütleri:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {st.myTeacherAppointments.map((slot) => {
                          const part = slot.participants.find((p) => p.studentId === st.id);
                          const topicLabel = slot.sessionTopic || part?.sessionTopic || 'Genel';
                          return (
                            <span key={slot.id} className={`px-2 py-0.5 rounded text-[11px] font-bold ${getPurposeBadgeStyle(part?.sessionType)}`}>
                              {slot.day} {formatSlotLabel(slot.hourSlot)}: {part?.sessionType} ({topicLabel})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-2 border-t border-slate-900">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Verdiğim Ödevler ({st.myTeacherHomeworks.length}):
                    </span>
                    {st.myTeacherHomeworks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Tarafınızdan atanmış aktif ödev yok.</p>
                    ) : (
                      st.myTeacherHomeworks.map((hw) => {
                        const deadlineInfo = formatHomeworkDeadlineStatus(hw);
                        return (
                          <div key={hw.id} className={`text-xs bg-slate-900 px-3 py-2.5 rounded-lg space-y-1.5 border ${deadlineInfo.isOverdue ? 'border-rose-500/40' : 'border-slate-800/60'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-100 font-bold truncate">{hw.title}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleHomeworkComplete(hw)}
                                  title="Durumu Değiştir (Tamamlandı / Bekliyor)"
                                  className={`px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-1 transition ${
                                    hw.isCompleted
                                      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {hw.isCompleted ? 'Tamamlandı' : 'Bekliyor'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHomework(hw.id)}
                                  className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/25"
                                  title="Ödevi Sil"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {hw.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2">{hw.description}</p>
                            )}
                            <div className="flex items-center gap-1 text-[10px]">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span className={deadlineInfo.colorClass}>{deadlineInfo.label}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}