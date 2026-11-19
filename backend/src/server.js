const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

const { connectDB } = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');
const { JWT_SECRET } = require('./middleware/authMiddleware');
const { initCronJobs } = require('./jobs/cronJobs');
const authRoutes = require('./routes/authRoutes');
const createAdminRoutes = require('./routes/adminRoutes');
const createSystemRoutes = require('./routes/systemRoutes');

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : '*';

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});

// Socket.io JWT Kimlik Doğrulama Katmanı
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Yetkisiz Socket bağlantısı'));
  }
  try {
    socket.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    next(new Error('Geçersiz veya süresi dolmuş Socket anahtarı'));
  }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use('/api/', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/admin', createAdminRoutes(io));
app.use('/api/system', createSystemRoutes(io));

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    initCronJobs(io);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 HedefBaşarı Güvenli API, Cron ve Socket.io ${PORT} portunda devrede!`);
    });
  })
  .catch((err) => console.error('MongoDB Bağlantı Hatası:', err));