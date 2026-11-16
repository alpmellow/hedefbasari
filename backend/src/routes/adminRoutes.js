const express = require('express');
const bcrypt = require('bcryptjs');
const { ensureSeedState } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { performDailyPurge, performWeeklyReset } = require('../jobs/cronJobs');
const { getNowTimeTR } = require('../utils/dateUtils');

function isSafeImageUrl(url) {
  if (!url) return true;
  if (typeof url !== 'string' || url.length > 500000) return false;
  return /^https:\/\/.+/i.test(url) || /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(url);
}

module.exports = function (io) {
  const router = express.Router();

  router.post('/credentials', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const { currentPassword, newUsername, newPassword, photoUrl } = req.body;
      const state = await ensureSeedState();

      const isCurrentValid = await bcrypt.compare(String(currentPassword || ''), state.adminAuth.passwordHash || '');
      if (!isCurrentValid) {
        return res.status(401).json({ error: 'Mevcut yönetici şifrenizi hatalı girdiniz.' });
      }

      if (newPassword && String(newPassword).length < 8) {
        return res.status(400).json({ error: 'Yeni yönetici şifresi en az 8 karakter olmalıdır.' });
      }

      if (typeof photoUrl === 'string' && !isSafeImageUrl(photoUrl)) {
        return res.status(400).json({ error: 'Geçersiz veya çok büyük profil fotoğrafı formatı.' });
      }

      const updatedHash = newPassword ? await bcrypt.hash(String(newPassword), 10) : state.adminAuth.passwordHash;

      state.adminAuth = {
        username: newUsername ? newUsername.trim() : state.adminAuth.username,
        passwordHash: updatedHash,
        photoUrl: typeof photoUrl === 'string' ? photoUrl : state.adminAuth.photoUrl
      };

      await state.save();
      io.emit('system:refresh_required', { senderSocketId: null });

      res.json({
        success: true,
        adminAuth: {
          username: state.adminAuth.username,
          photoUrl: state.adminAuth.photoUrl
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Yönetici bilgileri güncellenemedi.' });
    }
  });

  router.post('/purge-daily', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const nowStr = getNowTimeTR();
      await performDailyPurge(io, `Manuel Temizlendi (${nowStr})`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Günlük onay masası temizlenemedi.' });
    }
  });

  router.post('/reset-weekly', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const nowStr = getNowTimeTR();
      await performWeeklyReset(io, `Manuel Sıfırlandı (${nowStr})`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Haftalık sıfırlama gerçekleştirilemedi.' });
    }
  });

  return router;
};
