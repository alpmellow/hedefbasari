import React, { useState, useEffect, useMemo } from 'react';
import UserAvatar from '../common/UserAvatar';
import { Bell, Sparkles, Calendar, Trash2, Lock, Clock } from '../common/Icons';
import { TUTORING_PURPOSES, DAYS_TR, HOURS_LIST, MAX_WEEKLY_APPOINTMENTS, MAX_SLOT_QUOTA } from '../../constants';
import { maskTcKimlik, formatSlotLabel } from '../../utils/helpers';

const SHORT_SUBJECT_LABELS = {
  turkce: 'TR',
  sosyal: 'SOS',
  matematik: 'MAT',
  fen: 'FEN',
  fizik: 'FİZ',
  kimya: 'KİM',
  biyoloji: 'BİY',
  edebiyat: 'EDB',
  tarih1: 'TAR-1',
  cografya1: 'COĞ-1',
  tarih2: 'TAR-2',
  cografya2: 'COĞ-2',
  felsefe: 'FEL',
  din: 'DİN'
};

function getShortSubjectLabel(key, fallbackLabel = '') {
  if (SHORT_SUBJECT_LABELS[key]) return SHORT_SUBJECT_LABELS[key];
  return String(fallbackLabel || key).slice(0, 4).toLocaleUpperCase('tr-TR');
}

