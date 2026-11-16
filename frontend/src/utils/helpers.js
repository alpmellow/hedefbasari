import { HOURS_LIST } from '../constants';

export function formatSlotLabel(hourSlot) {
  const found = HOURS_LIST.find((h) => h.slot === Number(hourSlot));
  if (!found) return `${hourSlot}. Saat`;
  return `${found.title} (${found.range})`;
}

export function getSlotRange(hourSlot) {
  const found = HOURS_LIST.find((h) => h.slot === Number(hourSlot));
  return found ? found.range : '';
}

export function getPurposeBadgeStyle(purpose) {
  if (purpose === 'Konu Anlatımı') return 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30';
  if (purpose === 'Soru Çözümü') return 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30';
  return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
}

export function maskTcKimlik(tc) {
  const s = String(tc || '').trim();
  if (s.length !== 11) return '***********';
  return `${s.slice(0, 3)}******${s.slice(9)}`;
}

export function generateRandom6DigitPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateRandom8CharKey() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'HB';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getInitialsFromName(name = '') {
  const cleaned = String(name).replace(/(Prof\.|Doç\.|Dr\.|Yük\.|Müh\.|Öğr\.|Gör\.)/gi, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function compressImageFromFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      callback(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

export function getNextMidnightMs() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

export function getNextMondayMidnightMs() {
  const now = new Date();
  const next = new Date(now);
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next.getTime();
}

export function getTodayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
