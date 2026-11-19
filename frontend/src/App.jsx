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

const DEFAULT_MAINTENANCE_META = {
  lastDailyPurgeLabel: 'Bugün 00:00 (Otonom)',
  lastWeeklyResetLabel: 'Pazartesi 00:00 (Otonom)'
};

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
  const [exams, setExams] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [adminAuth, setAdminAuth] = useState({ username: 'hedef_admin', photoUrl: '' });
  const [maintenanceMeta, setMaintenanceMeta] = useState(DEFAULT_MAINTENANCE_META);
  const [publicStats, setPublicStats] = useState({ studentCount: 4, staffCount: 4, appointmentCount: 1 });

  const isHydratedRef = useRef(false);
  const isRemoteUpdateRef = useRef(false);
  const lastSyncedPayloadRef = useRef('');
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

  const resetPrivateState = useCallback(() => {
    isHydratedRef.current = false;
    isRemoteUpdateRef.current = true;
    lastSyncedPayloadRef.current = '';
    setStudents([]);
    setAppointments([]);
    setAssignments([]);
    setExams([]);
    setNotifications([]);
  }, []);

  const handleLogout = useCallback(() => {
    resetPrivateState();
    setCurrentUser(null);
    setAuthToken(null);
    setActiveView('landing');
    sessionStorage.removeItem('hb_active_session');
  }, [resetPrivateState]);

  useEffect(() => {
    window.addEventListener('hb:unauthorized', handleLogout);
    return () => window.removeEventListener('hb:unauthorized', handleLogout);
  }, [handleLogout]);

  // Vitrin veya Rol Bazlı State Çekme Fonksiyonu
  const fetchSystemData = useCallback(async () => {
    try {
      const token = getSessionToken();
      if (!token || activeView === 'landing') {
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
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      if (data && !data.error) {
        const nextStaff = Array.isArray(data.staff) ? data.staff : [];
        const nextStudents = Array.isArray(data.students) ? data.students : [];
        const nextAppointments = Array.isArray(data.appointments) ? data.appointments : [];
        const nextAssignments = Array.isArray(data.assignments) ? data.assignments : [];
        const nextExams = Array.isArray(data.exams) ? data.exams : [];
        const nextNotifications = Array.isArray(data.notifications) ? data.notifications : [];
        const nextMaintenanceMeta = data.maintenanceMeta || DEFAULT_MAINTENANCE_META;

        isRemoteUpdateRef.current = true;
        lastSyncedPayloadRef.current = JSON.stringify({
          staff: nextStaff,
          students: nextStudents,
          appointments: nextAppointments,
          assignments: nextAssignments,
          exams: nextExams,
          notifications: nextNotifications,
          maintenanceMeta: nextMaintenanceMeta
        });

        setStaff(nextStaff);
        setStudents(nextStudents);
        setAppointments(nextAppointments);
        setAssignments(nextAssignments);
        setExams(nextExams);
        setNotifications(nextNotifications);
        if (data.adminAuth) setAdminAuth(data.adminAuth);
        setMaintenanceMeta(nextMaintenanceMeta);

        isHydratedRef.current = true;
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 150);
      }
    } catch {
      // Ağ hatasında isHydratedRef kesinlikle true yapılmaz (boş verinin DB'yi ezmesini engeller)
    }
  }, [activeView, handleLogout]);

  const fetchSystemDataRef = useRef(fetchSystemData);
  useEffect(() => {
    fetchSystemDataRef.current = fetchSystemData;
  }, [fetchSystemData]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData, authToken]);

  // JWT Kimlik Doğrulamalı Canlı Socket.io Bağlantısı
  useEffect(() => {
    if (!authToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io('/', {
      path: '/socket.io',
      auth: { token: authToken },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('system:refresh_required', (payload) => {
      if (payload?.senderSocketId && payload.senderSocketId === socket.id) return;
      fetchSystemDataRef.current();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken]);

  // Silinen öğretmen/öğrenci oturumunu otomatik kapat
  useEffect(() => {
    if (!isHydratedRef.current || !currentUser) return;
    if (activeView === 'teacher' && staff.length > 0 && !staff.some((t) => t.id === currentUser.id)) {
      handleLogout();
    } else if (activeView === 'student' && students.length > 0 && !students.some((s) => s.id === currentUser.id)) {
      handleLogout();
    }
  }, [activeView, currentUser, staff, students, handleLogout]);

  // Sadece gerçek yerel değişiklikleri sunucuya senkronize et
  useEffect(() => {
    if (!isHydratedRef.current || isRemoteUpdateRef.current || activeView === 'landing' || !authToken) return;

    const payloadObj = {
      staff,
      students,
      appointments,
      assignments,
      exams,
      notifications,
      maintenanceMeta
    };
    const payloadStr = JSON.stringify(payloadObj);

    if (payloadStr === lastSyncedPayloadRef.current) return;

    const timer = setTimeout(() => {
      if (!isHydratedRef.current || isRemoteUpdateRef.current) return;
      lastSyncedPayloadRef.current = payloadStr;
      apiFetch('/api/system/sync', {
        method: 'POST',
        body: JSON.stringify({
          ...payloadObj,
          senderSocketId: socketRef.current?.id || null
        })
      }).catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [staff, students, appointments, assignments, exams, notifications, maintenanceMeta, activeView, authToken]);

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
    resetPrivateState();
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

  const activeTeacher = useMemo(
    () => staff.find((item) => item.id === currentUser?.id) || currentUser || null,
    [staff, currentUser]
  );

  const activeStudent = useMemo(
    () => students.find((item) => item.id === currentUser?.id) || currentUser || null,
    [students, currentUser]
  );

  const activeHeaderAvatar = useMemo(() => {
    if (activeView === 'admin') return adminAuth.photoUrl || '';
    if (activeView === 'teacher') return activeTeacher?.photoUrl || '';
    return '';
  }, [activeView, adminAuth.photoUrl, activeTeacher]);

  const activeHeaderName = useMemo(() => {
    if (activeView === 'admin') return `Yönetici (${adminAuth.username})`;
    if (activeView === 'teacher') return activeTeacher?.fullName || 'Eğitmen';
    if (activeView === 'student') return activeStudent?.fullName || 'Öğrenci';
    return '';
  }, [activeView, adminAuth.username, activeTeacher, activeStudent]);

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
          exams={exams} setExams={setExams}
          adminAuth={adminAuth} setAdminAuth={setAdminAuth}
          lastDailyPurgeLabel={maintenanceMeta.lastDailyPurgeLabel}
          onTriggerDailyPurge={handleAdminDailyPurge}
          lastWeeklyResetLabel={maintenanceMeta.lastWeeklyResetLabel}
          onTriggerWeeklyReset={handleAdminWeeklyReset}
          emitSocketEvent={emitSocketEvent}
          onOpenDevOps={() => setIsDevOpsModalOpen(true)}
        />
      )}

      {activeView === 'teacher' && activeTeacher && (
        <TeacherPortalView
          currentTeacher={activeTeacher}
          students={students}
          appointments={appointments} setAppointments={setAppointments}
          assignments={assignments} setAssignments={setAssignments}
          lastWeeklyResetLabel={maintenanceMeta.lastWeeklyResetLabel}
          emitSocketEvent={emitSocketEvent}
        />
      )}

      {activeView === 'student' && activeStudent && (
        <StudentPortalView
          currentStudent={activeStudent}
          staff={staff}
          appointments={appointments} setAppointments={setAppointments}
          assignments={assignments} setAssignments={setAssignments}
          exams={exams}
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