function parseDateOnlyMs(dateStr = '') {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('.').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  const parsed = Date.parse(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareExamsChronological(a, b) {
  const dateDiff = parseDateOnlyMs(a.date) - parseDateOnlyMs(b.date);
  if (dateDiff !== 0) return dateDiff;
  return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
}

function formatShortDate(dateStr = '') {
  if (!dateStr) return '—';
  if (dateStr.includes('-')) {
    const [, m, d] = dateStr.split('-');
    return `${d}.${m}`;
  }
  return dateStr;
}

export default function StudentPortalView({
  currentStudent, staff, appointments, setAppointments, assignments, setAssignments, exams = [], notifications, setNotifications, currentSystemDay, smartEveningWindowOpen, emitSocketEvent
}) {
  const [selectedTeacherId, setSelectedTeacherId] = useState(staff[0]?.id || '');
  const [sessionType, setSessionType] = useState('Konu Anlatımı');
  const [sessionTopic, setSessionTopic] = useState('');

  const [previewDayTab, setPreviewDayTab] = useState(currentSystemDay);
  const [bookingAlert, setBookingAlert] = useState({ type: '', message: '' });
  const [nowMs, setNowMs] = useState(Date.now());
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  // Deneme Karnesi & Ölçeklenebilir Liste State'leri
  const [examTypeTab, setExamTypeTab] = useState('TYT');
  const [chartRange, setChartRange] = useState('8'); // '8' | '16' | 'ALL'
  const [examSearch, setExamSearch] = useState('');
  const [examSort, setExamSort] = useState('newest'); // 'newest' | 'oldest' | 'highest' | 'lowest'
  const [examViewMode, setExamViewMode] = useState('cards'); // 'cards' | 'table'
  const [examPage, setExamPage] = useState(1);
  const [hoveredExamIdx, setHoveredExamIdx] = useState(null);
  const [expandedExamId, setExpandedExamId] = useState(null);

  useEffect(() => { setPreviewDayTab(currentSystemDay); }, [currentSystemDay]);
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setExamPage(1);
  }, [examTypeTab, examSearch, examSort, examViewMode]);

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

  // Öğrencinin Kendi Deneme Verileri (Kronolojik: Sınav Tarihine Göre Eski -> Yeni)
  const myAllExams = useMemo(() => {
    return (exams || [])
      .filter((ex) => ex.studentId === currentStudent?.id)
      .sort(compareExamsChronological);
  }, [exams, currentStudent?.id]);

  const myFilteredExams = useMemo(() => {
    return myAllExams.filter((ex) => ex.examType === examTypeTab);
  }, [myAllExams, examTypeTab]);

  const examMaxPossible = examTypeTab === 'TYT' ? 120 : 80;

  // Her denemenin bir önceki kronolojik sınava göre gerçek net farkı
  const examChronoDiffMap = useMemo(() => {
    const map = new Map();
    myFilteredExams.forEach((ex, idx) => {
      if (idx === 0) {
        map.set(ex.id, null);
      } else {
        const diff = Number(((Number(ex.totalNet) || 0) - (Number(myFilteredExams[idx - 1].totalNet) || 0)).toFixed(2));
        map.set(ex.id, diff);
      }
    });
    return map;
  }, [myFilteredExams]);

  const myExamSummary = useMemo(() => {
    if (myFilteredExams.length === 0) {
      return { latest: 0, peak: 0, avg: 0, delta: 0, count: 0, accuracyPct: 0, avgWrongPenalty: 0 };
    }
    const nets = myFilteredExams.map((e) => Number(e.totalNet) || 0);
    const latest = nets[nets.length - 1];
    const prev = nets.length >= 2 ? nets[nets.length - 2] : latest;
    const peak = Math.max(...nets);
    const avg = Number((nets.reduce((a, b) => a + b, 0) / nets.length).toFixed(2));
    const delta = Number((latest - prev).toFixed(2));

    let totalD = 0;
    let totalY = 0;
    myFilteredExams.forEach((ex) => {
      if (typeof ex.totalD === 'number' && typeof ex.totalY === 'number') {
        totalD += ex.totalD;
        totalY += ex.totalY;
      } else {
        Object.values(ex.sections || {}).forEach((s) => {
          totalD += Number(s.d) || 0;
          totalY += Number(s.y) || 0;
        });
      }
    });

    const accuracyPct = (totalD + totalY) > 0 ? Math.round((totalD / (totalD + totalY)) * 100) : 0;
    const avgWrongPenalty = Number(((totalY / 4) / myFilteredExams.length).toFixed(2));

    return { latest, peak, avg, delta, count: nets.length, accuracyPct, avgWrongPenalty };
  }, [myFilteredExams]);

  const mySubjectStats = useMemo(() => {
    const map = {};
    myFilteredExams.forEach((ex) => {
      Object.entries(ex.sections || {}).forEach(([key, sec]) => {
        if (!map[key]) {
          map[key] = { key, label: sec.label || key, max: sec.max || 40, nets: [] };
        }
        map[key].nets.push(Number(sec.net) || 0);
      });
    });

    return Object.values(map).map((item) => {
      const avg = Number((item.nets.reduce((a, b) => a + b, 0) / item.nets.length).toFixed(2));
      const latest = Number(item.nets[item.nets.length - 1].toFixed(2));
      const prev = item.nets.length >= 2 ? item.nets[item.nets.length - 2] : latest;
      const delta = Number((latest - prev).toFixed(2));
      const pct = Math.max(0, Math.min(100, Math.round((avg / item.max) * 100)));
      return { ...item, avg, latest, delta, pct };
    });
  }, [myFilteredExams]);

  // Tablo görünümü için benzersiz ders sütunları
  const tableSubjectColumns = useMemo(() => {
    const colMap = new Map();
    myFilteredExams.forEach((ex) => {
      Object.entries(ex.sections || {}).forEach(([key, sec]) => {
        if (!colMap.has(key)) {
          colMap.set(key, { key, label: sec.label || key, max: sec.max || 40 });
        }
      });
    });
    return Array.from(colMap.values());
  }, [myFilteredExams]);

  // Arama + Sıralama + Sayfalama
  const visibleExamsList = useMemo(() => {
    const q = examSearch.trim().toLocaleLowerCase('tr-TR');
    const filtered = !q
      ? [...myFilteredExams]
      : myFilteredExams.filter(
          (ex) =>
            (ex.examName || '').toLocaleLowerCase('tr-TR').includes(q) ||
            (ex.date || '').includes(q)
        );

    if (examSort === 'newest') return filtered.reverse();
    if (examSort === 'oldest') return filtered;
    if (examSort === 'highest') return filtered.sort((a, b) => (Number(b.totalNet) || 0) - (Number(a.totalNet) || 0));
    if (examSort === 'lowest') return filtered.sort((a, b) => (Number(a.totalNet) || 0) - (Number(b.totalNet) || 0));
    return filtered.reverse();
  }, [myFilteredExams, examSearch, examSort]);

  const pageSize = examViewMode === 'table' ? 8 : 6;
  const totalPages = Math.max(1, Math.ceil(visibleExamsList.length / pageSize));
  const safePage = Math.min(examPage, totalPages);
  const paginatedExams = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleExamsList.slice(start, start + pageSize);
  }, [visibleExamsList, safePage, pageSize]);

  // Neon SVG Grafik Koordinatları (Seçilen aralığa göre dinamik + etiket seyreltme)
  const svgW = 540;
  const svgH = 165;
  const padX = 26;
  const padY = 18;

  const recentExamsForChart = useMemo(() => {
    if (chartRange === 'ALL') return myFilteredExams;
    const limit = Number(chartRange) || 8;
    return myFilteredExams.slice(-limit);
  }, [myFilteredExams, chartRange]);

  const studentChartCoords = useMemo(() => {
    if (recentExamsForChart.length === 0) return { points: [], yMax: examMaxPossible, avgY: null };
    const nets = recentExamsForChart.map((e) => Number(e.totalNet) || 0);
    const rawMax = Math.max(...nets, 10);
    const yMax = Math.min(examMaxPossible, Math.ceil(rawMax / 10) * 10 + 10);
    const usableW = svgW - padX * 2;
    const usableH = svgH - padY * 2;

    const getY = (val) => {
      const clamped = Math.max(0, Math.min(yMax, val));
      return svgH - padY - (clamped / yMax) * usableH;
    };

    const points = recentExamsForChart.map((ex, i) => {
      const x = recentExamsForChart.length === 1
        ? svgW / 2
        : padX + (i / (recentExamsForChart.length - 1)) * usableW;
      const val = Number(ex.totalNet) || 0;
      return {
        x,
        y: getY(val),
        val,
        name: ex.examName,
        shortDate: formatShortDate(ex.date)
      };
    });

    const avgY = myExamSummary.avg > 0 ? getY(myExamSummary.avg) : null;
    return { points, yMax, avgY };
  }, [recentExamsForChart, examMaxPossible, myExamSummary.avg]);

  const labelStep = useMemo(() => {
    const len = studentChartCoords.points.length;
    if (len <= 8) return 1;
    if (len <= 16) return 2;
    return Math.ceil(len / 7);
  }, [studentChartCoords.points.length]);

  const studentPolyline = studentChartCoords.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const studentArea = studentChartCoords.points.length >= 2
    ? `${studentChartCoords.points[0].x},${svgH - padY} ${studentPolyline} ${studentChartCoords.points[studentChartCoords.points.length - 1].x},${svgH - padY}`
    : '';

  const latestOverallExam = myAllExams.length ? myAllExams[myAllExams.length - 1] : null;

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

          <a href="#deneme-karnem" className="px-4 py-3 rounded-2xl bg-[#0c1229] border border-cyan-500/30 hover:border-cyan-400 transition text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
              {latestOverallExam ? `Son ${latestOverallExam.examType} Netim` : 'Deneme Karnem'}
            </span>
            <div className="text-lg font-black font-mono text-white mt-0.5">
              {latestOverallExam ? `${Number(latestOverallExam.totalNet).toFixed(2)} Net` : `${myAllExams.length} Kayıt`}
            </div>
          </a>

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

      {/* DENEME SINAVI KARNEM & GELİŞİM GRAFİĞİM (ÇOKLU DENEME OPTİMİZE) */}
      <div id="deneme-karnem" className="p-6 rounded-3xl bg-gradient-to-br from-[#0c1229] via-[#0e1532] to-[#141133] border border-indigo-500/30 shadow-[0_0_35px_rgba(79,70,229,0.12)] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">
                KİŞİSEL AKADEMİK GELİŞİM ANALİZİ
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-0.5">Deneme Sınavı Karnem &amp; Net Grafiğim</h2>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#070b1a] border border-indigo-500/25">
            {['TYT', 'AYT'].map((type) => {
              const count = myAllExams.filter((e) => e.examType === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setExamTypeTab(type);
                    setHoveredExamIdx(null);
                    setExpandedExamId(null);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition ${
                    examTypeTab === type
                      ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 Özet KPI Kartı (İsabet ve Yanlış Kaybı Dahil) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#070b1a] border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">SON {examTypeTab} NETİM</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-white">{myExamSummary.latest.toFixed(2)}</span>
              {myExamSummary.count >= 2 && (
                <span className={`text-xs font-mono font-extrabold ${myExamSummary.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {myExamSummary.delta >= 0 ? `+${myExamSummary.delta}` : myExamSummary.delta}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">Maksimum {examMaxPossible} Net</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#070b1a] border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">EN YÜKSEK (ZİRVE)</span>
            <span className="text-2xl font-black font-mono text-cyan-300 mt-1 block">{myExamSummary.peak.toFixed(2)}</span>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
              İsabet Oranı: <strong className="text-cyan-300">%{myExamSummary.accuracyPct}</strong>
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#070b1a] border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">GENEL ORTALAMA</span>
            <span className="text-2xl font-black font-mono text-fuchsia-300 mt-1 block">{myExamSummary.avg.toFixed(2)}</span>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
              Yanlış Kaybı: <strong className="text-rose-400">-{myExamSummary.avgWrongPenalty}</strong> Net/Sınav
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#070b1a] border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">GİRİLEN {examTypeTab}</span>
            <span className="text-2xl font-black font-mono text-indigo-300 mt-1 block">{myExamSummary.count} Sınav</span>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">Tüm Dönem Arşivi</span>
          </div>
        </div>

        {myFilteredExams.length === 0 ? (
          <div className="p-10 rounded-2xl bg-[#070b1a] border border-indigo-500/15 text-center space-y-1.5">
            <p className="text-sm font-bold text-slate-300">Henüz sisteme işlenmiş {examTypeTab} deneme sonucunuz bulunmuyor.</p>
            <p className="text-xs text-slate-500">Yönetim tarafından deneme sonuçlarınız girildiğinde gelişim grafiğiniz burada otomatik oluşacaktır.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-5">
            {/* Sol: Neon Gelişim Eğrisi (Aralık Seçici + Ortalama Çizgisi) */}
            <div className="lg:col-span-7 p-4 rounded-2xl bg-[#070b1a] border border-indigo-500/20 flex flex-col justify-between space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                  {examTypeTab} Net Gelişim Eğrim ({chartRange === 'ALL' ? `Tüm ${myFilteredExams.length}` : `Son ${recentExamsForChart.length}`} Sınav)
                </span>
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-indigo-500/20">
                  {[
                    { id: '8', label: 'Son 8' },
                    { id: '16', label: 'Son 16' },
                    { id: 'ALL', label: 'Tümü' }
                  ].map((rng) => (
                    <button
                      key={rng.id}
                      type="button"
                      onClick={() => {
                        setChartRange(rng.id);
                        setHoveredExamIdx(null);
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                        chartRange === rng.id
                          ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {rng.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative pt-2">
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[175px] overflow-visible">
                  <defs>
                    <linearGradient id="stCyanArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="stCyanStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#e879f9" />
                    </linearGradient>
                  </defs>

                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = svgH - padY - ratio * (svgH - padY * 2);
                    return (
                      <g key={ratio}>
                        <line x1={padX} y1={y} x2={svgW - padX} y2={y} stroke="rgba(148,163,184,0.09)" strokeDasharray="3 4" />
                        <text x="2" y={y + 3} fill="rgba(148,163,184,0.5)" fontSize="9" fontFamily="monospace">
                          {Math.round(studentChartCoords.yMax * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Ortalama Referans Çizgisi */}
                  {studentChartCoords.avgY !== null && studentChartCoords.points.length >= 2 && (
                    <g>
                      <line
                        x1={padX}
                        y1={studentChartCoords.avgY}
                        x2={svgW - padX}
                        y2={studentChartCoords.avgY}
                        stroke="rgba(232,121,249,0.45)"
                        strokeWidth="1.2"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={svgW - padX}
                        y={studentChartCoords.avgY - 4}
                        textAnchor="end"
                        fill="rgba(232,121,249,0.8)"
                        fontSize="8.5"
                        fontFamily="monospace"
                      >
                        Ort: {myExamSummary.avg.toFixed(1)}
                      </text>
                    </g>
                  )}

                  {studentArea && <polygon points={studentArea} fill="url(#stCyanArea)" />}

                  {studentChartCoords.points.length >= 2 && (
                    <polyline
                      fill="none"
                      stroke="url(#stCyanStroke)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={studentPolyline}
                      style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.6))' }}
                    />
                  )}

                  {studentChartCoords.points.map((pt, idx) => {
                    const isFirstOrLast = idx === 0 || idx === studentChartCoords.points.length - 1;
                    const showLabel = isFirstOrLast || idx % labelStep === 0;
                    const dotRadius = studentChartCoords.points.length > 16 ? 3 : 4.2;

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredExamIdx(idx)}
                        onMouseLeave={() => setHoveredExamIdx(null)}
                        className="cursor-pointer"
                      >
                        <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredExamIdx === idx ? '6' : dotRadius}
                          fill="#ffffff"
                          stroke="#22d3ee"
                          strokeWidth="2.2"
                          style={{ filter: 'drop-shadow(0 0 8px #22d3ee)' }}
                        />
                        {showLabel && (
                          <>
                            <text x={pt.x} y={pt.y - 9} textAnchor="middle" fill="#67e8f9" fontSize="9" fontFamily="monospace" fontWeight="bold">
                              {pt.val.toFixed(1)}
                            </text>
                            <text x={pt.x} y={svgH - 2} textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="8.5" fontFamily="monospace">
                              {pt.shortDate}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {hoveredExamIdx !== null && recentExamsForChart[hoveredExamIdx] && (
                  <div className="absolute top-1 right-2 px-3 py-2 rounded-xl bg-slate-950/95 border border-cyan-500/40 text-[11px] shadow-xl pointer-events-none z-10">
                    <div className="font-extrabold text-white">{recentExamsForChart[hoveredExamIdx].examName}</div>
                    <div className="font-mono text-cyan-300 font-bold mt-0.5">
                      {Number(recentExamsForChart[hoveredExamIdx].totalNet).toFixed(2)} Net • {recentExamsForChart[hoveredExamIdx].date}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sağ: Branş Ortalamaları */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-[#070b1a] border border-indigo-500/20 space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-fuchsia-300 block">
                Branş Bazlı Ortalama Performansım
              </span>
              <div className="space-y-3 max-h-[210px] overflow-y-auto pr-1">
                {mySubjectStats.map((sec) => (
                  <div key={sec.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">
                        {sec.label} <span className="text-[10px] font-mono text-slate-500">({sec.max})</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-black text-white">{sec.avg.toFixed(2)} Net</span>
                        {myFilteredExams.length >= 2 && (
                          <span className={`text-[10px] font-bold ${sec.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {sec.delta >= 0 ? `+${sec.delta}` : sec.delta}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 transition-all duration-500"
                        style={{ width: `${sec.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alt: Ölçeklenebilir Deneme Arşivi (Arama + Sıralama + Kart/Tablo + Sayfalama) */}
            <div className="lg:col-span-12 space-y-3.5 pt-2 border-t border-indigo-500/15">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 block">
                    {examTypeTab} Deneme Arşivim ({visibleExamsList.length} / {myFilteredExams.length})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Kart görünümünde ders detaylarını açmak için denemeye tıklayın, hızlı karşılaştırma için Tablo moduna geçin.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Arama */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Deneme adı veya tarih ara..."
                      value={examSearch}
                      onChange={(e) => setExamSearch(e.target.value)}
                      className="w-48 sm:w-56 pl-3 pr-7 py-1.5 rounded-xl bg-[#070b1a] border border-indigo-500/25 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    {examSearch && (
                      <button
                        type="button"
                        onClick={() => setExamSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[11px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Sıralama */}
                  <select
                    value={examSort}
                    onChange={(e) => setExamSort(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#070b1a] border border-indigo-500/25 text-xs font-bold text-cyan-200 focus:outline-none"
                  >
                    <option value="newest">En Yeni Tarih</option>
                    <option value="oldest">En Eski Tarih</option>
                    <option value="highest">En Yüksek Net</option>
                    <option value="lowest">En Düşük Net</option>
                  </select>

                  {/* Kart / Kompakt Tablo Geçişi */}
                  <div className="flex p-0.5 rounded-xl bg-[#070b1a] border border-indigo-500/25">
                    {[
                      { id: 'cards', label: 'Kartlar' },
                      { id: 'table', label: 'Kompakt Tablo' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setExamViewMode(m.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          examViewMode === m.id
                            ? 'bg-indigo-500/30 text-white border border-indigo-400/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {visibleExamsList.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#070b1a] border border-indigo-500/15 text-center text-xs text-slate-400">
                  Arama kriterine uygun deneme bulunamadı.
                </div>
              ) : examViewMode === 'cards' ? (
                /* KART GÖRÜNÜMÜ (Sayfalanmış + Akordeon) */
                <div className="grid md:grid-cols-2 gap-3">
                  {paginatedExams.map((ex) => {
                    const isExpanded = expandedExamId === ex.id;
                    const chronoDiff = examChronoDiffMap.get(ex.id);
                    return (
                      <div key={ex.id} className={`rounded-2xl bg-[#070b1a] border transition overflow-hidden ${isExpanded ? 'border-cyan-500/45 shadow-[0_0_20px_rgba(34,211,238,0.08)]' : 'border-indigo-500/20'}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedExamId(isExpanded ? null : ex.id)}
                          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#0d1430] transition text-left"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-white truncate">{ex.examName}</div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                              <span>{ex.date}</span>
                              {ex.aytTrack && <span className="text-fuchsia-300 font-bold">• {ex.aytTrack}</span>}
                              {typeof ex.totalD === 'number' && (
                                <span>
                                  • <strong className="text-emerald-400">{ex.totalD}D</strong> / <strong className="text-rose-400">{ex.totalY}Y</strong> / {ex.totalB}B
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {chronoDiff !== null && chronoDiff !== undefined && (
                              <span className={`text-[11px] font-mono font-extrabold ${chronoDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {chronoDiff >= 0 ? `+${chronoDiff}` : chronoDiff}
                              </span>
                            )}
                            <div className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border border-cyan-500/35 font-mono text-xs font-black text-cyan-300">
                              {Number(ex.totalNet).toFixed(2)} Net
                            </div>
                            <span className={`text-slate-400 text-xs transition-transform ${isExpanded ? 'rotate-180 text-cyan-300' : ''}`}>▾</span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-3.5 pt-2.5 border-t border-indigo-500/15 grid grid-cols-2 gap-2 bg-[#050814]/70">
                            {Object.entries(ex.sections || {}).map(([secKey, secVal]) => (
                              <div key={secKey} className="px-2.5 py-2 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-center justify-between text-xs">
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-200 block truncate capitalize">{secVal.label || secKey}</span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    <strong className="text-emerald-400">{secVal.d ?? 0}D</strong> • <strong className="text-rose-400">{secVal.y ?? 0}Y</strong>
                                    {typeof secVal.b === 'number' ? ` • ${secVal.b}B` : ''}
                                  </span>
                                </div>
                                <span className="font-mono font-black text-cyan-300 ml-2 shrink-0">
                                  {Number(secVal.net || 0).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* KOMPAKT TABLO GÖRÜNÜMÜ (Çoklu Denemeleri Tek Bakışta Kıyaslama) */
                <div className="overflow-x-auto rounded-2xl border border-indigo-500/20 bg-[#070b1a]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-indigo-500/20 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-[#0a1026]">
                        <th className="px-3.5 py-2.5 min-w-[180px]">Deneme &amp; Tarih</th>
                        {tableSubjectColumns.map((col) => (
                          <th key={col.key} className="px-2.5 py-2.5 text-center">
                            {getShortSubjectLabel(col.key, col.label)}
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-center">D/Y/B</th>
                        <th className="px-3 py-2.5 text-right">Net</th>
                        <th className="px-3 py-2.5 text-right">Fark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-500/10">
                      {paginatedExams.map((ex) => {
                        const chronoDiff = examChronoDiffMap.get(ex.id);
                        return (
                          <tr key={ex.id} className="hover:bg-[#0e1633] transition">
                            <td className="px-3.5 py-2.5">
                              <div className="font-bold text-white truncate max-w-[230px]">{ex.examName}</div>
                              <div className="text-[10px] font-mono text-slate-400">{ex.date}</div>
                            </td>
                            {tableSubjectColumns.map((col) => {
                              const sec = ex.sections?.[col.key];
                              if (!sec) {
                                return <td key={col.key} className="px-2.5 py-2.5 text-center text-slate-600 font-mono">—</td>;
                              }
                              return (
                                <td key={col.key} className="px-2.5 py-2.5 text-center font-mono">
                                  <div className="font-black text-cyan-300">{Number(sec.net || 0).toFixed(2)}</div>
                                  <div className="text-[9px] text-slate-500">{sec.d ?? 0}D/{sec.y ?? 0}Y</div>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5 text-center font-mono text-[10px] whitespace-nowrap">
                              <span className="text-emerald-400 font-bold">{ex.totalD ?? 0}</span>/
                              <span className="text-rose-400 font-bold">{ex.totalY ?? 0}</span>/
                              <span className="text-slate-400">{ex.totalB ?? 0}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-black text-white whitespace-nowrap">
                              {Number(ex.totalNet).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[11px] font-extrabold whitespace-nowrap">
                              {chronoDiff === null || chronoDiff === undefined ? (
                                <span className="text-slate-500">—</span>
                              ) : (
                                <span className={chronoDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {chronoDiff >= 0 ? `+${chronoDiff}` : chronoDiff}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sayfalama Çubuğu (Yalnızca 1 sayfadan fazla deneme varsa görünür) */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Sayfa <strong className="text-white">{safePage}</strong> / {totalPages} • Toplam {visibleExamsList.length} deneme
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setExamPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl bg-[#070b1a] hover:bg-[#111936] disabled:opacity-35 border border-indigo-500/25 text-slate-200 font-bold transition"
                    >
                      ← Önceki
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setExamPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-xl bg-[#070b1a] hover:bg-[#111936] disabled:opacity-35 border border-indigo-500/25 text-slate-200 font-bold transition"
                    >
                      Sonraki →
                    </button>
                  </div>
                </div>
              )}
            </div>
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