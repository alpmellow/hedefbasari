import React, { useState, useEffect, useMemo } from 'react';
import UserAvatar from '../common/UserAvatar';
import {
  GraduationCap, RefreshCw, Edit3, Trash2, UserPlus, Clock,
  Download, RotateCcw, CheckCircle2, XCircle, Key, ShieldCheck, FileCode
} from '../common/Icons';
import { HEDEFBASARI_CLASS_OPTIONS, DAYS_TR, HOURS_LIST, MAX_SLOT_QUOTA } from '../../constants';
import {
  getPurposeBadgeStyle, maskTcKimlik, generateRandom6DigitPin,
  generateRandom8CharKey, compressImageFromFile, getNextMidnightMs, getTodayDateKey, formatSlotLabel
} from '../../utils/helpers';
import { apiFetch } from '../../utils/api';

export default function AdminDashboardView({
  staff, setStaff,
  students, setStudents,
  appointments, setAppointments,
  assignments, setAssignments,
  adminAuth, setAdminAuth,
  lastDailyPurgeLabel, onTriggerDailyPurge,
  lastWeeklyResetLabel, onTriggerWeeklyReset,
  emitSocketEvent, onOpenDevOps
}) {
  const [activeTab, setActiveTab] = useState('students');
  const [nowMs, setNowMs] = useState(Date.now());
  const [animatingAction, setAnimatingAction] = useState({ id: null, type: null });

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [adminCredForm, setAdminCredForm] = useState({
    currentPassword: '',
    newUsername: adminAuth?.username || 'hedef_admin',
    newPassword: '',
    confirmPassword: '',
    photoUrl: adminAuth?.photoUrl || ''
  });
  const [adminCredAlert, setAdminCredAlert] = useState({ type: '', text: '' });

  useEffect(() => {
    if (adminAuth) {
      setAdminCredForm((prev) => ({
        ...prev,
        newUsername: adminAuth.username || 'hedef_admin',
        photoUrl: adminAuth.photoUrl || ''
      }));
    }
  }, [adminAuth?.username, adminAuth?.photoUrl]);

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [teacherForm, setTeacherForm] = useState({
    tcNo: '', fullName: '', branch: '', photoUrl: '', biography: '', securityKey: generateRandom8CharKey()
  });

  const [editingStudentId, setEditingStudentId] = useState(null);
  const [studentForm, setStudentForm] = useState({
    tcNo: '', fullName: '', className: HEDEFBASARI_CLASS_OPTIONS[0], paymentStatus: 'Ödendi', pin: generateRandom6DigitPin()
  });

  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('ALL');
  const [studentPaymentFilter, setStudentPaymentFilter] = useState('ALL');

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = studentSearchQuery.trim().toLocaleLowerCase('tr-TR');
      const matchesSearch =
        !q ||
        (s.fullName || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (s.tcNo || '').includes(q) ||
        (s.pin || '').includes(q);
      const matchesClass = studentClassFilter === 'ALL' || s.className === studentClassFilter;
      const matchesPayment = studentPaymentFilter === 'ALL' || s.paymentStatus === studentPaymentFilter;
      return matchesSearch && matchesClass && matchesPayment;
    });
  }, [students, studentSearchQuery, studentClassFilter, studentPaymentFilter]);

  const [scheduleTeacherId, setScheduleTeacherId] = useState(staff[0]?.id || '');
  const selectedTeacherForSchedule = staff.find((t) => t.id === scheduleTeacherId) || staff[0];

  const activeDeskAppointments = useMemo(() => appointments.filter((slot) => !slot.archivedFromDesk), [appointments]);

  const handleExportAppointments = () => {
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    let csvContent = '\uFEFF';
    csvContent += 'Öğretmen,Branş,Gün,Ders / Etüt Saati,Öğrenci Adı,Sınıf,Amaç,Konu Detayı,Durum\n';

    activeDeskAppointments.forEach((slot) => {
      slot.participants.forEach((p) => {
        if (p.status !== 'Rejected') {
          const lockedTopic = slot.sessionTopic || p.sessionTopic || (p.sessionType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');
          const pStatus = p.status === 'Approved' ? 'Onaylandı' : p.status === 'Proactive' ? 'Koç Çağırdı' : 'Bekliyor';
          csvContent += [
            escapeCsv(slot.teacherName),
            escapeCsv(slot.teacherBranch),
            escapeCsv(slot.day),
            escapeCsv(formatSlotLabel(slot.hourSlot)),
            escapeCsv(p.studentName),
            escapeCsv(p.studentClass),
            escapeCsv(p.sessionType),
            escapeCsv(lockedTopic),
            escapeCsv(pStatus)
          ].join(',') + '\n';
        }
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Randevu_Onay_Masasi_${getTodayDateKey()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateAdminCredentials = async (e) => {
    e.preventDefault();
    setAdminCredAlert({ type: '', text: '' });

    if (!adminCredForm.newUsername.trim()) {
      setAdminCredAlert({ type: 'error', text: 'Yeni kullanıcı adı boş bırakılamaz.' });
      return;
    }
    if (adminCredForm.newPassword && adminCredForm.newPassword !== adminCredForm.confirmPassword) {
      setAdminCredAlert({ type: 'error', text: 'Yeni şifre ile şifre tekrarı birbiriyle eşleşmiyor.' });
      return;
    }

    try {
      const res = await apiFetch('/api/admin/credentials', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: adminCredForm.currentPassword,
          newUsername: adminCredForm.newUsername.trim(),
          newPassword: adminCredForm.newPassword,
          photoUrl: adminCredForm.photoUrl
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAdminCredAlert({ type: 'error', text: data.error || 'Güncelleme başarısız oldu.' });
        return;
      }

      setAdminAuth(data.adminAuth);
      setAdminCredForm({
        currentPassword: '',
        newUsername: data.adminAuth.username,
        newPassword: '',
        confirmPassword: '',
        photoUrl: data.adminAuth.photoUrl || ''
      });
      setAdminCredAlert({ type: 'success', text: 'Yönetici profil fotoğrafınız, kullanıcı adınız ve şifreniz kalıcı olarak güncellendi!' });
      emitSocketEvent('admin:credentials_updated', `Yönetici profili güncellendi (${data.adminAuth.username}).`);
    } catch {
      setAdminCredAlert({ type: 'error', text: 'Sunucu bağlantı hatası.' });
    }
  };

  const handleSaveTeacher = (e) => {
    e.preventDefault();
    if (editingTeacherId) {
      setStaff((prev) => prev.map((t) => (t.id === editingTeacherId ? { ...t, ...teacherForm } : t)));
      emitSocketEvent('staff:updated', `Eğitmen güncellendi: ${teacherForm.fullName}`);
      setEditingTeacherId(null);
    } else {
      const newTeacher = {
        id: `teacher-${Date.now()}`,
        ...teacherForm,
        weeklySchedule: [
          { day: 'Pazartesi', hourSlot: 6, status: 'free' },
          { day: 'Çarşamba', hourSlot: 6, status: 'free' },
          { day: 'Perşembe', hourSlot: 7, status: 'free' }
        ]
      };
      setStaff((prev) => [newTeacher, ...prev]);
      emitSocketEvent('staff:updated', `Yeni eğitmen eklendi: ${newTeacher.fullName}`);
    }
    setTeacherForm({ tcNo: '', fullName: '', branch: '', photoUrl: '', biography: '', securityKey: generateRandom8CharKey() });
  };

  const handleEditTeacherClick = (teacher) => {
    setEditingTeacherId(teacher.id);
    setTeacherForm({
      tcNo: teacher.tcNo, fullName: teacher.fullName, branch: teacher.branch, photoUrl: teacher.photoUrl || '', biography: teacher.biography, securityKey: teacher.securityKey
    });
  };

  const handleDeleteTeacher = (teacherId, fullName) => {
    setStaff((prev) => prev.filter((t) => t.id !== teacherId));
    emitSocketEvent('staff:deleted', `${fullName} kadrodan çıkarıldı.`);
  };

  const handleSaveStudent = (e) => {
    e.preventDefault();
    if (editingStudentId) {
      setStudents((prev) => prev.map((s) => (s.id === editingStudentId ? { ...s, ...studentForm } : s)));
      setAppointments((prev) =>
        prev.map((slot) => ({
          ...slot,
          participants: slot.participants.map((p) =>
            p.studentId === editingStudentId ? { ...p, studentName: studentForm.fullName, studentClass: studentForm.className } : p
          )
        }))
      );
      setAssignments((prev) => prev.map((a) => (a.studentId === editingStudentId ? { ...a, studentName: studentForm.fullName } : a)));
      emitSocketEvent('students:updated', `Öğrenci bilgileri güncellendi: ${studentForm.fullName}`);
      setEditingStudentId(null);
    } else {
      const newStudent = { id: `student-${Date.now()}`, ...studentForm };
      setStudents((prev) => [newStudent, ...prev]);
      emitSocketEvent('students:registered', `Yeni öğrenci kaydedildi: ${newStudent.fullName}`);
    }
    setStudentForm({ tcNo: '', fullName: '', className: HEDEFBASARI_CLASS_OPTIONS[0], paymentStatus: 'Ödendi', pin: generateRandom6DigitPin() });
  };

  const handleEditStudentClick = (student) => {
    setEditingStudentId(student.id);
    setStudentForm({
      tcNo: student.tcNo,
      fullName: student.fullName,
      className: HEDEFBASARI_CLASS_OPTIONS.includes(student.className) ? student.className : HEDEFBASARI_CLASS_OPTIONS[0],
      paymentStatus: student.paymentStatus,
      pin: student.pin
    });
  };

  const handleCancelEditStudent = () => {
    setEditingStudentId(null);
    setStudentForm({ tcNo: '', fullName: '', className: HEDEFBASARI_CLASS_OPTIONS[0], paymentStatus: 'Ödendi', pin: generateRandom6DigitPin() });
  };

  const handleDeleteStudent = (studentId, fullName) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    if (editingStudentId === studentId) handleCancelEditStudent();
    emitSocketEvent('students:deleted', `Öğrenci kaydı silindi: ${fullName}`);
  };

  const handleToggleScheduleCell = (day, hourSlot) => {
    if (!selectedTeacherForSchedule) return;
    setStaff((prev) =>
      prev.map((t) => {
        if (t.id !== selectedTeacherForSchedule.id) return t;
        const currentList = t.weeklySchedule || [];
        const existing = currentList.find((s) => s.day === day && s.hourSlot === hourSlot);
        let updated;
        if (!existing) {
          updated = [...currentList, { day, hourSlot, status: 'free' }];
        } else if (existing.status === 'free') {
          updated = currentList.map((s) => (s.day === day && s.hourSlot === hourSlot ? { ...s, status: 'occupied' } : s));
        } else {
          updated = currentList.filter((s) => !(s.day === day && s.hourSlot === hourSlot));
        }
        return { ...t, weeklySchedule: updated };
      })
    );
    emitSocketEvent('schedule:updated', `${selectedTeacherForSchedule.fullName} — ${day} ${formatSlotLabel(hourSlot)} ders programı güncellendi.`);
  };

  const handleParticipantDecision = (slotId, studentId, decision) => {
    setAnimatingAction({ id: `${slotId}-${studentId}`, type: decision === 'Approved' ? 'approve' : 'reject' });

    setTimeout(() => {
      let targetStudentName = '';
      let slotInfo = '';
      setAppointments((prev) =>
        prev.map((slot) => {
          if (slot.id !== slotId) return slot;
          slotInfo = `${slot.teacherName} (${slot.day} ${formatSlotLabel(slot.hourSlot)})`;
          return {
            ...slot,
            participants: slot.participants.map((p) => {
              if (p.studentId !== studentId) return p;
              targetStudentName = p.studentName;
              return { ...p, status: decision };
            })
          };
        })
      );

      emitSocketEvent('appointments:decision', `Randevu ${decision === 'Approved' ? 'ONAYLANDI' : 'REDDEDİLDİ'}: ${targetStudentName} — ${slotInfo}`, {
        targetUserId: studentId,
        title: decision === 'Approved' ? 'Randevunuz Onaylandı' : 'Randevu Talebi Reddedildi',
        message: `${slotInfo} etüt talebiniz yönetici tarafından ${decision === 'Approved' ? 'onaylandı' : 'reddedildi'}.`,
        type: decision === 'Approved' ? 'success' : 'error',
        category: 'appointment'
      });

      setAnimatingAction({ id: null, type: null });
    }, 500);
  };

  const formatMidnightCountdown = () => {
    const diff = Math.max(0, getNextMidnightMs() - nowMs);
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);
    return `${String(h).padStart(2, '0')}s ${String(m).padStart(2, '0')}dk ${String(s).padStart(2, '0')}sn`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">Tam Yetkili Yönetim Merkezi</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">HedefBaşarı Admin Paneli</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'students', label: `1. Öğrenci Yönetimi (${students.length})` },
            { id: 'staff', label: `2. Kadro Yönetimi (${staff.length})` },
            { id: 'schedule', label: '3. Ders Programı Matrisi' },
            { id: 'approvals', label: `4. Randevu Onay Masası (${activeDeskAppointments.length})` },
            { id: 'security', label: '5. Yönetici Güvenlik & Profil' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === tab.id ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'students' && (
        <div className="grid lg:grid-cols-3 gap-8">
          <form onSubmit={handleSaveStudent} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-cyan-400" />
                {editingStudentId ? 'Kayıtlı Öğrenciyi Düzenle' : 'Yeni Öğrenci Kaydı'}
              </h2>
              {editingStudentId && <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300">Düzenleme</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">11 Haneli TC Kimlik No</label>
              <input type="text" maxLength={11} required placeholder="Örn: 30000000512" value={studentForm.tcNo} onChange={(e) => setStudentForm({ ...studentForm, tcNo: e.target.value.replace(/\D/g, '') })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Ad Soyad</label>
              <input type="text" required placeholder="Örn: Canan Özkan" value={studentForm.fullName} onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-bold text-cyan-300 mb-1">Sınıf Seçimi</label>
              <select value={studentForm.className} onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-sm font-bold text-white focus:outline-none">
                {HEDEFBASARI_CLASS_OPTIONS.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Ödeme Durumu</label>
              <select value={studentForm.paymentStatus} onChange={(e) => setStudentForm({ ...studentForm, paymentStatus: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm">
                <option value="Ödendi">Ödendi</option>
                <option value="Taksit Devam Ediyor">Taksit Devam Ediyor</option>
                <option value="Ödeme Gecikmiş">Ödeme Gecikmiş</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">6 Haneli Öğrenci Şifresi (PIN)</label>
              <div className="flex gap-2">
                <input type="text" readOnly value={studentForm.pin} className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-400 font-bold text-sm" />
                <button type="button" onClick={() => setStudentForm({ ...studentForm, pin: generateRandom6DigitPin() })} className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Üret
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition">
                {editingStudentId ? 'Değişiklikleri Kaydet' : 'Öğrenciyi Kaydet'}
              </button>
              {editingStudentId && (
                <button type="button" onClick={handleCancelEditStudent} className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">İptal</button>
              )}
            </div>
          </form>

          <div className="lg:col-span-2 space-y-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ad soyad, TC No veya Şifre (PIN) ile ara..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500/50 focus:outline-none text-xs text-white"
                />
                {studentSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setStudentSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={studentClassFilter}
                onChange={(e) => setStudentClassFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-cyan-300 focus:outline-none"
              >
                <option value="ALL">Tüm Sınıflar</option>
                {HEDEFBASARI_CLASS_OPTIONS.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>

              <select
                value={studentPaymentFilter}
                onChange={(e) => setStudentPaymentFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="ALL">Tüm Ödemeler</option>
                <option value="Ödendi">Ödendi</option>
                <option value="Taksit Devam Ediyor">Taksit Devam Ediyor</option>
                <option value="Ödeme Gecikmiş">Ödeme Gecikmiş</option>
              </select>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                Arama kriterlerinize uygun öğrenci bulunamadı.
              </div>
            ) : (
              filteredStudents.map((s) => (
                <div key={s.id} className={`p-5 rounded-2xl bg-slate-900 border transition flex flex-wrap items-center justify-between gap-4 ${editingStudentId === s.id ? 'border-amber-500/70 ring-1 ring-amber-500/30' : 'border-slate-800'}`}>
                  <div className="flex items-center gap-3.5">
                    <UserAvatar src="" name={s.fullName} className="w-11 h-11" ringClass="ring-2 ring-cyan-500/30" textClass="text-xs" />
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-extrabold text-white">{s.fullName}</h3>
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-300">{s.className}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-slate-400 font-mono">
                        <span>TC: {maskTcKimlik(s.tcNo)}</span>
                        <span>Şifre: <strong className="text-emerald-400">{s.pin}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.paymentStatus === 'Ödendi' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {s.paymentStatus}
                    </span>
                    <button onClick={() => handleEditStudentClick(s)} className="px-3 py-2 rounded-xl bg-slate-800 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition">
                      <Edit3 className="w-3.5 h-3.5" /> Düzenle
                    </button>
                    <button onClick={() => handleDeleteStudent(s.id, s.fullName)} className="p-2 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="grid lg:grid-cols-3 gap-8">
          <form onSubmit={handleSaveTeacher} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 h-fit">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              {editingTeacherId ? 'Eğitmeni Düzenle' : 'Yeni Eğitmen Ekle'}
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">11 Haneli TC No</label>
              <input type="text" maxLength={11} required placeholder="Örn: 60000000142" value={teacherForm.tcNo} onChange={(e) => setTeacherForm({ ...teacherForm, tcNo: e.target.value.replace(/\D/g, '') })} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Ad Soyad & Ünvan</label>
              <input type="text" required placeholder="Örn: Prof. Dr. Kemal Aydın" value={teacherForm.fullName} onChange={(e) => setTeacherForm({ ...teacherForm, fullName: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Branş</label>
              <input type="text" required placeholder="Örn: AYT Biyoloji & Genetik" value={teacherForm.branch} onChange={(e) => setTeacherForm({ ...teacherForm, branch: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm" />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <label className="block text-xs font-bold text-amber-300">Profil Fotoğrafı (Masaüstünden Seç)</label>
              <div className="flex items-center gap-3">
                <UserAvatar src={teacherForm.photoUrl} name={teacherForm.fullName || 'Yeni Eğitmen'} className="w-14 h-14" rounded="rounded-full" ringClass="ring-2 ring-amber-400/60" textClass="text-sm" />
                <div className="flex-1 space-y-1.5">
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    compressImageFromFile(file, (dataUrl) => { setTeacherForm((prev) => ({ ...prev, photoUrl: dataUrl })); });
                  }} className="w-full text-xs text-slate-300 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-300 cursor-pointer" />
                  {teacherForm.photoUrl && (
                    <button type="button" onClick={() => setTeacherForm((prev) => ({ ...prev, photoUrl: '' }))} className="text-[11px] text-rose-400 hover:underline font-bold">Fotoğrafı Kaldır</button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Kısa Biyografi</label>
              <textarea rows={3} required placeholder="Özgeçmiş..." value={teacherForm.biography} onChange={(e) => setTeacherForm({ ...teacherForm, biography: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">8 Haneli Güvenlik Anahtarı</label>
              <div className="flex gap-2">
                <input type="text" readOnly value={teacherForm.securityKey} className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-cyan-400 font-bold text-sm" />
                <button type="button" onClick={() => setTeacherForm({ ...teacherForm, securityKey: generateRandom8CharKey() })} className="px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Üret</button>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition">
                {editingTeacherId ? 'Değişiklikleri Kaydet' : 'Kadroyu Kaydet & Yayınla'}
              </button>
              {editingTeacherId && (
                <button type="button" onClick={() => { setEditingTeacherId(null); setTeacherForm({ tcNo: '', fullName: '', branch: '', photoUrl: '', biography: '', securityKey: generateRandom8CharKey() }); }} className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">İptal</button>
              )}
            </div>
          </form>

          <div className="lg:col-span-2 space-y-4">
            {staff.map((t) => (
              <div key={t.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <UserAvatar src={t.photoUrl} name={t.fullName} className="w-16 h-16" rounded="rounded-full" ringClass="ring-2 ring-indigo-500/50" textClass="text-lg" />
                  <div>
                    <span className="text-xs font-bold text-indigo-400">{t.branch}</span>
                    <h3 className="text-base font-extrabold text-white">{t.fullName}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400 font-mono">
                      <span>TC: {maskTcKimlik(t.tcNo)}</span>
                      <span>Anahtar: <strong className="text-cyan-300">{t.securityKey}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleEditTeacherClick(t)} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /> Düzenle</button>
                  <button onClick={() => handleDeleteTeacher(t.id, t.fullName)} className="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Sil</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-white">Haftalık Ders & Etüt Programı Matrisi (08:30 – 17:30)</h2>
              <p className="text-xs text-slate-400">Sabah 5 ders (08:30-12:30), Öğle Arası (12:30-13:30) ve Öğleden Sonra 5 Ders/Etüt (13:30-17:30).</p>
            </div>
            <select value={selectedTeacherForSchedule?.id || ''} onChange={(e) => setScheduleTeacherId(e.target.value)} className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-cyan-300">
              {staff.map((t) => (<option key={t.id} value={t.id}>{t.fullName} ({t.branch})</option>))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-3 min-w-[100px]">Gün / Saat</th>
                  {HOURS_LIST.map((h) => (
                    <React.Fragment key={h.slot}>
                      {h.slot === 6 && (
                        <th className="py-2 px-1.5 text-center bg-amber-500/10 border-x border-amber-500/20 text-amber-300 font-extrabold text-[10px]">
                          ÖĞLE ARASI<br />
                          <span className="font-mono text-[9px] text-amber-400/80">12:30-13:30</span>
                        </th>
                      )}
                      <th className="py-2.5 px-1.5 text-center">
                        <div className="font-extrabold text-slate-200 text-[11px]">{h.title}</div>
                        <div className="font-mono text-[10px] text-cyan-400">{h.range}</div>
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS_TR.map((day) => (
                  <tr key={day} className="border-b border-slate-800/60">
                    <td className="py-3 px-3 font-extrabold text-white">{day}</td>
                    {HOURS_LIST.map((h) => {
                      const entry = (selectedTeacherForSchedule?.weeklySchedule || []).find((s) => s.day === day && s.hourSlot === h.slot);
                      return (
                        <React.Fragment key={h.slot}>
                          {h.slot === 6 && (
                            <td className="p-1 bg-amber-500/5 border-x border-amber-500/15 text-center font-bold text-[10px] text-amber-500/60 select-none">
                              ARA
                            </td>
                          )}
                          <td className="p-1">
                            <button type="button" onClick={() => handleToggleScheduleCell(day, h.slot)} className={`w-full py-2.5 px-1 rounded-xl font-extrabold text-[11px] transition ${entry?.status === 'free' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : entry?.status === 'occupied' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-950 text-slate-600 border border-slate-800/60'}`}>
                              {entry?.status === 'free' ? 'BOŞ (ETÜT)' : entry?.status === 'occupied' ? 'DERS / DOLU' : '—'}
                            </button>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                <Clock className="w-4 h-4" /> Gece 00:00 Sunucu Otonom Randevu Onay Masası Temizleme Aktif
              </div>
              <p className="text-xs text-slate-300">
                Her gece saat <strong>00:00</strong>'da sunucu arka planda onay masasını arşivler (Haftalık 12'li öğrenci kotaları korunur). Son işlem: <strong className="text-cyan-300">{lastDailyPurgeLabel}</strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">00:00 Temizliğe Kalan</span>
                <span className="font-mono text-sm font-extrabold text-amber-400">{formatMidnightCountdown()}</span>
              </div>
              <button type="button" onClick={handleExportAppointments} className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center gap-2 transition">
                <Download className="w-4 h-4" /> Günün Çıktısını Al (Excel/CSV)
              </button>
              <button type="button" onClick={onTriggerDailyPurge} className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-extrabold flex items-center gap-2 transition">
                <RotateCcw className="w-4 h-4" /> Masayı Şimdi Arşivle & Temizle
              </button>
            </div>
          </div>

          {activeDeskAppointments.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">Randevu Onay Masası şu an tertemiz (0 aktif talep).</div>
          ) : (
            activeDeskAppointments.map((slot) => {
              const activeCount = slot.participants.filter((p) => p.status !== 'Rejected').length;
              const teacherObj = staff.find((t) => t.id === slot.teacherId);
              const lockedTopic = slot.sessionTopic || slot.participants[0]?.sessionTopic || (slot.sessionType === 'Soru Çözümü' ? 'Genel Soru Çözümü' : 'Belirtilmedi');
              const maxCap = slot.maxQuota || MAX_SLOT_QUOTA;

              return (
                <div key={slot.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={teacherObj?.photoUrl} name={slot.teacherName} className="w-11 h-11" rounded="rounded-full" ringClass="ring-2 ring-cyan-500/40" />
                      <div>
                        <span className="text-xs font-bold text-cyan-400">{slot.teacherBranch}</span>
                        <h3 className="text-lg font-extrabold text-white">{slot.teacherName} — {slot.day}, {formatSlotLabel(slot.hourSlot)}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        Konu: {lockedTopic}
                      </span>
                      <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold ${activeCount >= maxCap ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-950 text-slate-300 border border-slate-800'}`}>
                        Kota: {activeCount} / {maxCap} Öğrenci
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {slot.participants.map((p) => (
                      <div
                        key={p.studentId}
                        className={`py-3 px-2 rounded-lg flex flex-wrap items-center justify-between gap-3 text-sm transition-all duration-500 ease-out transform ${
                          animatingAction.id === `${slot.id}-${p.studentId}`
                            ? animatingAction.type === 'approve'
                              ? 'scale-[1.02] bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10 relative'
                              : 'scale-[0.98] bg-rose-500/20 translate-x-3 opacity-60 z-10 relative'
                            : 'scale-100 bg-transparent opacity-100'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-bold text-white">{p.studentName}</span>
                          <span className="text-xs text-slate-400">({p.studentClass})</span>
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${getPurposeBadgeStyle(p.sessionType)}`}>{p.sessionType}</span>
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${p.status === 'Approved' || p.status === 'Proactive' ? 'bg-emerald-500/15 text-emerald-300' : p.status === 'Rejected' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
                            {p.status === 'Approved' ? 'Onaylandı' : p.status === 'Rejected' ? 'Reddedildi' : p.status === 'Proactive' ? 'Koç Çağrısı' : 'Bekliyor'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleParticipantDecision(slot.id, p.studentId, 'Approved')} className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Onayla</button>
                          <button onClick={() => handleParticipantDecision(slot.id, p.studentId, 'Rejected')} className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Reddet</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid lg:grid-cols-2 gap-8">
          <form onSubmit={handleUpdateAdminCredentials} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
              <Key className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-lg font-extrabold text-white">Yönetici Profil Fotoğrafı, Kullanıcı Adı & Şifre</h2>
                <p className="text-xs text-slate-400">Şifreniz sunucuda bcrypt ile geri döndürülemez biçimde hashlenerek saklanır.</p>
              </div>
            </div>

            {adminCredAlert.text && (
              <div className={`p-3.5 rounded-xl text-xs font-bold ${adminCredAlert.type === 'error' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{adminCredAlert.text}</div>
            )}

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-4">
              <UserAvatar src={adminCredForm.photoUrl} name={adminCredForm.newUsername || 'Yönetici'} className="w-16 h-16" rounded="rounded-full" ringClass="ring-2 ring-amber-400" textClass="text-base" />
              <div className="flex-1 space-y-1.5">
                <label className="block text-xs font-bold text-amber-300">Yönetici Profil Resmi (Masaüstünden Seç)</label>
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  compressImageFromFile(file, (dataUrl) => { setAdminCredForm((prev) => ({ ...prev, photoUrl: dataUrl })); });
                }} className="w-full text-xs text-slate-300 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:bg-amber-500/20 file:text-amber-300 cursor-pointer" />
                {adminCredForm.photoUrl && <button type="button" onClick={() => setAdminCredForm((prev) => ({ ...prev, photoUrl: '' }))} className="text-[11px] text-rose-400 hover:underline font-bold">Fotoğrafı Kaldır</button>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yeni Yönetici Kullanıcı Adı</label>
              <input type="text" required value={adminCredForm.newUsername} onChange={(e) => setAdminCredForm({ ...adminCredForm, newUsername: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Mevcut Yönetici Şifreniz (Doğrulama İçin Zorunlu)</label>
              <input type="password" required placeholder="Mevcut şifreniz" value={adminCredForm.currentPassword} onChange={(e) => setAdminCredForm({ ...adminCredForm, currentPassword: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-amber-300 font-mono" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yeni Şifre (Değiştirmeyecekseniz boş bırakın)</label>
              <input type="password" placeholder="Yeni şifreniz" value={adminCredForm.newPassword} onChange={(e) => setAdminCredForm({ ...adminCredForm, newPassword: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-cyan-300 font-mono" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yeni Şifre Tekrarı</label>
              <input type="password" placeholder="Yeni şifrenizi doğrulayın" value={adminCredForm.confirmPassword} onChange={(e) => setAdminCredForm({ ...adminCredForm, confirmPassword: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-cyan-300 font-mono" />
            </div>

            <button type="submit" className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition">
              Yönetici Profilini Kalıcı Olarak Güncelle
            </button>
          </form>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 h-fit">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Sunucu & Altyapı Bilgileri
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Aktif yönetici kullanıcı adınız: <strong className="text-amber-300 font-mono">{adminAuth.username}</strong>. Haftalık sıfırlama her Pazartesi 00:00'da, günlük temizlik ise her gece 00:00'da sunucu arkasında otonom çalışır.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" onClick={onTriggerWeeklyReset} className="px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-extrabold flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Haftalık Etüt & Ödevleri Şimdi Sıfırla
              </button>
              <button type="button" onClick={onOpenDevOps} className="px-4 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 text-xs font-extrabold flex items-center gap-2">
                <FileCode className="w-4 h-4" /> Sunucu & Docker Kodları
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}