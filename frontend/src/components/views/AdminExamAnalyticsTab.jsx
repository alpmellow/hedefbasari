import React, { useState, useMemo } from 'react';
import UserAvatar from '../common/UserAvatar';
import ExamEntryModal from '../modals/ExamEntryModal';
import { Download, Trash2, CheckCircle2, Edit3 } from '../common/Icons';
import { HEDEFBASARI_CLASS_OPTIONS, DAYS_TR, MAX_WEEKLY_APPOINTMENTS } from '../../constants';
import { getTodayDateKey } from '../../utils/helpers';

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

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function normalizeExamKey(name = '') {
  return String(name).trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

function formatShortDate(dateStr = '') {
  if (!dateStr) return '—';
  if (dateStr.includes('-')) {
    const [, m, d] = dateStr.split('-');
    return `${d}.${m}`;
  }
  return dateStr;
}

function DonutGauge({ percent, label, sublabel, gradId, colorStart, colorEnd }) {
  const safePct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colorStart} />
              <stop offset="100%" stopColor={colorEnd} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="9" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 6px ${colorStart}66)`, transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-white font-mono">{safePct}%</span>
        </div>
      </div>
      <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-200 mt-1.5">{label}</span>
      <span className="text-[10px] text-slate-400 font-mono">{sublabel}</span>
    </div>
  );
}

function MiniSparkline({ values = [], color = '#22d3ee', gradId = 'spark1' }) {
  const clean = values.filter((v) => Number.isFinite(Number(v))).map(Number);
  const pts = clean.length >= 2 ? clean : clean.length === 1 ? [clean[0], clean[0]] : [0, 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min;
  const width = 120;
  const height = 28;

  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width;
    const y = range === 0
      ? height / 2
      : height - 4 - ((v - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylinePoints = coords.join(' ');
  const areaPoints = `0,${height} ${polylinePoints} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-7 overflow-visible mt-2">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
        style={{ filter: `drop-shadow(0 0 4px ${color}99)` }}
      />
    </svg>
  );
}

