import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';

import AppHeader from './components/common/AppHeader';
import CorporateLandingPage from './components/views/CorporateLandingPage';
import AdminDashboardView from './components/views/AdminDashboardView';
import TeacherPortalView from './components/views/TeacherPortalView';
import StudentPortalView from './components/views/StudentPortalView';
import ThreeTierLoginModal from './components/modals/ThreeTierLoginModal';
import DevOpsArchitectureModal from './components/modals/DevOpsArchitectureModal';
import { apiFetch, getSessionToken } from './utils/api';

export default function App() {
  useEffect(() => {
    document.title = 'HedefBaşarı | Özel Öğretim Kursu & Etüt Otomasyonu';
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="hbGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4f46e5"/><stop offset="50%" stop-color="#6366f1"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="100" height="100" rx="24" fill="url(#hbGrad)"/><text x="50" y="66" font-family="Arial, sans-serif" font-weight="900" font-size="44" fill="#020617" text-anchor="middle">HB</text></svg>`;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml;utf8,${encodeURIComponent(svgFavicon)}`;
  }, []);

  const [staff, setStaff] = useState([]);
  const [students, setStudents] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [adminAuth, setAdminAuth] = useState({ username: 'hedef_admin', photoUrl: '' });
  const [maintenanceMeta, setMaintenanceMeta] = useState({
    lastDailyPurgeLabel: 'Bugün 00:00 (Otonom)',
    lastWeeklyResetLabel: 'Pazartesi 00:00 (Otonom)'
  });
  const [publicStats, setPublicStats] = useState({ studentCount: 4, staffCount: 4, appointmentCount: 1 });

  const isHydratedRef = useRef(false);
  const isRemoteUpdateRef = useRef(false);
  const socketRef = useRef(null);

  const getRealTodayName = () => {
    const map = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return map[new Date().getDay()];
  };

  const [currentSystemDay, setCurrentSystemDay] = useState(getRealTodayName);
  const [smartEveningWindowOpen, setSmartEveningWindowOpen] = useState(() => new Date().getHours() >= 20);

  const [activeView, setActiveView] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('hb_active_session') || '{}');
      return saved.token && saved.activeView ? saved.activeView : 'landing';
    } catch {
      return 'landing';
    }
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('hb_active_session') || '{}');
      return saved.token ? saved.currentUser : null;
    } catch {
      return null;
    }
  });

  const [authToken, setAuthToken] = useState(() => getSessionToken());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDevOpsModalOpen, setIsDevOpsModalOpen] = useState(false);

  const MAX_NOTIFICATIONS_PER_USER = 10;

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setAuthToken(null);
    setActiveView('landing');
    sessionStorage.removeItem('hb_active_session');
  }, []);

  useEffect(() => {
    window.addEventListener('hb:unauthorized', handleLogout);
    return () => window.removeEventListener('hb:unauthorized', handleLogout);
  }, [handleLogout]);

  // Vitrin veya Rol Bazlı State Çekme Fonksiyonu
  const fetchSystemData = useCallback(async () => {
    try {
      if (!getSessionToken() || activeView === 'landing') {
        const res = await fetch('/api/system/public');
        const data = await res.json();
        if (data && !data.error) {
          isRemoteUpdateRef.current = true;
          if (Array.isArray(data.staff)) setStaff(data.staff);
          if (data.stats) setPublicStats(data.stats);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
        }
        return;
      }

      const res = await apiFetch('/api/system/state');
      if (!res.ok) return;
      const data = await res.json();
      if (data && !data.error) {
        isRemoteUpdateRef.current = true;
        if (Array.isArray(data.staff)) setStaff(data.staff);
        if (Array.isArray(data.students)) setStudents(data.students);
        if (Array.isArray(data.appointments)) setAppointments(data.appointments);
        if (Array.isArray(data.assignments)) setAssignments(data.assignments);
        if (Array.isArray(data.notifications)) setNotifications(data.notifications);
        if (data.adminAuth) setAdminAuth(data.adminAuth);
        if (data.maintenanceMeta) setMaintenanceMeta(data.maintenanceMeta);
        isHydratedRef.current = true;
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
      }
    } catch {
      isHydratedRef.current = true;
    }
  }, [activeView]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData, authToken]);

  useEffect(() => {
    const socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('system:refresh_required', (payload) => {
      if (payload?.senderSocketId && payload.senderSocketId === socket.id) return;
      fetchSystemData();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchSystemData]);

  // Yerel değişiklikleri yalnızca oturum açıkken sunucuya senkronize et
  useEffect(() => {
    if (!isHydratedRef.current || isRemoteUpdateRef.current || activeView === 'landing' || !authToken) return;

    const timer = setTimeout(() => {
      apiFetch('/api/system/sync', {
        method: 'POST',
        body: JSON.stringify({
          staff,
          students,
          appointments,
          assignments,
          notifications,
          maintenanceMeta,
          senderSocketId: socketRef.current?.id || null
        })
      }).catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [staff, students, appointments, assignments, notifications, maintenanceMeta, activeView, authToken]);

  // Yalnızca UI gün ve 20:00 penceresi kontrolü (Veri silme cron'u sunucudadır)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSystemDay(getRealTodayName());
      setSmartEveningWindowOpen(new Date().getHours() >= 20);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const emitSocketEvent = (channel, text, targetNotification = null) => {
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (targetNotification) {
      const inferredCategory =
        targetNotification.category ||
        (channel.includes('summon') || targetNotification.type === 'warning'
          ? 'summon'
          : channel.includes('assign')
          ? 'homework'
          : 'appointment');

      setNotifications((prev) => {
        const newEntry = {
          id: `notif-${Date.now()}-${Math.random()}`,
          isRead: false,
          category: inferredCategory,
          ...targetNotification,
          time: timeStr
        };
        const updated = [newEntry, ...prev];
        let userCount = 0;
        return updated.filter((item) => {
          if (item.targetUserId === newEntry.targetUserId) {
            userCount += 1;
            return userCount <= MAX_NOTIFICATIONS_PER_USER;
          }
          return true;
        });
      });
    }
  };

  const handleLoginSuccess = (role, userObj, token) => {
    setIsLoginModalOpen(false);
    const nextUser = { ...userObj, role };
    sessionStorage.setItem('hb_active_session', JSON.stringify({ activeView: role, currentUser: nextUser, token }));
    setAuthToken(token);
    setCurrentUser(nextUser);
    setActiveView(role);
  };

  const handleAdminDailyPurge = async () => {
    await apiFetch('/api/admin/purge-daily', { method: 'POST' });
    fetchSystemData();
  };

  const handleAdminWeeklyReset = async () => {
    await apiFetch('/api/admin/reset-weekly', { method: 'POST' });
    fetchSystemData();
  };

  const activeHeaderAvatar = useMemo(() => {
    if (activeView === 'admin') return adminAuth.photoUrl || '';
    if (activeView === 'teacher') {
      const t = staff.find((item) => item.id === currentUser?.id) || staff[0];
      return t?.photoUrl || '';
    }
    return '';
  }, [activeView, adminAuth.photoUrl, staff, currentUser]);

  const activeHeaderName = useMemo(() => {
    if (activeView === 'admin') return `Yönetici (${adminAuth.username})`;
    if (activeView === 'teacher') {
      const t = staff.find((item) => item.id === currentUser?.id) || staff[0];
      return t?.fullName || currentUser?.fullName || 'Eğitmen';
    }
    if (activeView === 'student') {
      const s = students.find((item) => item.id === currentUser?.id) || currentUser;
      return s?.fullName || 'Öğrenci';
    }
    return '';
  }, [activeView, adminAuth.username, staff, students, currentUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {activeView !== 'landing' && (
        <AppHeader
          activeView={activeView}
          currentSystemDay={currentSystemDay}
          activeHeaderAvatar={activeHeaderAvatar}
          activeHeaderName={activeHeaderName}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {activeView === 'landing' && (
        <CorporateLandingPage
          staff={staff}
          publicStats={publicStats}
          onOpenLogin={() => setIsLoginModalOpen(true)}
        />
      )}

      {activeView === 'admin' && (
        <AdminDashboardView
          staff={staff} setStaff={setStaff}
          students={students} setStudents={setStudents}
          appointments={appointments} setAppointments={setAppointments}
          assignments={assignments} setAssignments={setAssignments}
          adminAuth={adminAuth} setAdminAuth={setAdminAuth}
          lastDailyPurgeLabel={maintenanceMeta.lastDailyPurgeLabel}
          onTriggerDailyPurge={handleAdminDailyPurge}
          lastWeeklyResetLabel={maintenanceMeta.lastWeeklyResetLabel}
          onTriggerWeeklyReset={handleAdminWeeklyReset}
          emitSocketEvent={emitSocketEvent}
          onOpenDevOps={() => setIsDevOpsModalOpen(true)}
        />
      )}

      {activeView === 'teacher' && (
        <TeacherPortalView
          currentTeacher={staff.find((t) => t.id === currentUser?.id) || staff[0]}
          students={students}
          appointments={appointments} setAppointments={setAppointments}
          assignments={assignments} setAssignments={setAssignments}
          lastWeeklyResetLabel={maintenanceMeta.lastWeeklyResetLabel}
          emitSocketEvent={emitSocketEvent}
        />
      )}

      {activeView === 'student' && (
        <StudentPortalView
          currentStudent={students.find((s) => s.id === currentUser?.id) || currentUser || students[0]}
          staff={staff}
          appointments={appointments} setAppointments={setAppointments}
          assignments={assignments} setAssignments={setAssignments}
          notifications={notifications} setNotifications={setNotifications}
          currentSystemDay={currentSystemDay}
          smartEveningWindowOpen={smartEveningWindowOpen}
          emitSocketEvent={emitSocketEvent}
        />
      )}

      <ThreeTierLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <DevOpsArchitectureModal
        isOpen={isDevOpsModalOpen}
        onClose={() => setIsDevOpsModalOpen(false)}
      />
    </div>
  );
}