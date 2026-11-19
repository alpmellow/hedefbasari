import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle } from '../common/Icons';

const TYT_SECTIONS = [
  { key: 'turkce', label: 'Türkçe', max: 40 },
  { key: 'sosyal', label: 'Sosyal Bilimler', max: 20 },
  { key: 'matematik', label: 'Temel Matematik', max: 40 },
  { key: 'fen', label: 'Fen Bilimleri', max: 20 }
];

const AYT_TRACK_SECTIONS = {
  SAY: [
    { key: 'matematik', label: 'AYT Matematik', max: 40 },
    { key: 'fizik', label: 'Fizik', max: 14 },
    { key: 'kimya', label: 'Kimya', max: 13 },
    { key: 'biyoloji', label: 'Biyoloji', max: 13 }
  ],
  EA: [
    { key: 'matematik', label: 'AYT Matematik', max: 40 },
    { key: 'edebiyat', label: 'Türk Dili ve Ed.', max: 24 },
    { key: 'tarih1', label: 'Tarih-1', max: 10 },
    { key: 'cografya1', label: 'Coğrafya-1', max: 6 }
  ],
  SOZ: [
    { key: 'edebiyat', label: 'Türk Dili ve Ed.', max: 24 },
    { key: 'tarih1', label: 'Tarih-1', max: 10 },
    { key: 'cografya1', label: 'Coğrafya-1', max: 6 },
    { key: 'tarih2', label: 'Tarih-2', max: 11 },
    { key: 'cografya2', label: 'Coğrafya-2', max: 11 },
    { key: 'felsefe', label: 'Felsefe Grubu', max: 12 },
    { key: 'din', label: 'Din Kültürü', max: 6 }
  ]
};

function detectTrackFromClass(className = '') {
  const upper = className.toLocaleUpperCase('tr-TR');
  if (upper.includes('EA') || upper.includes('EŞİT')) return 'EA';
  if (upper.includes('SÖZ') || upper.includes('SOZ')) return 'SOZ';
  return 'SAY';
}