export default function AdminExamAnalyticsTab({
  students = [],
  appointments = [],
  assignments = [],
  exams = [],
  setExams,
  emitSocketEvent
}) {
  const [examTypeFilter, setExamTypeFilter] = useState('TYT');
  const [classFilter, setClassFilter] = useState('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [notifiedStudentId, setNotifiedStudentId] = useState(null);

  const maxPossibleForType = examTypeFilter === 'TYT' ? 120 : 80;
  const activeStudentIds = useMemo(() => new Set(students.map((s) => s.id)), [students]);

  const filteredStudentsPool = useMemo(() => {
    if (classFilter === 'ALL') return students;
    return students.filter((s) => s.className === classFilter);
  }, [students, classFilter]);

  const selectedStudent = useMemo(
    () => (selectedStudentId === 'ALL' ? null : students.find((s) => s.id === selectedStudentId) || null),
    [students, selectedStudentId]
  );

  const sortedExams = useMemo(
    () => exams.filter((ex) => activeStudentIds.has(ex.studentId)).sort(compareExamsChronological),
    [exams, activeStudentIds]
  );

  const typeExams = useMemo(
    () => sortedExams.filter((ex) => ex.examType === examTypeFilter),
    [sortedExams, examTypeFilter]
  );

  const scopedTypeExams = useMemo(() => {
    if (selectedStudent) {
      return typeExams.filter((ex) => ex.studentId === selectedStudent.id);
    }
    const poolIds = new Set(filteredStudentsPool.map((s) => s.id));
    return typeExams.filter((ex) => poolIds.has(ex.studentId));
  }, [typeExams, selectedStudent, filteredStudentsPool]);

  // Çift Çizgili Grafik Verisi
  const chartSeries = useMemo(() => {
    const uniqueExamBuckets = [];
    const seen = new Map();

    typeExams.forEach((ex) => {
      const key = normalizeExamKey(ex.examName);
      if (!seen.has(key)) {
        const entry = { key, name: ex.examName.trim(), date: ex.date };
        seen.set(key, entry);
        uniqueExamBuckets.push(entry);
      }
    });

    const recentBuckets = uniqueExamBuckets.slice(-8);

    return recentBuckets.map((bucket) => {
      const instMatches = typeExams.filter((ex) => normalizeExamKey(ex.examName) === bucket.key);
      const instAvg = instMatches.length
        ? Number((instMatches.reduce((acc, e) => acc + (Number(e.totalNet) || 0), 0) / instMatches.length).toFixed(2))
        : 0;

      const scopeMatches = scopedTypeExams.filter((ex) => normalizeExamKey(ex.examName) === bucket.key);
      const scopeAvg = scopeMatches.length
        ? Number((scopeMatches.reduce((acc, e) => acc + (Number(e.totalNet) || 0), 0) / scopeMatches.length).toFixed(2))
        : null;

      return {
        label: bucket.name,
        shortDate: formatShortDate(bucket.date),
        primaryNet: scopeAvg !== null ? scopeAvg : instAvg,
        hasPrimary: scopeAvg !== null,
        instAvg
      };
    });
  }, [typeExams, scopedTypeExams]);

  const graphStats = useMemo(() => {
    const nets = scopedTypeExams.map((e) => Number(e.totalNet) || 0);
    if (nets.length === 0) {
      return { peak: 0, avg: 0, min: 0, max: 0, trendDelta: 0, trendPct: 0, latest: 0 };
    }
    const peak = Math.max(...nets);
    const min = Math.min(...nets);
    const avg = Number((nets.reduce((a, b) => a + b, 0) / nets.length).toFixed(2));

    const validSeries = chartSeries.filter((pt) => pt.hasPrimary);
    const latest = validSeries.length ? validSeries[validSeries.length - 1].primaryNet : nets[nets.length - 1];
    const prev = validSeries.length >= 2 ? validSeries[validSeries.length - 2].primaryNet : latest;
    const trendDelta = Number((latest - prev).toFixed(2));
    const trendPct = prev > 0 ? Number((((latest - prev) / prev) * 100).toFixed(1)) : 0;

    return { peak, avg, min, max: peak, trendDelta, trendPct, latest };
  }, [scopedTypeExams, chartSeries]);

  const gaugeStats = useMemo(() => {
    const poolIds = new Set(
      selectedStudent ? [selectedStudent.id] : filteredStudentsPool.map((s) => s.id)
    );
    const poolExams = sortedExams.filter((ex) => poolIds.has(ex.studentId));

    const tytList = poolExams.filter((e) => e.examType === 'TYT');
    const aytList = poolExams.filter((e) => e.examType === 'AYT');

    const tytAvg = tytList.length ? tytList.reduce((s, e) => s + (Number(e.totalNet) || 0), 0) / tytList.length : 0;
    const aytAvg = aytList.length ? aytList.reduce((s, e) => s + (Number(e.totalNet) || 0), 0) / aytList.length : 0;

    return {
      tytAvg: Number(tytAvg.toFixed(1)),
      tytPct: Math.round((tytAvg / 120) * 100),
      tytCount: tytList.length,
      aytAvg: Number(aytAvg.toFixed(1)),
      aytPct: Math.round((aytAvg / 80) * 100),
      aytCount: aytList.length
    };
  }, [sortedExams, selectedStudent, filteredStudentsPool]);

  // Ders Bazlı Analiz (Ortalama D/Y/B + Net + Değişim)
  const subjectBreakdown = useMemo(() => {
    const map = {};
    scopedTypeExams.forEach((ex) => {
      Object.entries(ex.sections || {}).forEach(([key, sec]) => {
        if (!map[key]) {
          map[key] = { key, label: sec.label || key, max: sec.max || 40, nets: [], ds: [], ys: [], bs: [] };
        }
        const d = Number(sec.d) || 0;
        const y = Number(sec.y) || 0;
        const b = sec.b !== undefined ? Number(sec.b) : Math.max(0, (sec.max || 40) - d - y);
        map[key].nets.push(Number(sec.net) || 0);
        map[key].ds.push(d);
        map[key].ys.push(y);
        map[key].bs.push(b);
      });
    });

    return Object.values(map).map((item) => {
      const avg = item.nets.reduce((a, b) => a + b, 0) / item.nets.length;
      const avgD = item.ds.reduce((a, b) => a + b, 0) / item.ds.length;
      const avgY = item.ys.reduce((a, b) => a + b, 0) / item.ys.length;
      const avgB = item.bs.reduce((a, b) => a + b, 0) / item.bs.length;
      const latest = item.nets[item.nets.length - 1];
      const prev = item.nets.length >= 2 ? item.nets[item.nets.length - 2] : latest;
      const delta = Number((latest - prev).toFixed(2));
      const ratioPct = Math.max(0, Math.min(100, Math.round((avg / item.max) * 100)));

      let status = 'STABİL';
      let statusTone = 'text-cyan-300';
      if (ratioPct >= 75) {
        status = 'ZİRVEDE';
        statusTone = 'text-emerald-300';
      } else if (delta >= 1.5) {
        status = 'YÜKSELİŞTE';
        statusTone = 'text-emerald-300';
      } else if (delta <= -1.5 || ratioPct < 35) {
        status = 'DİKKAT';
        statusTone = 'text-amber-300';
      }

      return {
        ...item,
        avg: Number(avg.toFixed(2)),
        avgD: Number(avgD.toFixed(1)),
        avgY: Number(avgY.toFixed(1)),
        avgB: Number(avgB.toFixed(1)),
        latest: Number(latest.toFixed(2)),
        delta,
        ratioPct,
        status,
        statusTone
      };
    });
  }, [scopedTypeExams]);

  // İsabet Oranı, Yanlış Maliyeti (Net Kaybı) & Kurum Sıralaması
  const precisionAnalytics = useMemo(() => {
    if (scopedTypeExams.length === 0) {
      return {
        accuracyPct: 0,
        avgD: 0,
        avgY: 0,
        avgB: 0,
        avgWrongPenalty: 0,
        potentialWithoutWrongs: 0,
        highestEmptySubject: null,
        latestInstRank: null,
        latestClassRank: null
      };
    }

    let sumD = 0;
    let sumY = 0;
    let sumB = 0;
    scopedTypeExams.forEach((ex) => {
      if (typeof ex.totalD === 'number' && typeof ex.totalY === 'number') {
        sumD += ex.totalD;
        sumY += ex.totalY;
        sumB += typeof ex.totalB === 'number' ? ex.totalB : Math.max(0, (ex.maxPossible || maxPossibleForType) - ex.totalD - ex.totalY);
      } else {
        Object.values(ex.sections || {}).forEach((sec) => {
          const d = Number(sec.d) || 0;
          const y = Number(sec.y) || 0;
          const b = sec.b !== undefined ? Number(sec.b) : Math.max(0, (sec.max || 40) - d - y);
          sumD += d;
          sumY += y;
          sumB += b;
        });
      }
    });

    const count = scopedTypeExams.length;
    const accuracyPct = (sumD + sumY) > 0 ? Math.round((sumD / (sumD + sumY)) * 100) : 0;
    const avgD = Number((sumD / count).toFixed(1));
    const avgY = Number((sumY / count).toFixed(1));
    const avgB = Number((sumB / count).toFixed(1));
    const avgWrongPenalty = Number(((sumY / 4) / count).toFixed(2));
    const potentialWithoutWrongs = Number((graphStats.avg + avgWrongPenalty).toFixed(2));
    const highestEmptySubject = [...subjectBreakdown].sort((a, b) => b.avgB - a.avgB)[0] || null;

    let latestInstRank = null;
    let latestClassRank = null;
    if (selectedStudent && scopedTypeExams.length > 0) {
      const lastExam = scopedTypeExams[scopedTypeExams.length - 1];
      const examKey = normalizeExamKey(lastExam.examName);
      const sameExamAll = typeExams
        .filter((e) => normalizeExamKey(e.examName) === examKey)
        .sort((a, b) => (Number(b.totalNet) || 0) - (Number(a.totalNet) || 0));

      const instIdx = sameExamAll.findIndex((e) => e.studentId === selectedStudent.id);
      if (instIdx !== -1) {
        latestInstRank = { rank: instIdx + 1, total: sameExamAll.length, examName: lastExam.examName };
      }

      const sameClass = sameExamAll.filter((e) => e.studentClass === selectedStudent.className);
      const clsIdx = sameClass.findIndex((e) => e.studentId === selectedStudent.id);
      if (clsIdx !== -1) {
        latestClassRank = { rank: clsIdx + 1, total: sameClass.length };
      }
    }

    return {
      accuracyPct,
      avgD,
      avgY,
      avgB,
      avgWrongPenalty,
      potentialWithoutWrongs,
      highestEmptySubject,
      latestInstRank,
      latestClassRank
    };
  }, [scopedTypeExams, maxPossibleForType, graphStats.avg, subjectBreakdown, selectedStudent, typeExams]);

  // Kurum Modu için Sınav Bazlı Özet Tablosu (Satır 3)
  const institutionExamSummaryRows = useMemo(() => {
    const groups = new Map();
    scopedTypeExams.forEach((ex) => {
      const key = normalizeExamKey(ex.examName);
      if (!groups.has(key)) {
        groups.set(key, { key, examName: ex.examName.trim(), date: ex.date, records: [] });
      }
      groups.get(key).records.push(ex);
    });

    return Array.from(groups.values())
      .map((grp) => {
        const nets = grp.records.map((r) => Number(r.totalNet) || 0);
        const avgNet = Number((nets.reduce((a, b) => a + b, 0) / nets.length).toFixed(2));
        const maxNet = Math.max(...nets);
        const topStudent = grp.records.find((r) => (Number(r.totalNet) || 0) === maxNet);

        const secAvgs = {};
        grp.records.forEach((rec) => {
          Object.entries(rec.sections || {}).forEach(([k, sec]) => {
            if (!secAvgs[k]) secAvgs[k] = { label: sec.label || k, nets: [], ds: [], ys: [] };
            secAvgs[k].nets.push(Number(sec.net) || 0);
            secAvgs[k].ds.push(Number(sec.d) || 0);
            secAvgs[k].ys.push(Number(sec.y) || 0);
          });
        });

        const formattedSecs = {};
        Object.entries(secAvgs).forEach(([k, v]) => {
          formattedSecs[k] = {
            label: v.label,
            avgNet: Number((v.nets.reduce((a, b) => a + b, 0) / v.nets.length).toFixed(2)),
            avgD: Number((v.ds.reduce((a, b) => a + b, 0) / v.ds.length).toFixed(1)),
            avgY: Number((v.ys.reduce((a, b) => a + b, 0) / v.ys.length).toFixed(1))
          };
        });

        return {
          ...grp,
          participantCount: grp.records.length,
          avgNet,
          maxNet: Number(maxNet.toFixed(2)),
          topStudentName: topStudent?.studentName || '—',
          sections: formattedSecs
        };
      })
      .reverse();
  }, [scopedTypeExams]);

  // Matris Sütun Başlıkları (Sınavlarda bulunan tüm benzersiz dersler)
  const matrixSubjectColumns = useMemo(() => {
    const colMap = new Map();
    scopedTypeExams.forEach((ex) => {
      Object.entries(ex.sections || {}).forEach(([key, sec]) => {
        if (!colMap.has(key)) {
          colMap.set(key, { key, label: sec.label || key, max: sec.max || 40 });
        }
      });
    });
    return Array.from(colMap.values());
  }, [scopedTypeExams]);

  const studentRows = useMemo(() => {
    const now = Date.now();
    return filteredStudentsPool.map((st) => {
      const stExams = typeExams.filter((ex) => ex.studentId === st.id);
      const latestExam = stExams.length ? stExams[stExams.length - 1] : null;
      const prevExam = stExams.length >= 2 ? stExams[stExams.length - 2] : null;

      const latestNet = latestExam ? Number(latestExam.totalNet) || 0 : 0;
      const delta = latestExam && prevExam
        ? Number((latestNet - (Number(prevExam.totalNet) || 0)).toFixed(2))
        : 0;
      const pct = Math.max(0, Math.min(100, Math.round((latestNet / maxPossibleForType) * 100)));

      const stHomeworks = assignments.filter((a) => a.studentId === st.id);
      const completedHw = stHomeworks.filter((a) => a.isCompleted).length;
      const overdueHw = stHomeworks.filter((a) => !a.isCompleted && a.deadline && new Date(a.deadline).getTime() < now).length;
      const hwRate = stHomeworks.length ? Math.round((completedHw / stHomeworks.length) * 100) : 100;

      const stAppointmentsCount = appointments.filter((slot) =>
        slot.participants.some((p) => p.studentId === st.id && p.status !== 'Rejected')
      ).length;

      let status = 'VERİ YOK';
      let statusClass = 'text-slate-500';
      if (stExams.length > 0) {
        if (delta <= -5 || overdueHw >= 2) {
          status = 'RİSKLİ';
          statusClass = 'text-rose-400';
        } else if (delta < -1.5 || overdueHw === 1) {
          status = 'DİKKAT';
          statusClass = 'text-amber-300';
        } else if (pct >= 75) {
          status = 'ZİRVEDE';
          statusClass = 'text-emerald-300';
        } else if (delta >= 2) {
          status = 'YÜKSELİŞTE';
          statusClass = 'text-cyan-300';
        } else {
          status = 'STABİL';
          statusClass = 'text-indigo-300';
        }
      } else if (overdueHw >= 1) {
        status = 'ÖDEV GECİKTİ';
        statusClass = 'text-amber-300';
      }

      const isAtRisk = delta <= -5 || overdueHw >= 1;

      return {
        student: st,
        examCount: stExams.length,
        latestNet,
        delta,
        pct,
        hwTotal: stHomeworks.length,
        completedHw,
        overdueHw,
        hwRate,
        stAppointmentsCount,
        status,
        statusClass,
        isAtRisk
      };
    }).sort((a, b) => b.latestNet - a.latestNet);
  }, [filteredStudentsPool, typeExams, assignments, appointments, maxPossibleForType]);

  const disciplineSignals = useMemo(() => {
    const scopeRows = selectedStudent
      ? studentRows.filter((r) => r.student.id === selectedStudent.id)
      : studentRows;
    const scopeStudentIds = new Set(scopeRows.map((r) => r.student.id));

    const totalHw = scopeRows.reduce((s, r) => s + r.hwTotal, 0);
    const doneHw = scopeRows.reduce((s, r) => s + r.completedHw, 0);
    const hwCompletionPct = totalHw > 0 ? Math.round((doneHw / totalHw) * 100) : 100;

    const totalAppointments = scopeRows.reduce((s, r) => s + r.stAppointmentsCount, 0);
    const maxAppointments = Math.max(1, scopeRows.length * MAX_WEEKLY_APPOINTMENTS);
    const tutoringPct = Math.min(100, Math.round((totalAppointments / maxAppointments) * 100));

    const riskCount = scopeRows.filter((r) => r.isAtRisk).length;
    const disciplineIndex = Math.round(hwCompletionPct * 0.65 + Math.min(100, tutoringPct * 2) * 0.35);

    const weakestSubject = [...subjectBreakdown].sort((a, b) => a.ratioPct - b.ratioPct)[0] || null;
    const strongestSubject = [...subjectBreakdown].sort((a, b) => b.ratioPct - a.ratioPct)[0] || null;

    const hwSparkValues = scopeRows.length >= 2
      ? scopeRows.slice(0, 8).map((r) => r.hwRate)
      : [hwCompletionPct, hwCompletionPct];

    const etutSparkValues = DAYS_TR.map((day) =>
      appointments.reduce((sum, slot) => {
        if (slot.day !== day) return sum;
        const count = (slot.participants || []).filter(
          (p) => p.status !== 'Rejected' && scopeStudentIds.has(p.studentId)
        ).length;
        return sum + count;
      }, 0)
    );

    const riskSparkValues = scopeRows.length >= 2
      ? scopeRows.slice(0, 8).map((r) => (r.isAtRisk ? 1 : 0))
      : [riskCount, riskCount];

    return {
      hwCompletionPct,
      totalHw,
      doneHw,
      totalAppointments,
      tutoringPct,
      riskCount,
      disciplineIndex: Math.min(100, Math.max(0, disciplineIndex)),
      weakestSubject,
      strongestSubject,
      hwSparkValues,
      etutSparkValues,
      riskSparkValues
    };
  }, [studentRows, selectedStudent, subjectBreakdown, appointments]);

  const handleOpenNewModal = () => {
    setEditingExam(null);
    setIsEntryModalOpen(true);
  };

  const handleOpenEditModal = (ex) => {
    setEditingExam(ex);
    setIsEntryModalOpen(true);
  };

  const handleSaveExamRecord = (examRecord, isEdit = false) => {
    if (isEdit) {
      setExams((prev) => prev.map((ex) => (ex.id === examRecord.id ? examRecord : ex)));
      if (emitSocketEvent) {
        emitSocketEvent(
          'exams:updated',
          `${examRecord.studentName} — ${examRecord.examName} (${examRecord.examType}) sonucu güncellendi (${examRecord.totalNet} Net).`
        );
      }
      setEditingExam(null);
      return;
    }

    setExams((prev) => [examRecord, ...prev]);
    if (emitSocketEvent) {
      emitSocketEvent(
        'exams:new',
        `Yeni ${examRecord.examType} deneme sonucu eklendi: ${examRecord.studentName} — ${examRecord.examName} (${examRecord.totalNet} Net)`,
        {
          targetUserId: examRecord.studentId,
          title: 'Yeni Deneme Karneniz Hazır!',
          message: `${examRecord.examName} (${examRecord.examType}) sonucunuz işlendi. Toplam Net: ${examRecord.totalNet}`,
          type: 'success',
          category: 'exam'
        }
      );
    }
  };

  const handleDeleteExam = (ex) => {
    if (!window.confirm(`"${ex.studentName}" — "${ex.examName}" (${Number(ex.totalNet).toFixed(2)} Net) kaydını silmek istediğinize emin misiniz?`)) {
      return;
    }
    setExams((prev) => prev.filter((item) => item.id !== ex.id));
  };

  const handleSendAcademicWarning = (st) => {
    if (!st || !emitSocketEvent) return;
    emitSocketEvent(
      'admin:academic_warning',
      `Yönetim tarafından ${st.fullName} öğrencisine akademik takip uyarısı gönderildi.`,
      {
        targetUserId: st.id,
        title: 'Yönetim Akademik Takip Bildirimi',
        message: 'Son deneme netleriniz ve ödev takibiniz incelendi. Lütfen bu hafta danışman öğretmeninizle etüt planlayın.',
        type: 'warning',
        category: 'summon'
      }
    );
    setNotifiedStudentId(st.id);
    setTimeout(() => setNotifiedStudentId(null), 2500);
  };

  // Veli & Öğrenci Yazdırılabilir PDF Karne Çıktısı
  const handlePrintStudentReportCard = () => {
    if (!selectedStudent) return;
    const printWin = window.open('', '_blank', 'width=980,height=760');
    if (!printWin) return;

    const examRowsHtml = [...scopedTypeExams].reverse().map((ex) => {
      const cellsHtml = matrixSubjectColumns.map((col) => {
        const s = ex.sections?.[col.key];
        if (!s) return '<td style="text-align:center;color:#94a3b8;">—</td>';
        const b = s.b !== undefined ? s.b : Math.max(0, (s.max || col.max) - (s.d || 0) - (s.y || 0));
        return `<td style="text-align:center;">
          <div style="font-weight:800;color:#0f172a;font-size:13px;">${Number(s.net || 0).toFixed(2)}</div>
          <div style="font-size:10px;color:#475569;">${s.d || 0}D / ${s.y || 0}Y / ${b}B</div>
        </td>`;
      }).join('');

      return `<tr>
        <td><strong>${escapeHtml(ex.examName)}</strong><div style="font-size:11px;color:#64748b;">${escapeHtml(ex.date || '')}</div></td>
        ${cellsHtml}
        <td style="text-align:center;font-weight:900;font-size:14px;color:#4f46e5;">${Number(ex.totalNet || 0).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const headersHtml = matrixSubjectColumns
      .map((col) => `<th style="text-align:center;">${escapeHtml(col.label)} (${col.max})</th>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(selectedStudent.fullName)} — HedefBaşarı ${escapeHtml(examTypeFilter)} Gelişim Karnesi</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 28px; margin: 0; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4f46e5; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { font-size: 20px; font-weight: 900; color: #312e81; letter-spacing: 0.5px; }
  .sub { font-size: 12px; color: #64748b; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
  .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #f8fafc; }
  .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
  .card-val { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
  th { background: #eef2ff; color: #1e1b4b; font-weight: 800; }
  .note { margin-top: 20px; padding: 14px; border-radius: 10px; background: #f1f5f9; border-left: 4px solid #4f46e5; font-size: 12px; line-height: 1.6; }
  .footer { margin-top: 26px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">HEDEFBAŞARI ÖZEL ÖĞRETİM KURSU</div>
      <div class="sub">Öğrenci Akademik Gelişim &amp; ${escapeHtml(examTypeFilter)} Deneme Karnesi</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:800;font-size:15px;">${escapeHtml(selectedStudent.fullName)}</div>
      <div class="sub">Sınıf: ${escapeHtml(selectedStudent.className)} • Tarih: ${escapeHtml(getTodayDateKey())}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card"><div class="card-label">Ortalama ${escapeHtml(examTypeFilter)} Net</div><div class="card-val">${graphStats.avg.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">Zirve (En Yüksek)</div><div class="card-val">${graphStats.peak.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">İsabet Oranı</div><div class="card-val">%${precisionAnalytics.accuracyPct}</div></div>
    <div class="card"><div class="card-label">Yanlış Net Maliyeti</div><div class="card-val">-${precisionAnalytics.avgWrongPenalty.toFixed(2)} Net</div></div>
  </div>

  <h3 style="margin:0 0 8px 0;font-size:14px;color:#1e293b;">Deneme Sınavı Bazlı Ders &amp; Soru Dökümü (${scopedTypeExams.length} Sınav)</h3>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Deneme Adı / Tarih</th>
        ${headersHtml}
        <th style="text-align:center;">Toplam Net</th>
      </tr>
    </thead>
    <tbody>${examRowsHtml}</tbody>
  </table>

  <div class="note">
    <strong>Akademik Değerlendirme:</strong>
    En güçlü branş <strong>${escapeHtml(disciplineSignals.strongestSubject?.label || '—')}</strong> (${disciplineSignals.strongestSubject?.avg ?? 0} Net),
    öncelikli etüt gerektiren branş <strong>${escapeHtml(disciplineSignals.weakestSubject?.label || '—')}</strong> (${disciplineSignals.weakestSubject?.avg ?? 0} Net).
    Öğrenci sınav başına ortalama <strong>${precisionAnalytics.avgD} Doğru, ${precisionAnalytics.avgY} Yanlış, ${precisionAnalytics.avgB} Boş</strong> yapmaktadır.
    Yanlış işaretlemelerin net kaybı ortalama <strong>-${precisionAnalytics.avgWrongPenalty.toFixed(2)} Net</strong> düzeyindedir (potansiyel net: ${precisionAnalytics.potentialWithoutWrongs.toFixed(2)}).
  </div>

  <div class="footer">
    <span>HedefBaşarı Akademik Takip Sistemi</span>
    <span>Veli / Danışman İmza: ______________________</span>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  const handleExportExamsCsv = () => {
    const escapeCsv = (val) => {
      const raw = String(val ?? '');
      const isPlainNumber = /^-?\d+(\.\d+)?$/.test(raw.trim());
      const safe = !isPlainNumber && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    let csv = '\uFEFF';
    csv += 'Tarih,Öğrenci,Sınıf,Sınav Adı,Tür,Toplam Doğru,Toplam Yanlış,Toplam Boş,Toplam Net,Ders Detayları\n';

    scopedTypeExams.forEach((ex) => {
      const detailStr = Object.values(ex.sections || {})
        .map((s) => `${s.label}: ${s.net} (${s.d}D/${s.y}Y/${s.b ?? 0}B)`)
        .join(' | ');
      csv += [
        escapeCsv(ex.date),
        escapeCsv(ex.studentName),
        escapeCsv(ex.studentClass),
        escapeCsv(ex.examName),
        escapeCsv(ex.examType),
        escapeCsv(ex.totalD ?? ''),
        escapeCsv(ex.totalY ?? ''),
        escapeCsv(ex.totalB ?? ''),
        escapeCsv(ex.totalNet),
        escapeCsv(detailStr)
      ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HedefBasari_Deneme_Raporu_${examTypeFilter}_${getTodayDateKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const svgW = 540;
  const svgH = 175;
  const padX = 24;
  const padY = 18;

  const chartCoords = useMemo(() => {
    if (chartSeries.length === 0) return { primary: [], inst: [], yMax: maxPossibleForType };
    const allVals = chartSeries.flatMap((c) => [c.primaryNet, c.instAvg]);
    const rawMax = Math.max(...allVals, 10);
    const yMax = Math.min(maxPossibleForType, Math.ceil(rawMax / 10) * 10 + 10);
    const usableW = svgW - padX * 2;
    const usableH = svgH - padY * 2;

    const getX = (idx) => {
      if (chartSeries.length === 1) return svgW / 2;
      return padX + (idx / (chartSeries.length - 1)) * usableW;
    };
    const getY = (val) => {
      const clamped = Math.max(0, Math.min(yMax, val));
      return svgH - padY - (clamped / yMax) * usableH;
    };

    const primary = chartSeries.map((pt, i) => ({
      x: getX(i),
      y: getY(pt.primaryNet),
      val: pt.primaryNet,
      label: pt.label,
      shortDate: pt.shortDate
    }));

    const inst = chartSeries.map((pt, i) => ({
      x: getX(i),
      y: getY(pt.instAvg),
      val: pt.instAvg
    }));

    return { primary, inst, yMax };
  }, [chartSeries, maxPossibleForType]);

  const primaryPolyline = chartCoords.primary.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const instPolyline = chartCoords.inst.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const primaryArea = chartCoords.primary.length >= 2
    ? `${chartCoords.primary[0].x},${svgH - padY} ${primaryPolyline} ${chartCoords.primary[chartCoords.primary.length - 1].x},${svgH - padY}`
    : '';

  const segmentPalette = [
    'from-cyan-400 to-sky-500',
    'from-indigo-400 to-violet-500',
    'from-fuchsia-400 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-rose-400 to-red-500',
    'from-blue-400 to-indigo-500'
  ];

  const totalSubjectAvgSum = Math.max(0.1, subjectBreakdown.reduce((acc, s) => acc + Math.max(0, s.avg), 0));

  return (
    <div className="space-y-5">
      {/* ÜST KONTROL ŞERİDİ */}
      <div className="p-4 sm:px-6 rounded-3xl bg-gradient-to-r from-[#0d1430] via-[#10183a] to-[#161238] border border-indigo-500/25 shadow-[0_0_35px_rgba(79,70,229,0.12)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
            <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_#e879f9]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300/80">
                ANALİTİK / AKADEMİK GÖZETİM / {selectedStudent ? 'ÖĞRENCİ X-RAY' : 'KURUM GENELİ'}
              </span>
              {selectedStudent && precisionAnalytics.latestInstRank && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/35 text-[10px] font-black text-amber-300 font-mono">
                  SON SINAV KURUM: {precisionAnalytics.latestInstRank.rank}. / {precisionAnalytics.latestInstRank.total}
                  {precisionAnalytics.latestClassRank && ` • SINIF: ${precisionAnalytics.latestClassRank.rank}. / ${precisionAnalytics.latestClassRank.total}`}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-white">
              {selectedStudent ? `${selectedStudent.fullName} — Gelişim Kokpiti` : 'HEDEFBAŞARI DENEME KOMUTA MERKEZİ'}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex p-1 rounded-xl bg-[#070b1a] border border-indigo-500/25">
            {['TYT', 'AYT'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setExamTypeFilter(type)}
                className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                  examTypeFilter === type
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSelectedStudentId('ALL');
            }}
            className="px-3 py-2 rounded-xl bg-[#070b1a] border border-indigo-500/25 text-xs font-bold text-cyan-200 focus:outline-none"
          >
            <option value="ALL">Tüm Sınıflar</option>
            {HEDEFBASARI_CLASS_OPTIONS.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#070b1a] border border-fuchsia-500/30 text-xs font-bold text-fuchsia-200 focus:outline-none max-w-[190px]"
          >
            <option value="ALL">Kurum Geneli ({filteredStudentsPool.length})</option>
            {filteredStudentsPool.map((s) => (
              <option key={s.id} value={s.id}>X-Ray: {s.fullName}</option>
            ))}
          </select>

          {selectedStudent && scopedTypeExams.length > 0 && (
            <button
              type="button"
              onClick={handlePrintStudentReportCard}
              className="px-3 py-2 rounded-xl bg-[#070b1a] hover:bg-slate-900 border border-indigo-400/40 text-indigo-200 text-xs font-bold flex items-center gap-1.5 transition"
              title="Veli & Öğrenci İçin PDF Gelişim Karnesi Yazdır"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Karne PDF
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExamsCsv}
            disabled={scopedTypeExams.length === 0}
            className="px-3 py-2 rounded-xl bg-[#070b1a] hover:bg-slate-900 disabled:opacity-40 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition"
            title="Deneme Raporunu Excel/CSV İndir"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>

          <button
            type="button"
            onClick={handleOpenNewModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:brightness-110 text-slate-950 font-black text-xs shadow-[0_0_20px_rgba(99,102,241,0.45)] transition"
          >
            + Yeni Deneme Gir
          </button>
        </div>
      </div>

      {/* SATIR 1: 3'LÜ BENTO ANALİZ KARTLARI */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-3 p-5 rounded-3xl bg-[#0c1229] border border-indigo-500/20 flex flex-col justify-between space-y-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-indigo-300/80 block">
              GENEL BAKIŞ • {examTypeFilter}
            </span>
            <h3 className="text-sm font-black text-white mt-0.5">
              {selectedStudent ? 'Öğrenci Performans Özeti' : 'Kurum Başarı Skoru'}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#070b1a] border border-indigo-500/15 flex flex-col justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ORTALAMA NET</span>
              <div className="text-3xl font-black font-mono text-white mt-1">
                {graphStats.avg.toFixed(1)}
              </div>
              <span className={`text-[10px] font-mono font-extrabold mt-1 ${graphStats.trendDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {graphStats.trendDelta >= 0 ? `+${graphStats.trendDelta}` : graphStats.trendDelta} SON SINAV
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#070b1a] border border-indigo-500/15 flex flex-col items-center justify-center text-center">
              <div className="w-11 h-11 rounded-full border-[4px] border-indigo-500/20 border-t-cyan-400 border-r-fuchsia-400 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.25)]">
                <span className="text-xs font-black font-mono text-white">{scopedTypeExams.length}</span>
              </div>
              <span className="text-[10px] font-extrabold text-fuchsia-300 uppercase mt-2">KAYITLI</span>
              <span className="text-[9px] text-slate-400">{examTypeFilter} DENEMESİ</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="uppercase tracking-wider text-slate-400">AKADEMİK DİSİPLİN SKORU</span>
              <span className="font-mono text-cyan-300">{disciplineSignals.disciplineIndex}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#070b1a] overflow-hidden border border-indigo-500/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-500"
                style={{ width: `${disciplineSignals.disciplineIndex}%` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 p-5 rounded-3xl bg-[#0c1229] border border-indigo-500/20 flex flex-col justify-between space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300/80 block">
                GELİŞİM EĞRİSİ • {examTypeFilter} NET TAKİBİ
              </span>
              <h3 className="text-sm font-black text-white mt-0.5">
                {selectedStudent ? `${selectedStudent.fullName} vs Kurum Ortalaması` : 'Denemeler Arası Net İvmesi'}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="w-2.5 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                {selectedStudent ? 'Öğrenci' : 'Seçili Kapsam'}
              </span>
              <span className="flex items-center gap-1.5 text-fuchsia-300">
                <span className="w-2.5 h-1 rounded-full bg-fuchsia-400 shadow-[0_0_6px_#e879f9]" />
                Kurum Ort.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="px-3 py-2 rounded-xl bg-[#070b1a] border border-indigo-500/15">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">ZİRVE NET</span>
              <span className="text-sm font-black font-mono text-white">{graphStats.peak.toFixed(2)}</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-[#070b1a] border border-indigo-500/15">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">ORTALAMA</span>
              <span className="text-sm font-black font-mono text-cyan-300">{graphStats.avg.toFixed(2)}</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-[#070b1a] border border-indigo-500/15">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">TREND</span>
              <span className={`text-sm font-black font-mono ${graphStats.trendPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {graphStats.trendPct >= 0 ? `+${graphStats.trendPct}%` : `${graphStats.trendPct}%`}
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-[#070b1a] border border-indigo-500/15">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">ARALIK</span>
              <span className="text-sm font-black font-mono text-indigo-200">
                {graphStats.min.toFixed(0)}–{graphStats.max.toFixed(0)}
              </span>
            </div>
          </div>

          <div className="relative rounded-2xl bg-[#070b1a] border border-indigo-500/15 p-3">
            {chartSeries.length === 0 ? (
              <div className="h-[160px] flex flex-col items-center justify-center text-center space-y-2">
                <p className="text-xs text-slate-400">
                  Henüz <strong className="text-cyan-300">{examTypeFilter}</strong> denemesi girilmedi.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewModal}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition"
                >
                  İlk Denemeyi Şimdi Ekle
                </button>
              </div>
            ) : (
              <>
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[165px] overflow-visible">
                  <defs>
                    <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="cyanStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                    <linearGradient id="pinkStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>

                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = svgH - padY - ratio * (svgH - padY * 2);
                    return (
                      <g key={ratio}>
                        <line x1={padX} y1={y} x2={svgW - padX} y2={y} stroke="rgba(148,163,184,0.08)" strokeDasharray="3 4" />
                        <text x="4" y={y + 3} fill="rgba(148,163,184,0.45)" fontSize="9" fontFamily="monospace">
                          {Math.round(chartCoords.yMax * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {chartCoords.inst.length >= 2 && (
                    <polyline
                      fill="none"
                      stroke="url(#pinkStrokeGrad)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={instPolyline}
                      opacity="0.85"
                      style={{ filter: 'drop-shadow(0 0 6px rgba(236,72,153,0.45))' }}
                    />
                  )}

                  {primaryArea && <polygon points={primaryArea} fill="url(#cyanAreaGrad)" />}
                  {chartCoords.primary.length >= 2 && (
                    <polyline
                      fill="none"
                      stroke="url(#cyanStrokeGrad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={primaryPolyline}
                      style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.65))' }}
                    />
                  )}

                  {chartCoords.primary.map((pt, i) => (
                    <g
                      key={i}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredIdx === i ? '6' : '4'}
                        fill="#ffffff"
                        stroke="#22d3ee"
                        strokeWidth="2.5"
                        style={{ filter: 'drop-shadow(0 0 8px #22d3ee)' }}
                      />
                      <text
                        x={pt.x}
                        y={svgH - 2}
                        textAnchor="middle"
                        fill="rgba(148,163,184,0.65)"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {pt.shortDate}
                      </text>
                    </g>
                  ))}
                </svg>

                {hoveredIdx !== null && chartSeries[hoveredIdx] && (
                  <div className="absolute top-3 right-3 px-3 py-2 rounded-xl bg-slate-950/95 border border-cyan-500/40 text-[11px] shadow-xl pointer-events-none">
                    <div className="font-extrabold text-white">{chartSeries[hoveredIdx].label}</div>
                    <div className="flex items-center gap-3 mt-1 font-mono">
                      <span className="text-cyan-300 font-bold">Net: {chartSeries[hoveredIdx].primaryNet}</span>
                      <span className="text-fuchsia-300">Kurum: {chartSeries[hoveredIdx].instAvg}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 p-5 rounded-3xl bg-[#0c1229] border border-indigo-500/20 flex flex-col justify-between space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-fuchsia-300/80 block">
              OTURUM ORANLARI & DAĞILIM
            </span>
            <h3 className="text-sm font-black text-white mt-0.5">TYT / AYT Başarı Halkaları</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 py-1">
            <DonutGauge
              percent={gaugeStats.tytPct}
              label="TYT"
              sublabel={`${gaugeStats.tytAvg} / 120`}
              gradId="tytRingGrad"
              colorStart="#22d3ee"
              colorEnd="#6366f1"
            />
            <DonutGauge
              percent={gaugeStats.aytPct}
              label="AYT"
              sublabel={`${gaugeStats.aytAvg} / 80`}
              gradId="aytRingGrad"
              colorStart="#a855f7"
              colorEnd="#ec4899"
            />
          </div>

          <div className="p-3 rounded-2xl bg-[#070b1a] border border-indigo-500/15 space-y-2">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
              {examTypeFilter} BRANŞ NET AĞIRLIĞI
            </span>
            <div className="h-2.5 rounded-full bg-slate-900 overflow-hidden flex gap-0.5">
              {subjectBreakdown.length === 0 ? (
                <div className="w-full h-full bg-slate-800/60" />
              ) : (
                subjectBreakdown.map((sec, i) => {
                  const widthPct = Math.max(4, (Math.max(0, sec.avg) / totalSubjectAvgSum) * 100);
                  return (
                    <div
                      key={sec.key}
                      className={`h-full bg-gradient-to-r ${segmentPalette[i % segmentPalette.length]}`}
                      style={{ width: `${widthPct}%` }}
                      title={`${sec.label}: ${sec.avg} Net`}
                    />
                  );
                })
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-300 font-mono">
              {subjectBreakdown.map((sec) => (
                <span key={sec.key}>
                  <strong className="text-cyan-300">{getShortSubjectLabel(sec.key, sec.label)}:</strong> {sec.avg}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SATIR 2: PERFORMANS TABLOSU + İSABET / YANLIŞ MALİYETİ & SİNYAL BLOKLARI */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 p-5 rounded-3xl bg-[#0c1229] border border-indigo-500/20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300/80 block">
                {selectedStudent ? 'BRANŞ BAZLI X-RAY KIRILIMI' : 'ÖĞRENCİ PERFORMANS & RİSK MATRİSİ'}
              </span>
              <h3 className="text-sm font-black text-white mt-0.5">
                {selectedStudent
                  ? `${selectedStudent.fullName} — ${examTypeFilter} Ders Analizi (Ortalama D / Y / B)`
                  : 'Detaylı İnceleme İçin Bir Öğrenciye Tıklayın'}
              </h3>
            </div>
            {selectedStudent && (
              <button
                type="button"
                onClick={() => setSelectedStudentId('ALL')}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-cyan-300 hover:bg-slate-800 transition"
              >
                ← Kurum Listesine Dön
              </button>
            )}
          </div>

          <div className="max-h-[340px] overflow-y-auto pr-1 space-y-2">
            {!selectedStudent ? (
              <>
                <div className="grid grid-cols-12 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-indigo-500/15">
                  <span className="col-span-4">Öğrenci</span>
                  <span className="col-span-2">Durum</span>
                  <span className="col-span-4">Son {examTypeFilter} Neti</span>
                  <span className="col-span-2 text-right">Değişim</span>
                </div>

                {studentRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">Listelenecek öğrenci bulunamadı.</div>
                ) : (
                  studentRows.map((row) => (
                    <button
                      key={row.student.id}
                      type="button"
                      onClick={() => setSelectedStudentId(row.student.id)}
                      className="w-full text-left grid grid-cols-12 items-center gap-2 px-3 py-2.5 rounded-2xl bg-[#070b1a] hover:bg-[#111936] border border-indigo-500/10 hover:border-cyan-500/40 transition"
                    >
                      <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                        <UserAvatar src="" name={row.student.fullName} className="w-8 h-8 shrink-0" textClass="text-[10px]" />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-white truncate">{row.student.fullName}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {row.student.className} • {row.examCount} Deneme
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span className={`text-[10px] font-black tracking-wider ${row.statusClass}`}>
                          {row.status}
                        </span>
                      </div>

                      <div className="col-span-4 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-200 w-12 text-right">
                          {row.examCount > 0 ? row.latestNet.toFixed(1) : '—'}
                        </span>
                      </div>

                      <div className="col-span-2 text-right font-mono text-xs font-extrabold">
                        {row.examCount < 2 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span className={row.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {row.delta >= 0 ? `+${row.delta.toFixed(2)}` : row.delta.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </>
            ) : (
              <div className="space-y-2.5">
                {subjectBreakdown.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-[#070b1a] text-center text-xs text-slate-400">
                    Bu öğrenci için henüz {examTypeFilter} denemesi girilmemiş.
                  </div>
                ) : (
                  subjectBreakdown.map((sec) => (
                    <div key={sec.key} className="grid grid-cols-12 items-center gap-2 px-3.5 py-3 rounded-2xl bg-[#070b1a] border border-indigo-500/15">
                      <div className="col-span-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-white">{sec.label}</span>
                          <span className="text-[10px] text-slate-500 font-mono">/{sec.max}</span>
                        </div>
                        <div className="text-[10px] font-mono mt-0.5 flex items-center gap-2">
                          <span className="text-emerald-400">{sec.avgD}D</span>
                          <span className="text-rose-400">{sec.avgY}Y</span>
                          <span className="text-slate-400">{sec.avgB}B</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className={`text-[10px] font-black ${sec.statusTone}`}>{sec.status}</span>
                      </div>
                      <div className="col-span-4 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500"
                            style={{ width: `${sec.ratioPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-white w-12 text-right">{sec.latest}</span>
                      </div>
                      <div className={`col-span-2 text-right font-mono text-xs font-extrabold ${sec.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {sec.delta >= 0 ? `+${sec.delta}` : sec.delta}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* SAĞ ALT: İSABET & YANLIŞ MALİYETİ + DİSİPLİN SİNYALLERİ */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-[#0c1229] border border-indigo-500/20 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-fuchsia-300/80 block">
              İSABET, YANLIŞ MALİYETİ & CANLI SİNYALLER
            </span>
            <h3 className="text-sm font-black text-white mt-0.5">Sınav Stratejisi & Akademik Takip</h3>
          </div>

          {/* İsabet & Yanlış Net Kaybı Bandı */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#070b1a] border border-cyan-500/20">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">İSABET ORANI</span>
              <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">
                %{precisionAnalytics.accuracyPct}
              </span>
              <span className="text-[9px] font-mono text-slate-400">Ort. {precisionAnalytics.avgD}D / {precisionAnalytics.avgY}Y</span>
            </div>

            <div className="p-3 rounded-2xl bg-[#070b1a] border border-rose-500/20">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">YANLIŞ KAYBI</span>
              <span className="text-lg font-black font-mono text-rose-400 mt-0.5 block">
                -{precisionAnalytics.avgWrongPenalty}
              </span>
              <span className="text-[9px] font-mono text-slate-400">Net / Sınav</span>
            </div>

            <div className="p-3 rounded-2xl bg-[#070b1a] border border-emerald-500/20">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">POTANSİYEL</span>
              <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">
                {precisionAnalytics.potentialWithoutWrongs}
              </span>
              <span className="text-[9px] font-mono text-slate-400">Yanlışsız Net</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#070b1a] border border-indigo-500/15">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">ÖDEV UYUMU</span>
              <span className="text-lg font-black font-mono text-white mt-0.5 block">
                %{disciplineSignals.hwCompletionPct}
              </span>
              <MiniSparkline values={disciplineSignals.hwSparkValues} color="#22d3ee" gradId="spHw" />
            </div>

            <div className="p-3 rounded-2xl bg-[#070b1a] border border-indigo-500/15">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">ETÜT SEANSI</span>
              <span className="text-lg font-black font-mono text-white mt-0.5 block">
                {disciplineSignals.totalAppointments}
              </span>
              <MiniSparkline values={disciplineSignals.etutSparkValues} color="#e879f9" gradId="spEtut" />
            </div>

            <div className="p-3 rounded-2xl bg-[#070b1a] border border-indigo-500/15">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">RİSK SİNYALİ</span>
              <span className={`text-lg font-black font-mono mt-0.5 block ${disciplineSignals.riskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {disciplineSignals.riskCount}
              </span>
              <MiniSparkline values={disciplineSignals.riskSparkValues} color={disciplineSignals.riskCount > 0 ? '#fb7185' : '#34d399'} gradId="spRisk" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0a1026] to-[#151233] border border-indigo-500/25 space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300 block">
              OTOMATİK AKADEMİK TEŞHİS
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {scopedTypeExams.length === 0 ? (
                <>Henüz analiz edilecek {examTypeFilter} verisi yok. Sağ üstteki <strong>+ Yeni Deneme Gir</strong> butonundan ilk sonuçları girdiğinizde ders bazlı teşhis burada otomatik oluşacaktır.</>
              ) : (
                <>
                  {selectedStudent ? `${selectedStudent.fullName} için ` : 'Seçili kapsamda '}
                  en güçlü branş <strong className="text-emerald-300">{disciplineSignals.strongestSubject?.label || '—'}</strong> ({disciplineSignals.strongestSubject?.avg ?? 0} Net),
                  öncelikli etüt gerektiren branş <strong className="text-amber-300">{disciplineSignals.weakestSubject?.label || '—'}</strong> ({disciplineSignals.weakestSubject?.avg ?? 0} Net).
                  {precisionAnalytics.highestEmptySubject && precisionAnalytics.highestEmptySubject.avgB >= 5 && (
                    <> En yüksek boş soru potansiyeli <strong className="text-cyan-300">{precisionAnalytics.highestEmptySubject.label}</strong> dersinde (ort. {precisionAnalytics.highestEmptySubject.avgB} boş).</>
                  )}
                  {precisionAnalytics.avgWrongPenalty >= 2 && (
                    <> Yanlış işaretlemeler sınav başına <strong className="text-rose-400">-{precisionAnalytics.avgWrongPenalty} net</strong> kaybettiriyor.</>
                  )}
                </>
              )}
            </p>

            {selectedStudent && (
              <button
                type="button"
                onClick={() => handleSendAcademicWarning(selectedStudent)}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-2 transition"
              >
                {notifiedStudentId === selectedStudent.id ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Öğrenciye Akademik Takip Bildirimi Gönderildi!
                  </>
                ) : (
                  'Öğrenciye Akademik Takip & Etüt Uyarısı Gönder'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SATIR 3: TAM GENİŞLİKTE DENEME & DERS SORU DÖKÜM MATRİSİ */}
      <div className="p-5 rounded-3xl bg-[#0c1229] border border-indigo-500/25 shadow-[0_0_30px_rgba(79,70,229,0.08)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-500/15 pb-3.5">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300/85 block">
              {selectedStudent ? 'SINAV BAZLI SORU KARNESİ (DOĞRU • YANLIŞ • BOŞ • NET)' : 'KURUM GENELİ DENEME SINAVI ÖZET MATRİSİ'}
            </span>
            <h3 className="text-sm sm:text-base font-black text-white mt-0.5">
              {selectedStudent
                ? `${selectedStudent.fullName} — Tüm ${examTypeFilter} Denemeleri Ders & Soru Dökümü (${scopedTypeExams.length})`
                : `Uygulanan ${examTypeFilter} Denemeleri & Ders Ortalamaları (${institutionExamSummaryRows.length})`}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-emerald-400 font-bold">● Doğru (D)</span>
            <span className="text-rose-400 font-bold">● Yanlış (Y)</span>
            <span className="text-slate-400 font-bold">● Boş (B)</span>
          </div>
        </div>

        {scopedTypeExams.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#070b1a] border border-indigo-500/15 text-center text-xs text-slate-400">
            Henüz görüntülenecek {examTypeFilter} deneme sınavı kaydı bulunmuyor.
          </div>
        ) : selectedStudent ? (
          /* ÖĞRENCİ X-RAY: HER DENEMEDE HANGİ DERSTEN KAÇ D / Y / B / NET YAPTIĞI */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2 text-xs">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-1.5 min-w-[200px]">Deneme Adı &amp; Tarih</th>
                  {matrixSubjectColumns.map((col) => (
                    <th key={col.key} className="px-2.5 py-1.5 text-center min-w-[115px]">
                      <div className="text-slate-200">{col.label}</div>
                      <div className="text-[9px] font-mono text-slate-500">({col.max} Soru)</div>
                    </th>
                  ))}
                  <th className="px-3 py-1.5 text-center min-w-[110px]">Toplam D/Y/B</th>
                  <th className="px-3 py-1.5 text-right min-w-[100px]">Toplam Net</th>
                  <th className="px-3 py-1.5 text-right min-w-[82px]">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {[...scopedTypeExams].reverse().map((ex, revIdx, arr) => {
                  const prevChronoExam = arr[revIdx + 1] || null;
                  const diffFromPrev = prevChronoExam
                    ? Number(((Number(ex.totalNet) || 0) - (Number(prevChronoExam.totalNet) || 0)).toFixed(2))
                    : null;

                  const totalD = typeof ex.totalD === 'number'
                    ? ex.totalD
                    : Object.values(ex.sections || {}).reduce((s, v) => s + (Number(v.d) || 0), 0);
                  const totalY = typeof ex.totalY === 'number'
                    ? ex.totalY
                    : Object.values(ex.sections || {}).reduce((s, v) => s + (Number(v.y) || 0), 0);
                  const totalB = typeof ex.totalB === 'number'
                    ? ex.totalB
                    : Math.max(0, (ex.maxPossible || maxPossibleForType) - totalD - totalY);

                  return (
                    <tr key={ex.id} className="bg-[#070b1a] hover:bg-[#0f1733] transition">
                      <td className="px-3.5 py-3 rounded-l-2xl border-y border-l border-indigo-500/15">
                        <div className="font-extrabold text-white text-xs leading-snug">{ex.examName}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{ex.date}</span>
                          {ex.aytTrack && (
                            <span className="px-1.5 py-0.2 rounded bg-fuchsia-500/20 text-fuchsia-300 font-bold">{ex.aytTrack}</span>
                          )}
                        </div>
                      </td>

                      {matrixSubjectColumns.map((col) => {
                        const sec = ex.sections?.[col.key];
                        if (!sec) {
                          return (
                            <td key={col.key} className="px-2.5 py-3 text-center border-y border-indigo-500/15 text-slate-600 font-mono">
                              —
                            </td>
                          );
                        }
                        const d = Number(sec.d) || 0;
                        const y = Number(sec.y) || 0;
                        const b = sec.b !== undefined ? Number(sec.b) : Math.max(0, (sec.max || col.max) - d - y);
                        const net = Number(sec.net) || 0;
                        const fillPct = Math.max(0, Math.min(100, Math.round((net / (sec.max || col.max)) * 100)));

                        return (
                          <td key={col.key} className="px-2.5 py-3 text-center border-y border-indigo-500/15">
                            <div className="font-mono text-xs font-black text-cyan-300">{net.toFixed(2)}</div>
                            <div className="text-[10px] font-mono mt-0.5 whitespace-nowrap">
                              <span className="text-emerald-400 font-bold">{d}D</span>{' '}
                              <span className="text-rose-400 font-bold">{y}Y</span>{' '}
                              <span className="text-slate-500">{b}B</span>
                            </div>
                            <div className="h-1 w-16 mx-auto rounded-full bg-slate-900 overflow-hidden mt-1">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                                style={{ width: `${fillPct}%` }}
                              />
                            </div>
                          </td>
                        );
                      })}

                      <td className="px-3 py-3 text-center border-y border-indigo-500/15 font-mono text-[11px] whitespace-nowrap">
                        <span className="text-emerald-400 font-bold">{totalD}D</span>{' '}
                        <span className="text-rose-400 font-bold">{totalY}Y</span>{' '}
                        <span className="text-slate-400">{totalB}B</span>
                      </td>

                      <td className="px-3 py-3 text-right border-y border-indigo-500/15 whitespace-nowrap">
                        <div className="inline-block px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 font-mono text-xs font-black text-cyan-200">
                          {Number(ex.totalNet).toFixed(2)}
                        </div>
                        {diffFromPrev !== null && (
                          <div className={`text-[10px] font-mono font-extrabold mt-0.5 ${diffFromPrev >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {diffFromPrev >= 0 ? `+${diffFromPrev}` : diffFromPrev}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right rounded-r-2xl border-y border-r border-indigo-500/15">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(ex)}
                            className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/30 transition"
                            title="Bu Denemeyi Düzenle"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExam(ex)}
                            className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/30 transition"
                            title="Bu Deneme Kaydını Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* KURUM MODU: SINAV BAZLI ORTALAMALAR VE ZİRVE ÖĞRENCİ */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2 text-xs">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-1.5 min-w-[200px]">Deneme Adı &amp; Tarih</th>
                  <th className="px-2.5 py-1.5 text-center">Katılım</th>
                  {matrixSubjectColumns.map((col) => (
                    <th key={col.key} className="px-2.5 py-1.5 text-center min-w-[100px]">
                      <div className="text-slate-200">{getShortSubjectLabel(col.key, col.label)} Ort.</div>
                      <div className="text-[9px] font-mono text-slate-500">({col.max} Soru)</div>
                    </th>
                  ))}
                  <th className="px-3 py-1.5 text-center min-w-[130px]">Sınav Birincisi</th>
                  <th className="px-3 py-1.5 text-right min-w-[100px]">Kurum Ort.</th>
                </tr>
              </thead>
              <tbody>
                {institutionExamSummaryRows.map((row) => (
                  <tr key={row.key} className="bg-[#070b1a] hover:bg-[#0f1733] transition">
                    <td className="px-3.5 py-3 rounded-l-2xl border-y border-l border-indigo-500/15">
                      <div className="font-extrabold text-white">{row.examName}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{row.date}</div>
                    </td>
                    <td className="px-2.5 py-3 text-center border-y border-indigo-500/15 font-mono font-bold text-indigo-300">
                      {row.participantCount} Öğr.
                    </td>
                    {matrixSubjectColumns.map((col) => {
                      const sec = row.sections[col.key];
                      if (!sec) {
                        return (
                          <td key={col.key} className="px-2.5 py-3 text-center border-y border-indigo-500/15 text-slate-600 font-mono">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className="px-2.5 py-3 text-center border-y border-indigo-500/15">
                          <div className="font-mono text-xs font-black text-cyan-300">{sec.avgNet}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            <span className="text-emerald-400">{sec.avgD}D</span> / <span className="text-rose-400">{sec.avgY}Y</span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center border-y border-indigo-500/15">
                      <div className="text-xs font-bold text-amber-300 truncate max-w-[150px] mx-auto">{row.topStudentName}</div>
                      <div className="text-[10px] font-mono text-emerald-400 font-bold">{row.maxNet} Net</div>
                    </td>
                    <td className="px-3 py-3 text-right rounded-r-2xl border-y border-r border-indigo-500/15">
                      <span className="px-2.5 py-1 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/35 font-mono text-xs font-black text-fuchsia-200">
                        {row.avgNet} Net
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExamEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => {
          setIsEntryModalOpen(false);
          setEditingExam(null);
        }}
        students={filteredStudentsPool.length > 0 ? filteredStudentsPool : students}
        existingExams={exams}
        editingExam={editingExam}
        defaultStudentId={selectedStudentId}
        defaultExamType={examTypeFilter}
        onSaveExam={handleSaveExamRecord}
      />
    </div>
  );
}