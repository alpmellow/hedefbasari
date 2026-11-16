const cron = require('node-cron');
const { ensureSeedState } = require('../config/db');
const { getTodayDateKey, getCurrentWeekMondayKey, getRealTodayNameTR, getNowTimeTR } = require('../utils/dateUtils');

async function performDailyPurge(io, customLabel = null) {
  const state = await ensureSeedState();
  const todayName = getRealTodayNameTR();
  const todayKey = getTodayDateKey();
  const nowStr = getNowTimeTR();

  state.appointments = (state.appointments || [])
    .map((slot) => {
      // Manuel temizlikte tüm aktif masayı, otonom gece 00:00'da ise geçmiş günleri arşivle
      const shouldArchive = customLabel ? true : slot.day !== todayName;
      if (shouldArchive) {
        return {
          ...slot,
          archivedFromDesk: true,
          participants: (slot.participants || []).filter((p) => p.status !== 'Rejected')
        };
      }
      return { ...slot, archivedFromDesk: false };
    })
    .filter((slot) => (slot.participants || []).length > 0);

  state.maintenanceMeta = {
    ...state.maintenanceMeta,
    lastDailyPurgeDate: todayKey,
    lastDailyPurgeLabel: customLabel || `Gece 00:00 Sunucu Otonom (${nowStr})`
  };

  await state.save();
  if (io) io.emit('system:refresh_required', { senderSocketId: null });
  return state;
}

async function performWeeklyReset(io, customLabel = null) {
  const state = await ensureSeedState();
  const nowStr = getNowTimeTR();

  // Pazar 20:00'den sonra Pazartesi günü için alınmış olan yeni randevuları koru (manuel sıfırlama değilse)
  if (!customLabel) {
    state.appointments = (state.appointments || []).filter(
      (slot) => !slot.archivedFromDesk && slot.day === 'Pazartesi'
    );
  } else {
    state.appointments = [];
  }

  state.assignments = [];
  state.maintenanceMeta = {
    lastDailyPurgeDate: getTodayDateKey(),
    lastWeeklyResetMonday: getCurrentWeekMondayKey(),
    lastDailyPurgeLabel: customLabel || `Pazartesi 00:00 Sunucu Otonom (${nowStr})`,
    lastWeeklyResetLabel: customLabel || `Pazartesi 00:00 Sunucu Otonom (${nowStr})`
  };

  await state.save();
  if (io) io.emit('system:refresh_required', { senderSocketId: null });
  return state;
}

function initCronJobs(io) {
  cron.schedule('0 0 * * *', async () => {
    try {
      await performDailyPurge(io);
      console.log('[Cron 00:00] Günlük Randevu Onay Masası temizliği tamamlandı.');
    } catch (err) {
      console.error('[Cron 00:00 Hatası]:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  cron.schedule('0 0 * * 1', async () => {
    try {
      await performWeeklyReset(io);
      console.log('[Cron Pazartesi 00:00] Haftalık kotalar ve ödevler sıfırlandı.');
    } catch (err) {
      console.error('[Cron Haftalık Sıfırlama Hatası]:', err);
    }
  }, { timezone: 'Europe/Istanbul' });
}

module.exports = { initCronJobs, performDailyPurge, performWeeklyReset };