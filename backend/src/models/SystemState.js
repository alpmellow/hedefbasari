const mongoose = require('mongoose');

const SystemStateSchema = new mongoose.Schema({
  key: { type: String, default: 'main_state', unique: true },
  staff: { type: Array, default: [] },
  students: { type: Array, default: [] },
  appointments: { type: Array, default: [] },
  assignments: { type: Array, default: [] },
  exams: { type: Array, default: [] },
  notifications: { type: Array, default: [] },
  adminAuth: {
    username: { type: String, default: 'hedef_admin' },
    passwordHash: { type: String, default: '' },
    photoUrl: { type: String, default: '' }
  },
  maintenanceMeta: {
    lastDailyPurgeDate: { type: String, default: '' },
    lastWeeklyResetMonday: { type: String, default: '' },
    lastDailyPurgeLabel: { type: String, default: 'Bugün 00:00 (Otonom)' },
    lastWeeklyResetLabel: { type: String, default: 'Pazartesi 00:00 (Otonom)' }
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemState', SystemStateSchema);