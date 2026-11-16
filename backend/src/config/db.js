const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const SystemState = require('../models/SystemState');
const { INITIAL_STAFF, INITIAL_STUDENTS } = require('./seedData');
const { getTodayDateKey, getCurrentWeekMondayKey } = require('../utils/dateUtils');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/hedefbasari';

async function ensureSeedState() {
  let state = await SystemState.findOne({ key: 'main_state' });
  const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!';

  if (!state) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    state = await SystemState.create({
      key: 'main_state',
      staff: INITIAL_STAFF,
      students: INITIAL_STUDENTS,
      appointments: [],
      assignments: [],
      notifications: [],
      adminAuth: { username: 'hedef_admin', passwordHash, photoUrl: '' },
      maintenanceMeta: {
        lastDailyPurgeDate: getTodayDateKey(),
        lastWeeklyResetMonday: getCurrentWeekMondayKey(),
        lastDailyPurgeLabel: 'Bugün 00:00 (Otonom)',
        lastWeeklyResetLabel: 'Pazartesi 00:00 (Otonom)'
      }
    });
    console.log('✅ İlk kurulum verileri (Seed) bcrypt şifrelemeli olarak oluşturuldu.');
  } else if (!state.adminAuth?.passwordHash) {
    const legacyPlain = state.toObject().adminAuth?.password || defaultPassword;
    state.adminAuth.passwordHash = await bcrypt.hash(legacyPlain, 10);
    await state.save();
  }
  return state;
}

async function connectDB() {
  await mongoose.connect(MONGO_URI, {
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 5000
  });
  console.log('📦 MongoDB Veritabanına (Pool: 50) Başarıyla Bağlanıldı!');
  await ensureSeedState();
}

module.exports = { connectDB, ensureSeedState };
