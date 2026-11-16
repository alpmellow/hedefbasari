import React, { useState, useEffect, useRef } from 'react';
import UserAvatar from '../common/UserAvatar';
import {
  Lock, XCircle, Menu, ShieldCheck, Users, Award, Calendar,
  Activity, BookOpen, Sparkles, Server, ChevronLeft, ChevronRight,
  Instagram, MapPin, Phone, Mail
} from '../common/Icons';

export default function CorporateLandingPage({ staff, publicStats, onOpenLogin }) {
  const carouselRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (id) => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (isPaused || !carouselRef.current) return;
    const timer = setInterval(() => {
      const el = carouselRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 15) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 340, behavior: 'smooth' });
      }
    }, 3200);
    return () => clearInterval(timer);
  }, [isPaused, staff]);

  const handleManualScroll = (dir) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 -z-10 h-[800px]" />

      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 cursor-pointer group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition">
              HB
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white block leading-none">HedefBaşarı</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">Özel Öğretim Kursu</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <button onClick={() => scrollToSection('hakkimizda')} className="hover:text-cyan-400 transition">Hakkımızda</button>
            <button onClick={() => scrollToSection('misyonumuz')} className="hover:text-cyan-400 transition">Misyonumuz</button>
            <button onClick={() => scrollToSection('vizyonumuz')} className="hover:text-cyan-400 transition">Vizyonumuz</button>
            <button onClick={() => scrollToSection('kadromuz')} className="hover:text-cyan-400 transition">Kadromuz</button>
            <button onClick={() => scrollToSection('iletisim')} className="hover:text-cyan-400 transition">İletişim</button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={onOpenLogin} className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition transform active:scale-95">
              <Lock className="w-4 h-4 hidden sm:block" />
              <span>Sisteme Giriş</span>
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition">
              {isMobileMenuOpen ? <XCircle className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 p-4 flex flex-col gap-2 shadow-2xl">
            <button onClick={() => scrollToSection('hakkimizda')} className="text-left font-bold text-slate-300 hover:text-cyan-400 py-3 px-2 border-b border-slate-800/50">Hakkımızda</button>
            <button onClick={() => scrollToSection('misyonumuz')} className="text-left font-bold text-slate-300 hover:text-cyan-400 py-3 px-2 border-b border-slate-800/50">Misyonumuz</button>
            <button onClick={() => scrollToSection('vizyonumuz')} className="text-left font-bold text-slate-300 hover:text-cyan-400 py-3 px-2 border-b border-slate-800/50">Vizyonumuz</button>
            <button onClick={() => scrollToSection('kadromuz')} className="text-left font-bold text-slate-300 hover:text-cyan-400 py-3 px-2 border-b border-slate-800/50">Kadromuz</button>
            <button onClick={() => scrollToSection('iletisim')} className="text-left font-bold text-slate-300 hover:text-cyan-400 py-3 px-2">İletişim</button>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden pt-20 pb-28 sm:pt-28 sm:pb-36 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 mb-6 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          KVKK / GDPR Uyumlu • Yeni Nesil Eğitim Teknolojileri • Akıllı Yönetim Sistemleri
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Disiplinli Akademik Koçluk ve{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400">
            Gerçek Zamanlı Etüt Yönetimi
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          YKS ve LGS hazırlık süreçlerine yönelik; haftalık 12 birebir veya grup etüt hakkı, konu anlatımı, soru çözümü ve öğrenci gelişim takibini tek bir platformda buluşturan kapsamlı dijital eğitim yönetim sistemi.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button onClick={onOpenLogin} className="px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition">
            Portala Giriş Yap
          </button>
          <button onClick={() => scrollToSection('kadromuz')} className="px-6 py-3.5 rounded-2xl bg-slate-900/50 hover:bg-slate-800 backdrop-blur-sm border border-slate-700 text-cyan-300 font-bold text-sm transition">
            Akademik Kadromuzu İncele →
          </button>
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-24 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 p-4 sm:p-6 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl shadow-indigo-900/20">
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <Users className="w-6 h-6 text-cyan-400 mb-2" />
            <span className="text-2xl sm:text-3xl font-black text-white">{publicStats?.studentCount ?? 4}</span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mt-1">Aktif Öğrenci</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <Award className="w-6 h-6 text-indigo-400 mb-2" />
            <span className="text-2xl sm:text-3xl font-black text-white">{staff.length}</span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mt-1">Uzman Kadro</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <Calendar className="w-6 h-6 text-emerald-400 mb-2" />
            <span className="text-2xl sm:text-3xl font-black text-white">{Math.max(1, publicStats?.appointmentCount ?? 1) * 8}</span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mt-1">Aktif Etüt Koltuk Kapasitesi</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <Activity className="w-6 h-6 text-amber-400 mb-2" />
            <span className="text-2xl sm:text-3xl font-black text-white">%100</span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mt-1">Canlı Sistem</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid md:grid-cols-3 gap-8">
        <div id="hakkimizda" className="p-8 rounded-3xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 transition scroll-mt-32">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20"><BookOpen className="w-6 h-6 text-cyan-400" /></div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 mb-2">01 / Kurumsal Kimlik</div>
          <h2 className="text-2xl font-extrabold text-white mb-3">Hakkımızda</h2>
          <p className="text-slate-400 text-sm leading-relaxed">HedefBaşarı Özel Öğretim Kursu; VIP sınıf mimarisini algoritmik ödev, etüt ve öğrenci kontrolü otomasyonuyla birleştirerek sınav sürecindeki tüm akademik açıkları anlık kapatır.</p>
        </div>

        <div id="misyonumuz" className="p-8 rounded-3xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 transition scroll-mt-32">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/20"><Sparkles className="w-6 h-6 text-indigo-400" /></div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 mb-2">02 / Eğitim İlkemiz</div>
          <h2 className="text-2xl font-extrabold text-white mb-3">Misyonumuz</h2>
          <p className="text-slate-400 text-sm leading-relaxed">Her öğrencimize haftalık 12 etüt hakkı tanıyarak, 8 kişilik özel grup kotalarında Konu Anlatımı, Soru Çözümü ve Öğrenci Kontrolü seanslarını sıfır gecikmeyle sunmak.</p>
        </div>

        <div id="vizyonumuz" className="p-8 rounded-3xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800 transition scroll-mt-32">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20"><Server className="w-6 h-6 text-emerald-400" /></div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 mb-2">03 / Gelecek Vizyonu</div>
          <h2 className="text-2xl font-extrabold text-white mb-3">Vizyonumuz</h2>
          <p className="text-slate-400 text-sm leading-relaxed">KVKK standartlarında veri güvenliği ve gerçek zamanlı koçluk takibiyle Türkiye'nin en yüksek derece kazandıran dijitalleşmiş özel öğretim kurumu olmak.</p>
        </div>
      </section>

      <section id="kadromuz" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-32">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">Uzman Eğitmen ve Derece Koçlarımız</span>
            <h2 className="text-3xl font-black text-white mt-1">Akademik Kadromuz</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleManualScroll('left')} className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-400 text-white transition"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={() => handleManualScroll('right')} className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-400 text-white transition"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        <div ref={carouselRef} onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
          {staff.map((teacher) => {
            const freeHoursCount = (teacher.weeklySchedule || []).filter((s) => s.status === 'free').length;
            return (
              <div key={teacher.id} className="min-w-[300px] sm:min-w-[330px] max-w-[330px] snap-start rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between hover:border-indigo-500/50 transition group">
                <div>
                  <div className="relative overflow-hidden h-64 bg-slate-950 flex items-center justify-center">
                    <UserAvatar src={teacher.photoUrl} name={teacher.fullName} className="w-full h-64 group-hover:scale-105 transition duration-500" rounded="rounded-none" ringClass="" textClass="text-5xl" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                  </div>
                  <div className="p-6 -mt-8 relative z-10">
                    <span className="inline-block px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wider bg-indigo-500 text-white mb-3 shadow-md">{teacher.branch}</span>
                    <h3 className="text-xl font-extrabold text-white">{teacher.fullName}</h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-3">{teacher.biography}</p>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">Haftalık Açık Etüt:</span>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 font-black border border-emerald-500/20">{freeHoursCount} Saat</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer id="iletisim" className="mt-12 bg-slate-950 border-t border-slate-900 pt-16 pb-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-lg">HB</div>
                <div>
                  <span className="text-lg font-extrabold tracking-tight text-white block leading-none">HedefBaşarı</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Kurs Merkezi</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">Yüksek teknoloji eğitim otomasyonu ile donatılmış, öğrenci takibinde sıfır hata prensibiyle çalışan Türkiye'nin yeni nesil eğitim üssü.</p>
              <div className="flex items-center gap-3 pt-2">
                <a href="https://www.instagram.com/besni_hedef_basari" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-400 transition" title="Instagram Hesabımız">
                  <Instagram className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-extrabold text-sm mb-4">Hızlı Menü</h4>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                <li><button onClick={() => scrollToSection('hakkimizda')} className="hover:text-cyan-400 transition">Hakkımızda</button></li>
                <li><button onClick={() => scrollToSection('kadromuz')} className="hover:text-cyan-400 transition">Akademik Kadromuz</button></li>
                <li><button onClick={onOpenLogin} className="hover:text-cyan-400 transition">Sisteme Giriş Yap</button></li>
                <li><a href="#iletisim" className="hover:text-cyan-400 transition">KVKK & Gizlilik Politikası</a></li>
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h4 className="text-white font-extrabold text-sm mb-4">İletişim Bilgileri</h4>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-slate-400">
                    <MapPin className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium leading-relaxed">HedefBaşarı Dershanesi, Erdemoğlu Mah.<br />Toki Sokak<br />Besni / Adıyaman</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <a href="tel:+902165554433" className="flex items-center gap-3 text-slate-400 hover:text-white transition cursor-pointer">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold font-mono">+90 (216) 555 44 33</span>
                  </a>
                  <a href="mailto:info@hedefbasari.com.tr" className="flex items-center gap-3 text-slate-400 hover:text-white transition cursor-pointer">
                    <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs font-bold">info@hedefbasari.com.tr</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[11px] font-semibold text-slate-500">© {new Date().getFullYear()} HedefBaşarı Özel Öğretim Kursu. Tüm Hakları Saklıdır.</p>
            <p className="text-[11px] font-semibold text-slate-600">Altyapı: <span className="font-bold text-slate-500">Node.js, MongoDB, Redis & React Enterprise</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
