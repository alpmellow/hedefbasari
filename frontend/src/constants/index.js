export const ENABLE_EXAM_ANALYTICS = false;
export const MAX_WEEKLY_APPOINTMENTS = 12;
export const MAX_SLOT_QUOTA = 8;

export const HEDEFBASARI_CLASS_OPTIONS = [
  '12. Sınıf - SAY (Sayısal)',
  '12. Sınıf - EA (Eşit Ağırlık)',
  '12. Sınıf - SÖZ (Sözel)',
  'Mezun - SAY (Sayısal)',
  'Mezun - EA (Eşit Ağırlık)',
  'Mezun - SÖZ (Sözel)',
  '11. Sınıf - SAY (Sayısal)',
  '11. Sınıf - EA (Eşit Ağırlık)'
];

export const TUTORING_PURPOSES = ['Konu Anlatımı', 'Soru Çözümü', 'Öğrenci Kontrolü'];

export const DAYS_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export const HOURS_LIST = [
  { slot: 1, time: '08:30', endTime: '09:20', range: '08:30 - 09:20', title: '1. Ders', label: '1. Ders (08:30 - 09:20)' },
  { slot: 2, time: '09:30', endTime: '10:20', range: '09:30 - 10:20', title: '2. Ders', label: '2. Ders (09:30 - 10:20)' },
  { slot: 3, time: '10:30', endTime: '11:20', range: '10:30 - 11:20', title: '3. Ders', label: '3. Ders (10:30 - 11:20)' },
  { slot: 4, time: '11:30', endTime: '12:20', range: '11:30 - 12:20', title: '4. Ders', label: '4. Ders (11:30 - 12:20)' },
  { slot: 5, time: '13:30', endTime: '14:20', range: '13:30 - 14:20', title: '5. Ders', label: '5. Ders (13:30 - 14:20)' },
  { slot: 6, time: '14:30', endTime: '15:20', range: '14:30 - 15:20', title: '6. Ders', label: '6. Ders (14:30 - 15:20)' },
  { slot: 7, time: '15:30', endTime: '16:20', range: '15:30 - 16:20', title: '7. Ders', label: '7. Ders (15:30 - 16:20)' },
  { slot: 8, time: '16:30', endTime: '17:20', range: '16:30 - 17:20', title: '8. Ders', label: '8. Ders (16:30 - 17:20)' },
  { slot: 9, time: '19:00', endTime: '19:50', range: '19:00 - 19:50', title: '9. Ders', label: '9. Ders (19:00 - 19:50)' },
  { slot: 10, time: '20:00', endTime: '20:50', range: '20:00 - 20:50', title: '10. Ders', label: '10. Ders (20:00 - 20:50)' }
];

export const INFRASTRUCTURE_FILES = {
  'docker-compose.yml': `version: '3.8'
services:
  mongodb:
    image: mongo:7.0
    container_name: hedefbasari_db
    restart: always
    volumes:
- mongo_data:/data/db

  redis:
    image: redis:7.4-alpine
    container_name: hedefbasari_redis
    restart: always
    volumes:
- redis_data:/data

  backend:
    build: ./backend
    container_name: hedefbasari_backend
    restart: always
    environment:
- NODE_ENV=production
- PORT=5000
- MONGO_URI=mongodb://mongodb:27017/hedefbasari
- JWT_SECRET=hb_enterprise_super_secret_key_2026
- TZ=Europe/Istanbul
    depends_on:
- mongodb
- redis

  frontend:
    build: ./frontend
    container_name: hedefbasari_frontend
    restart: always
    depends_on:
- backend

  nginx:
    image: nginx:1.27-alpine
    container_name: hedefbasari_nginx
    restart: always
    ports:
- "80:80"
    volumes:
- ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
- frontend
- backend

volumes:
  mongo_data:
  redis_data:`,

  'nginx/nginx.conf': `events { worker_connections 2048; }
http {
    include       mime.types;
    default_type  application/octet-stream;
    client_max_body_size 5M;
    resolver      127.0.0.11 valid=5s ipv6=off;
    server {
        listen 80;
        location / {
            set $frontend_upstream http://frontend:80;
            proxy_pass $frontend_upstream;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        location /api/ {
            set $backend_upstream http://backend:5000;
            proxy_pass $backend_upstream;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        location /socket.io/ {
            set $socket_upstream http://backend:5000;
            proxy_pass $socket_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400s;
        }
    }
}`
};