const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Çok fazla başarısız giriş denemesi. Lütfen 1 dakika bekleyin.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' }
});

module.exports = { loginLimiter, apiLimiter };