import React, { useState, useEffect, useMemo } from 'react';
import UserAvatar from '../common/UserAvatar';
import { Bell, Sparkles, Calendar, Trash2, Lock, Clock } from '../common/Icons';
import { TUTORING_PURPOSES, DAYS_TR, HOURS_LIST, MAX_WEEKLY_APPOINTMENTS, MAX_SLOT_QUOTA } from '../../constants';
import { maskTcKimlik, formatSlotLabel } from '../../utils/helpers';

export default function StudentPortalView({
  currentStudent, staff, appointments, setAppointments, assignments, setAssignments, notifications, setNotifications, currentSystemDay, smartEveningWindowOpen, emitSocketEvent
}) {
  const [selectedTeacherId, setSelectedTeacherId] = useState(staff[0]?.id || '');
  const [sessionType, setSessionType] = useState('Konu Anlatımı');
  const [sessionTopic, setSessionTopic] = useState('');

  const [previewDayTab, setPreviewDayTab] = useState(currentSystemDay);
  const [bookingAlert, setBookingAlert] = useState({ type: '', message: '' });
  const [nowMs, setNowMs] = useState(Date.now());
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  useEffect(() => { setPreviewDayTab(currentSystemDay); }, [currentSystemDay]);
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedTeacher = staff.find((t) => t.id === selectedTeacherId) || staff[0];
  const currentDayIndex = DAYS_TR.indexOf(currentSystemDay);
  const nextDayName = DAYS_TR[(currentDayIndex + 1) % DAYS_TR.length];

  const isDayUnlockedForBooking = (dayName) => {
    if (dayName === currentSystemDay) return true;
    if (smartEveningWindowOpen && dayName === nextDayName) return true;
    return false;
  };

  const isSlotTimePassedToday = (dayName, hourSlot) => {
    if (dayName !== currentSystemDay) return false;
    const hourMeta = HOURS_LIST.find((h) => h.slot === Number(hourSlot));
    if (!hourMeta || !hourMeta.time) return false;
    const [slotH, slotM] = hourMeta.time.split(':').map(Number);
    const nowDate = new Date(nowMs);
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const slotMinutes = slotH * 60 + slotM;
    return nowMinutes >= slotMinutes;
  };

  const freeHoursForPreviewDay = useMemo(() => {
    return (selectedTeacher?.weeklySchedule || []).filter((s) => s.status === 'free' && s.day === previewDayTab);
  }, [selectedTeacher, previewDayTab]);

  const myWeeklyAllAppointments = useMemo(() => {
    return appointments.filter((slot) => slot.participants.some((p) => p.studentId === currentStudent?.id && p.status !== 'Rejected'));
  }, [appointments, currentStudent?.id]);

  const myActiveAppointments = useMemo(() => {
    return myWeeklyAllAppointments.filter((slot) => !slot.archivedFromDesk);
  }, [myWeeklyAllAppointments]);

  const weeklyUsedCount = myWeeklyAllAppointments.length;
  const isTopicOptional = sessionType === 'Soru Çözümü';

  const handleCancelMySlot = (slotId) => {
    setAppointments((prev) =>
      prev
        .map((slot) => {
          if (slot.id !== slotId) return slot;
          const remaining = slot.participants.filter((p) => p.studentId !== currentStudent.id);
          return { ...slot, participants: remaining };
        })
        .filter((slot) => slot.participants.some((p) => p.status !== 'Rejected'))
    );
    setBookingAlert({ type: 'success', message: 'Randevunuz iptal edildi. Haftalık kotanız ve boşalan koltuk iade edildi.' });
    emitSocketEvent('appointments:cancelled', `${currentStudent.fullName}, etüt randevusunu iptal etti.`);
  };

  const handleBookSlot = (day, hourSlot) => {
    setBookingAlert({ type: '', message: '' });
    const slotLabelStr = formatSlotLabel(hourSlot);

    if (!isDayUnlockedForBooking(day)) {
      setBookingAlert({ type: 'error', message: `Gün Kilidi Aktif: Bugün günlerden ${currentSystemDay}. Sadece ${currentSystemDay} ve akşam 20:00'den sonra ${nextDayName} gününe başvuru açılır.` });
      return;
    }

    if (isSlotTimePassedToday(day, hourSlot)) {
      setBookingAlert({ type: 'error', message: `Bu etüt saatinin (${slotLabelStr}) başlangıç zamanı bugün için geçmiştir.` });
      return;
    }

    if (weeklyUsedCount >= MAX_WEEKLY_APPOINTMENTS) {
      setBookingAlert({ type: 'error', message: `Haftalık Kota Sınırı: Her öğrencinin haftada maksimum ${MAX_WEEKLY_APPOINTMENTS} etüt hakkı vardır (${MAX_WEEKLY_APPOINTMENTS}/${MAX_WEEKLY_APPOINTMENTS}).` });
      return;
    }

    const conflictingTeacherSlot = appointments.find(
      (slot) =>
        !slot.archivedFromDesk &&
        slot.day === day &&
        Number(slot.hourSlot) === Number(hourSlot) &&
        slot.teacherId !== selectedTeacher.id &&
        slot.participants.some((p) => p.studentId === currentStudent.id && p.status !== 'Rejected')
    );
    if (conflictingTeacherSlot) {
      setBookingAlert({
        type: 'error',
        message: `Saat Çakışması: ${day} günü ${slotLabelStr} diliminde zaten ${conflictingTeacherSlot.teacherName} ile kayıtlı bir etüdünüz bulunuyor!`
      });
      return;
    }

    const hasSameDayWithSameTeacher = appointments.some(
      (slot) => slot.teacherId === selectedTeacher.id && slot.day === day && !slot.archivedFromDesk && slot.participants.some((p) => p.studentId === currentStudent.id && p.status !== 'Rejected')
    );
    if (hasSameDayWithSameTeacher) {
      setBookingAlert({ type: 'error', message: 'Aynı öğretmenden aynı gün içinde yalnızca 1 randevu alabilirsiniz.' });
      return;
    }

    const existingSlot = appointments.find(
      (slot) => slot.teacherId === selectedTeacher.id && slot.day === day && !slot.archivedFromDesk && Number(slot.hourSlot) === Number(hourSlot)
    );
    const activeExistingParticipants = existingSlot ? existingSlot.participants.filter((p) => p.status !== 'Rejected') : [];

    if (existingSlot && activeExistingParticipants.length > 0) {
      if (activeExistingParticipants.length >= MAX_SLOT_QUOTA) {
        setBookingAlert({ type: 'error', message: `Bu saat dilimi için ${MAX_SLOT_QUOTA} kişilik grup kotası dolmuştur!` });
        return;
      }

      const lockedType = existingSlot.sessionType || activeExistingParticipants[0]?.sessionType || sessionType;
      const lockedTopic =
        existingSlot.sessionTopic ||
        activeExistingParticipants[0]?.sessionTopic ||
        (lockedType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');

      setAppointments((prev) =>
        prev.map((s) =>
          s.id === existingSlot.id
            ? {
                ...s,
                maxQuota: MAX_SLOT_QUOTA,
                participants: [
                  ...s.participants.filter((p) => p.studentId !== currentStudent.id),
                  {
                    studentId: currentStudent.id,
                    studentName: currentStudent.fullName,
                    studentClass: currentStudent.className,
                    sessionType: lockedType,
                    sessionTopic: lockedTopic,
                    status: 'Pending',
                    requestedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                  }
                ]
              }
            : s
        )
      );
      setBookingAlert({ type: 'success', message: `${selectedTeacher.fullName} — ${day} ${slotLabelStr} diliminde kilitli olan "${lockedTopic}" grubuna katılım sağladınız!` });
      emitSocketEvent('appointments:booked', `${currentStudent.fullName}, ${selectedTeacher.fullName} (${day} ${slotLabelStr}) kilitli grubuna katıldı.`);
    } else {
      const resolvedTopic = sessionTopic.trim() || (isTopicOptional ? 'Genel Soru Çözümü' : '');

      if (!resolvedTopic) {
        setBookingAlert({
          type: 'error',
          message: 'Konu Anlatımı veya Öğrenci Kontrolü için lütfen Konu Detayı giriniz (Soru Çözümü seçerseniz boş bırakabilirsiniz).'
        });
        return;
      }

      const newSlot = {
        id: `slot-${Date.now()}`,
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.fullName,
        teacherBranch: selectedTeacher.branch,
        day,
        hourSlot: Number(hourSlot),
        maxQuota: MAX_SLOT_QUOTA,
        archivedFromDesk: false,
        sessionType,
        sessionTopic: resolvedTopic,
        expiresAtMs: Date.now() + 24 * 3600 * 1000,
        participants: [
          {
            studentId: currentStudent.id,
            studentName: currentStudent.fullName,
            studentClass: currentStudent.className,
            sessionType,
            sessionTopic: resolvedTopic,
            status: 'Pending',
            requestedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          }
        ]
      };
      setAppointments((prev) => [...prev.filter((s) => s.id !== existingSlot?.id), newSlot]);
      setBookingAlert({ type: 'success', message: `${selectedTeacher.fullName} — ${day} ${slotLabelStr} için "${resolvedTopic}" etüt grubunuzu kurdunuz!` });
      emitSocketEvent('appointments:booked', `${currentStudent.fullName}, ${selectedTeacher.fullName} (${day} ${slotLabelStr}) grubunu kurdu.`);
    }
  };

  const handleMarkHomeworkDone = (hwId, title) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === hwId ? { ...a, isCompleted: true, completedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) } : a))
    );
    emitSocketEvent('assignments:completed', `${currentStudent.fullName}, "${title}" ödevini tamamladı.`);
  };

  const formatRemainingTime = (isoDeadline) => {
    const diff = new Date(isoDeadline).getTime() - nowMs;
    if (diff <= 0) return 'Süre Doldu';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    return `${days}g ${hours}s ${mins}dk ${secs}sn`;
  };

  const myNotifications = useMemo(() => notifications.filter((n) => n.targetUserId === currentStudent?.id), [notifications, currentStudent?.id]);
  const unreadCount = useMemo(() => myNotifications.filter((n) => !n.isRead).length, [myNotifications]);
  const latestNotification = myNotifications[0] || null;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => (n.targetUserId === currentStudent.id ? { ...n, isRead: true } : n)));
  };

  const handleClearMyNotifications = () => {
    setNotifications((prev) => prev.filter((n) => n.targetUserId !== currentStudent.id));
  };

  const handleDismissSingleNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const myHomeworks = assignments.filter((a) => a.studentId === currentStudent?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="relative p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <UserAvatar src="" name={currentStudent?.fullName} className="w-14 h-14" rounded="rounded-full" ringClass="ring-2 ring-cyan-400" textClass="text-base" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-cyan-500/15 text-cyan-300">Öğrenci Portalı</span>
              <span className="text-xs font-mono text-slate-400">TC: {maskTcKimlik(currentStudent?.tcNo)}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{currentStudent?.fullName}</h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-0.5">
              <span>Sınıf: <strong className="text-cyan-300">{currentStudent?.className}</strong></span>
              <span>Ödeme Durumu: <strong className="text-emerald-400">{currentStudent?.paymentStatus}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setIsNotifDrawerOpen((prev) => !prev)} className={`relative px-4 py-3 rounded-2xl border transition flex items-center gap-2.5 ${isNotifDrawerOpen ? 'bg-indigo-600/20 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-200'}`}>
            <div className="relative">
              <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
              {unreadCount > 0 && <span className="absolute -top-2 -right-2 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">{unreadCount}</span>}
            </div>
            <div className="text-left">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Bildirim Çekmecesi</span>
              <span className="text-xs font-extrabold text-white">{myNotifications.length} Bildirim</span>
            </div>
          </button>

          <div className="px-5 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Haftalık Etüt Hakkı</span>
            <div className="text-xl font-black text-indigo-400 mt-0.5">{weeklyUsedCount} / {MAX_WEEKLY_APPOINTMENTS} Kullanıldı</div>
          </div>
        </div>

        {isNotifDrawerOpen && (
          <div className="w-full mt-4 pt-4 border-t border-slate-800/90">
            <div className="rounded-2xl bg-slate-950 border border-indigo-500/40 shadow-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-400" /><span className="text-xs font-extrabold text-white">Bildirim Merkezi</span></div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleMarkAllRead} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold">Tümünü Okundu İşaretle</button>
                  <button type="button" onClick={handleClearMyNotifications} className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-bold">Tümünü Temizle</button>
                  <button type="button" onClick={() => setIsNotifDrawerOpen(false)} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold">✕</button>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-900 p-2 space-y-1.5">
                {myNotifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">Bildirim bulunmuyor.</div>
                ) : (
                  myNotifications.map((n) => (
                    <div key={n.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${!n.isRead ? 'bg-indigo-950/30 border-indigo-500/40' : 'bg-slate-900/50 border-slate-800/70 opacity-75'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <div className="truncate"><strong className="text-white mr-2">{n.title}:</strong><span className="text-slate-300">{n.message}</span></div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-slate-500">{n.time}</span>
                        <button type="button" onClick={() => handleDismissSingleNotification(n.id)} className="w-6 h-6 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-300 flex items-center justify-center">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {myActiveAppointments.length > 0 && (
        <div className="p-5 rounded-2xl bg-indigo-900/20 border border-indigo-500/30">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-3"><Calendar className="w-4 h-4 text-indigo-400" /> Onaylı ve Bekleyen Etütlerim (İptal Paneli)</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myActiveAppointments.map((slot) => {
              const myRecord = slot.participants.find((p) => p.studentId === currentStudent.id);
              const tObj = staff.find((t) => t.id === slot.teacherId);
              const topicDisplay = slot.sessionTopic || myRecord?.sessionTopic || (myRecord?.sessionType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');
              return (
                <div key={slot.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <UserAvatar src={tObj?.photoUrl} name={slot.teacherName} className="w-10 h-10" rounded="rounded-full" ringClass="ring-2 ring-indigo-500/40" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1 gap-1">
                        <span className="font-bold text-white truncate">{slot.day} • {formatSlotLabel(slot.hourSlot)}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${myRecord.status === 'Approved' || myRecord.status === 'Proactive' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {myRecord.status === 'Approved' ? 'Onaylı' : myRecord.status === 'Proactive' ? 'Koç Çağırdı' : 'Bekliyor'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-200 truncate">{slot.teacherName}</div>
                      <div className="text-[10px] mt-0.5 text-cyan-300">{myRecord.sessionType} ({topicDisplay})</div>
                    </div>
                  </div>
                  <button onClick={() => handleCancelMySlot(slot.id)} className="w-full py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-bold flex items-center justify-center gap-1">
                    <Trash2 className="w-3 h-3" /> Randevuyu İptal Et (Yer Aç)
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-extrabold text-[10px] uppercase shrink-0">Canlı Bildirim Barı</span>
          {latestNotification ? (
            <div className="truncate text-slate-200">
              <strong className="text-amber-300 mr-1.5">{latestNotification.title}:</strong>
              <span>{latestNotification.message}</span>
            </div>
          ) : (
            <span className="text-slate-500 italic">Aktif bildirim yok.</span>
          )}
        </div>
        <button type="button" onClick={() => setIsNotifDrawerOpen((prev) => !prev)} className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px]">Çekmeceyi Aç</button>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan-400">
              <Lock className="w-3.5 h-3.5" /> Gün Bazlı Adil Randevu Kilidi, Çakışma Koruması & Akıllı 20:00 Kuralı
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sabah 5 ders (<strong className="text-white">08:30–12:30</strong>), Öğle Arası (<strong className="text-amber-300">12:30–13:30</strong>) ve Öğleden Sonra 5 Ders/Etüt (<strong className="text-white">13:30–17:30</strong>) uygulanır. Yalnızca <strong className="text-emerald-400">{currentSystemDay}</strong> gününün gelecek saatlerine ve akşam 20:00'den sonra <strong className="text-cyan-300">{nextDayName}</strong> gününe başvuru açıktır.
            </p>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Aktif Gün</span>
              <span className="text-xs font-black text-emerald-400">{currentSystemDay}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <UserAvatar src={selectedTeacher?.photoUrl} name={selectedTeacher?.fullName} className="w-12 h-12" rounded="rounded-full" ringClass="ring-2 ring-cyan-400/50" />
            <div>
              <h2 className="text-xl font-extrabold text-white">{selectedTeacher?.fullName} — Randevu Masası</h2>
              <p className="text-xs text-slate-400 mt-0.5">8 kişilik grup kotası • Soru Çözümü için konu belirtmek zorunlu değildir.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">1. Etüt Amacı</label>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-bold text-amber-300">
                {TUTORING_PURPOSES.map((purpose) => (<option key={purpose} value={purpose}>{purpose}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                {isTopicOptional ? '2. Konu (İsteğe Bağlı)' : '2. Konu (Zorunlu - Maks 30)'}
              </label>
              <input
                type="text"
                maxLength={30}
                value={sessionTopic}
                onChange={(e) => setSessionTopic(e.target.value)}
                placeholder={isTopicOptional ? 'Boş: Genel Soru Çözümü' : 'Örn: Limit ve Süreklilik'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-bold text-amber-300 placeholder-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">3. Öğretmen</label>
              <select value={selectedTeacher?.id || ''} onChange={(e) => setSelectedTeacherId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white">
                {staff.map((t) => (<option key={t.id} value={t.id}>{t.fullName} ({t.branch})</option>))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {DAYS_TR.map((dayName) => {
            const unlocked = isDayUnlockedForBooking(dayName);
            const isSelectedTab = previewDayTab === dayName;
            const daySlotCount = (selectedTeacher?.weeklySchedule || []).filter((s) => s.status === 'free' && s.day === dayName).length;

            return (
              <button key={dayName} type="button" onClick={() => setPreviewDayTab(dayName)} className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${isSelectedTab ? 'bg-emerald-500/15 border-emerald-400 text-white' : unlocked ? 'bg-slate-950 border-emerald-500/30 text-slate-200' : 'bg-slate-950/50 border-slate-800 text-slate-500'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs">{dayName}</span>
                  {unlocked ? <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">AÇIK</span> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                </div>
                <div className="mt-2 text-[10px] font-semibold flex items-center justify-between">
                  <span>{daySlotCount} Saat</span>
                  <span className={unlocked ? 'text-emerald-400' : 'text-slate-500'}>{unlocked ? 'Açık' : 'Kilitli'}</span>
                </div>
              </button>
            );
          })}
        </div>

        {bookingAlert.message && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between ${bookingAlert.type === 'error' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            <span>{bookingAlert.message}</span>
            <button onClick={() => setBookingAlert({ type: '', message: '' })}>✕</button>
          </div>
        )}

        {freeHoursForPreviewDay.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">Bu gün için boş etüt saati bulunmuyor.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {freeHoursForPreviewDay.map((freeSlot) => {
              const slotDoc = appointments.find((a) => a.teacherId === selectedTeacher?.id && a.day === freeSlot.day && !a.archivedFromDesk && Number(a.hourSlot) === Number(freeSlot.hourSlot));
              const activeParticipants = slotDoc ? slotDoc.participants.filter((p) => p.status !== 'Rejected') : [];
              const occupancy = activeParticipants.length;
              const isQuotaFull = occupancy >= MAX_SLOT_QUOTA;
              const myEnrollment = activeParticipants.find((p) => p.studentId === currentStudent.id);
              const isAlreadyEnrolled = Boolean(myEnrollment);
              const dayUnlocked = isDayUnlockedForBooking(freeSlot.day);
              const isTimePassed = isSlotTimePassedToday(freeSlot.day, freeSlot.hourSlot);

              const conflictingSlot = appointments.find(
                (a) =>
                  !a.archivedFromDesk &&
                  a.day === freeSlot.day &&
                  Number(a.hourSlot) === Number(freeSlot.hourSlot) &&
                  a.teacherId !== selectedTeacher?.id &&
                  a.participants.some((p) => p.studentId === currentStudent.id && p.status !== 'Rejected')
              );
              const hasTimeConflict = Boolean(conflictingSlot);

              const isGroupInitiated = occupancy > 0;
              const lockedType = slotDoc?.sessionType || activeParticipants[0]?.sessionType || 'Belirtilmedi';
              const lockedTopic = slotDoc?.sessionTopic || activeParticipants[0]?.sessionTopic || (lockedType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');
              const hourMeta = HOURS_LIST.find((h) => h.slot === Number(freeSlot.hourSlot));

              const isDisabled = !dayUnlocked || isTimePassed || isQuotaFull || isAlreadyEnrolled || hasTimeConflict || weeklyUsedCount >= MAX_WEEKLY_APPOINTMENTS;

              return (
                <div key={`${freeSlot.day}-${freeSlot.hourSlot}`} className={`p-5 rounded-2xl border transition flex flex-col justify-between ${isDisabled ? 'bg-slate-950/40 border-slate-800 opacity-65' : 'bg-slate-950 border-slate-800 hover:border-cyan-500/50'}`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-extrabold text-white">{freeSlot.day}</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[11px] font-extrabold">
                        {hourMeta?.title || `${freeSlot.hourSlot}. Saat`}
                      </span>
                    </div>
                    <div className="mb-3 flex items-center justify-between text-[11px] font-mono text-cyan-400 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800">
                      <span>⏰ Saat Aralığı:</span>
                      <strong className="text-emerald-300">{hourMeta?.range || ''}</strong>
                    </div>

                    {isGroupInitiated && (
                      <div className="mb-3 px-2 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                        <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">🔒 Grup Kilitli</span>
                        <span className="text-xs font-bold text-white block truncate">{lockedTopic}</span>
                        <span className="text-[10px] text-slate-300">{lockedType}</span>
                      </div>
                    )}

                    {hasTimeConflict && (
                      <div className="mb-3 px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[10px] font-bold text-amber-300">
                        ⚠️ Bu saatte ({hourMeta?.range}) {conflictingSlot.teacherName} ile etüdünüz var.
                      </div>
                    )}

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Grup Kotası:</span>
                        <span className={`font-black ${isQuotaFull ? 'text-rose-400' : 'text-emerald-400'}`}>{occupancy} / {MAX_SLOT_QUOTA} Öğrenci</span>
                      </div>
                      <div className="grid grid-cols-8 gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((seatIdx) => (
                          <div key={seatIdx} className={`h-2 rounded-full ${seatIdx < occupancy ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-900">
                    <button
                      disabled={isDisabled}
                      onClick={() => handleBookSlot(freeSlot.day, freeSlot.hourSlot)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition ${isDisabled ? 'bg-slate-900 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'}`}
                    >
                      {!dayUnlocked
                        ? '🔒 Kilitli Gün'
                        : isAlreadyEnrolled
                        ? '✓ Kayıtlısınız'
                        : hasTimeConflict
                        ? '⚠️ Saat Çakışması'
                        : isTimePassed
                        ? '⌛ Saat Geçti'
                        : isQuotaFull
                        ? `KOTA DOLU (${MAX_SLOT_QUOTA}/${MAX_SLOT_QUOTA})`
                        : isGroupInitiated
                        ? 'Aynı Konuyla Gruba Katıl'
                        : 'Randevu Grubunu Kur'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-amber-400" /> Ödev Takibi ve Canlı Geri Sayım</h2>
        {myHomeworks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">Aktif ödeviniz bulunmuyor.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {myHomeworks.map((hw) => (
              <div key={hw.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-indigo-400">{hw.teacherName}</span>
                    <span className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold ${hw.isCompleted ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {hw.isCompleted ? '✓ Teslim Edildi' : `⏱ Kalan: ${formatRemainingTime(hw.deadline)}`}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-white">{hw.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{hw.description}</p>
                </div>
                <button disabled={hw.isCompleted} onClick={() => handleMarkHomeworkDone(hw.id, hw.title)} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 disabled:text-emerald-400 text-white font-bold text-xs transition">
                  {hw.isCompleted ? '✓ Tamamlandı' : 'Tamamlandı Olarak İşaretle'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