function normalizeExamKey(name = '') {
  return String(name).trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

export default function ExamEntryModal({
  isOpen,
  onClose,
  students = [],
  existingExams = [],
  editingExam = null,
  defaultStudentId = '',
  defaultExamType = 'TYT',
  onSaveExam
}) {
  const [studentId, setStudentId] = useState(defaultStudentId || students[0]?.id || '');
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState(defaultExamType || 'TYT');
  const [aytTrack, setAytTrack] = useState('SAY');
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState({});
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const isEditMode = Boolean(editingExam);

  useEffect(() => {
    if (!isOpen) return;

    if (editingExam) {
      setStudentId(editingExam.studentId || students[0]?.id || '');
      setExamName(editingExam.examName || '');
      setExamType(editingExam.examType || 'TYT');
      const st = students.find((s) => s.id === editingExam.studentId);
      setAytTrack(editingExam.aytTrack || detectTrackFromClass(st?.className));
      setExamDate(editingExam.date || new Date().toISOString().slice(0, 10));

      const prefilledScores = {};
      Object.entries(editingExam.sections || {}).forEach(([k, v]) => {
        prefilledScores[k] = {
          d: v.d !== undefined && v.d !== null ? String(v.d) : '',
          y: v.y !== undefined && v.y !== null ? String(v.y) : ''
        };
      });
      setScores(prefilledScores);
      setFeedback({ type: '', text: '' });
    } else {
      const initialId = (defaultStudentId && defaultStudentId !== 'ALL')
        ? defaultStudentId
        : (students[0]?.id || '');
      setStudentId(initialId);
      setExamName('');
      setExamType(defaultExamType || 'TYT');
      const st = students.find((s) => s.id === initialId);
      if (st) setAytTrack(detectTrackFromClass(st.className));
      setExamDate(new Date().toISOString().slice(0, 10));
      setScores({});
      setFeedback({ type: '', text: '' });
    }
  }, [isOpen, editingExam, defaultStudentId, defaultExamType, students]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) || students[0],
    [students, studentId]
  );

  const activeSections = useMemo(
    () => (examType === 'TYT' ? TYT_SECTIONS : (AYT_TRACK_SECTIONS[aytTrack] || AYT_TRACK_SECTIONS.SAY)),
    [examType, aytTrack]
  );

  const enteredStudentIdsForCurrentExam = useMemo(() => {
    const key = normalizeExamKey(examName);
    if (!key) return new Set();
    return new Set(
      existingExams
        .filter((ex) => ex.id !== editingExam?.id && ex.examType === examType && normalizeExamKey(ex.examName) === key)
        .map((ex) => ex.studentId)
    );
  }, [existingExams, editingExam, examName, examType]);

  const isDuplicateForSelected = Boolean(selectedStudent && enteredStudentIdsForCurrentExam.has(selectedStudent.id));

  const handleStudentChange = (nextId) => {
    setStudentId(nextId);
    const st = students.find((s) => s.id === nextId);
    if (st) setAytTrack(detectTrackFromClass(st.className));
    setFeedback({ type: '', text: '' });
  };

  const handleScoreChange = (secKey, field, rawVal) => {
    const clean = rawVal === '' ? '' : Math.max(0, parseInt(rawVal, 10) || 0);
    setScores((prev) => ({
      ...prev,
      [secKey]: { ...(prev[secKey] || { d: '', y: '' }), [field]: clean }
    }));
  };

  const calculatedPreview = useMemo(() => {
    let totalD = 0;
    let totalY = 0;
    let totalB = 0;
    let totalNet = 0;
    let maxPossible = 0;
    let hasError = false;
    const sectionMap = {};

    activeSections.forEach((sec) => {
      const d = Number(scores[sec.key]?.d) || 0;
      const y = Number(scores[sec.key]?.y) || 0;
      const overflow = d + y > sec.max;
      if (overflow) hasError = true;
      const b = Math.max(0, sec.max - d - y);
      const net = Number((d - y / 4).toFixed(2));

      totalD += d;
      totalY += y;
      totalB += b;
      totalNet += net;
      maxPossible += sec.max;

      sectionMap[sec.key] = { label: sec.label, max: sec.max, d, y, b, net, overflow };
    });

    return {
      sections: sectionMap,
      totalD,
      totalY,
      totalB,
      totalNet: Number(totalNet.toFixed(2)),
      maxPossible,
      hasError
    };
  }, [activeSections, scores]);

  if (!isOpen) return null;

  const submitExam = (moveToNextStudent) => {
    setFeedback({ type: '', text: '' });
    const cleanExamName = examName.trim().replace(/\s+/g, ' ');

    if (!selectedStudent) {
      setFeedback({ type: 'error', text: 'Lütfen kayıtlı bir öğrenci seçin.' });
      return;
    }
    if (!cleanExamName) {
      setFeedback({ type: 'error', text: 'Deneme sınavı adı boş bırakılamaz (Örn: Özdebir TYT-4).' });
      return;
    }
    if (isDuplicateForSelected) {
      setFeedback({
        type: 'error',
        text: `${selectedStudent.fullName} için "${cleanExamName}" (${examType}) sonucu zaten kayıtlı.`
      });
      return;
    }
    if (calculatedPreview.hasError) {
      setFeedback({ type: 'error', text: 'Doğru + Yanlış toplamı ilgili dersin soru sayısını aşamaz!' });
      return;
    }
    if (calculatedPreview.totalD === 0 && calculatedPreview.totalY === 0) {
      setFeedback({ type: 'error', text: 'En az bir ders için Doğru veya Yanlış sayısı girmelisiniz.' });
      return;
    }

    const cleanSections = {};
    Object.entries(calculatedPreview.sections).forEach(([k, v]) => {
      cleanSections[k] = { label: v.label, max: v.max, d: v.d, y: v.y, b: v.b, net: v.net };
    });

    const examRecord = {
      id: isEditMode ? editingExam.id : `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.fullName,
      studentClass: selectedStudent.className,
      examName: cleanExamName,
      examType,
      aytTrack: examType === 'AYT' ? aytTrack : null,
      date: examDate || new Date().toISOString().slice(0, 10),
      createdAt: isEditMode ? (editingExam.createdAt || Date.now()) : Date.now(),
      sections: cleanSections,
      totalD: calculatedPreview.totalD,
      totalY: calculatedPreview.totalY,
      totalB: calculatedPreview.totalB,
      totalNet: calculatedPreview.totalNet,
      maxPossible: calculatedPreview.maxPossible
    };

    onSaveExam(examRecord, isEditMode);

    if (!isEditMode && moveToNextStudent && students.length > 1) {
      const updatedEntered = new Set(enteredStudentIdsForCurrentExam);
      updatedEntered.add(selectedStudent.id);

      const currentIdx = students.findIndex((s) => s.id === selectedStudent.id);
      let nextUnentered = null;
      for (let offset = 1; offset < students.length; offset += 1) {
        const candidate = students[(currentIdx + offset) % students.length];
        if (!updatedEntered.has(candidate.id)) {
          nextUnentered = candidate;
          break;
        }
      }

      setScores({});
      if (nextUnentered) {
        setStudentId(nextUnentered.id);
        setAytTrack(detectTrackFromClass(nextUnentered.className));
        setFeedback({
          type: 'success',
          text: `${selectedStudent.fullName} (${examRecord.totalNet} Net) kaydedildi. Sıradaki: ${nextUnentered.fullName}`
        });
      } else {
        setFeedback({
          type: 'success',
          text: `${selectedStudent.fullName} (${examRecord.totalNet} Net) kaydedildi. Listedeki tüm öğrencilerin "${cleanExamName}" girişi tamamlandı!`
        });
      }
    } else {
      setScores({});
      setExamName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-3xl bg-[#0c1228] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.18)] overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-[#111936] via-[#131d42] to-[#191538] border-b border-indigo-500/20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isEditMode ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'}`} />
              <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isEditMode ? 'text-amber-300' : 'text-cyan-300'}`}>
                {isEditMode ? 'Kayıt Düzenleme Modu' : 'Merkezi Veri Girişi • Seri Mod Destekli'}
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-0.5">
              {isEditMode ? 'Deneme Sınavı Sonucunu Güncelle' : 'Yeni Deneme Sınavı Sonucu Ekle'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-400 hover:text-white transition"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {feedback.text && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                feedback.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-400">Öğrenci Seçimi</label>
                {!isEditMode && examName.trim() && (
                  <span className="text-[10px] font-mono text-cyan-300">
                    Girilen: {enteredStudentIdsForCurrentExam.size} / {students.length}
                  </span>
                )}
              </div>
              <select
                value={studentId}
                disabled={isEditMode}
                onChange={(e) => handleStudentChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070b1a] border border-indigo-500/30 text-sm font-bold text-white disabled:opacity-70 focus:outline-none focus:border-cyan-400"
              >
                {students.map((s) => {
                  const alreadyEntered = !isEditMode && enteredStudentIdsForCurrentExam.has(s.id);
                  return (
                    <option key={s.id} value={s.id}>
                      {alreadyEntered ? '✓ ' : ''}{s.fullName} — {s.className}{alreadyEntered ? ' (Kayıtlı)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Deneme Sınavı Adı</label>
              <input
                type="text"
                maxLength={80}
                placeholder="Örn: Özdebir TYT-4"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070b1a] border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Sınav Tarihi</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070b1a] border border-slate-800 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#070b1a] border border-slate-800/80">
            <div className="flex items-center gap-2">
              {['TYT', 'AYT'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setExamType(type);
                    setScores({});
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition ${
                    examType === type
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.35)]'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {type} Oturumu
                </button>
              ))}
            </div>

            {examType === 'AYT' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Alan:</span>
                {[
                  { id: 'SAY', label: 'Sayısal' },
                  { id: 'EA', label: 'Eşit Ağırlık' },
                  { id: 'SOZ', label: 'Sözel' }
                ].map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => {
                      setAytTrack(tr.id);
                      setScores({});
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      aytTrack === tr.id
                        ? 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              <span className="col-span-5">Ders (Soru)</span>
              <span className="col-span-2 text-center text-emerald-400">Doğru</span>
              <span className="col-span-2 text-center text-rose-400">Yanlış</span>
              <span className="col-span-1 text-center text-slate-500">Boş</span>
              <span className="col-span-2 text-right text-cyan-300">Net</span>
            </div>

            {activeSections.map((sec) => {
              const info = calculatedPreview.sections[sec.key];
              return (
                <div
                  key={sec.key}
                  className={`grid grid-cols-12 items-center gap-2 px-3 py-2 rounded-xl border transition ${
                    info.overflow
                      ? 'bg-rose-950/30 border-rose-500/60'
                      : 'bg-[#080d20] border-indigo-500/15'
                  }`}
                >
                  <div className="col-span-5">
                    <span className="text-xs font-bold text-slate-100">{sec.label}</span>
                    <span className="ml-1.5 text-[10px] font-mono text-slate-500">({sec.max})</span>
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      max={sec.max}
                      placeholder="0"
                      value={scores[sec.key]?.d ?? ''}
                      onChange={(e) => handleScoreChange(sec.key, 'd', e.target.value)}
                      className="w-full py-1.5 rounded-lg bg-slate-950 border border-emerald-500/25 text-center font-mono text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      max={sec.max}
                      placeholder="0"
                      value={scores[sec.key]?.y ?? ''}
                      onChange={(e) => handleScoreChange(sec.key, 'y', e.target.value)}
                      className="w-full py-1.5 rounded-lg bg-slate-950 border border-rose-500/25 text-center font-mono text-xs font-bold text-rose-400 focus:outline-none focus:border-rose-400"
                    />
                  </div>

                  <div className="col-span-1 text-center font-mono text-xs text-slate-500">
                    {info.b}
                  </div>

                  <div className="col-span-2 text-right font-mono text-xs font-black text-cyan-300">
                    {info.net.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-fuchsia-500/10 border border-cyan-500/25 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-emerald-400 font-bold">{calculatedPreview.totalD} D</span>
              <span className="text-rose-400 font-bold">{calculatedPreview.totalY} Y</span>
              <span className="text-slate-400">{calculatedPreview.totalB} B</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                Hesaplanan Toplam {examType} Neti
              </span>
              <span className="text-2xl font-black font-mono bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
                {calculatedPreview.totalNet.toFixed(2)} / {calculatedPreview.maxPossible}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => submitExam(false)}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm transition shadow-[0_0_20px_rgba(6,182,212,0.25)]"
            >
              {isEditMode ? 'Değişiklikleri Kaydet' : 'Kaydet & Kapat'}
            </button>
            {!isEditMode && students.length > 1 && (
              <button
                type="button"
                onClick={() => submitExam(true)}
                className="flex-1 py-3 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/40 text-fuchsia-200 font-extrabold text-xs sm:text-sm transition"
              >
                Kaydet & Sonraki Öğrenci ➔
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}