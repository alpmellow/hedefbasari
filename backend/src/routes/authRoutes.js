const express = require('express');
const bcrypt = require('bcryptjs');
const { ensureSeedState } = require('../config/db');
const { loginLimiter } = require('../middleware/rateLimiter');
const { signToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { tier, tcNo, username, secret } = req.body;
    const state = await ensureSeedState();

    if (tier === 'student') {
      const found = (state.students || []).find(
        (s) => String(s.tcNo).trim() === String(tcNo).trim() && String(s.pin).trim() === String(secret).trim()
      );
      if (!found) {
        return res.status(401).json({ error: 'Hatalı 11 Haneli Öğrenci TC No veya 6 Haneli Sayısal Şifre.' });
      }
      const token = signToken({ id: found.id, role: 'student', fullName: found.fullName });
      return res.json({
        success: true,
        role: 'student',
        token,
        user: { id: found.id, tcNo: found.tcNo, fullName: found.fullName, className: found.className, paymentStatus: found.paymentStatus }
      });
    }

    if (tier === 'teacher') {
      const found = (state.staff || []).find(
        (t) => String(t.tcNo).trim() === String(tcNo).trim() && String(t.securityKey).trim() === String(secret).trim()
      );
      if (!found) {
        return res.status(401).json({ error: 'Hatalı 11 Haneli Öğretmen TC No veya 8 Haneli Güvenlik Anahtarı.' });
      }
      const token = signToken({ id: found.id, role: 'teacher', fullName: found.fullName });
      const { securityKey, ...safeTeacher } = found;
      return res.json({ success: true, role: 'teacher', token, user: safeTeacher });
    }

    if (tier === 'admin') {
      const activeUser = state.adminAuth?.username || 'hedef_admin';
      const isUserMatch = String(username).trim() === activeUser;
      const isPassMatch = await bcrypt.compare(String(secret || ''), state.adminAuth?.passwordHash || '');

      if (!isUserMatch || !isPassMatch) {
        return res.status(401).json({ error: 'Hatalı Yönetici kullanıcı adı veya şifresi.' });
      }

      const adminUser = {
        id: 'admin-1',
        fullName: `Sistem Yöneticisi (${activeUser})`,
        username: activeUser,
        photoUrl: state.adminAuth?.photoUrl || ''
      };
      const token = signToken({ id: 'admin-1', role: 'admin', username: activeUser });
      return res.json({ success: true, role: 'admin', token, user: adminUser });
    }

    return res.status(400).json({ error: 'Geçersiz giriş kademesi.' });
  } catch (err) {
    res.status(500).json({ error: 'Giriş doğrulaması sırasında sunucu hatası oluştu.' });
  }
});

module.exports = router;