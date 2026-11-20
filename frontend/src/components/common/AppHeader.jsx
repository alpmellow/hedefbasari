import React from 'react';
import UserAvatar from './UserAvatar';
import { Calendar, Lock } from './Icons';

export default function AppHeader({
  activeView,
  currentSystemDay,
  activeHeaderAvatar,
  activeHeaderName,
  currentUser,
  onLogout
}) {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-xs sm:text-sm shadow-lg shadow-indigo-500/20">
            HB
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight block leading-none truncate">
              <span className="sm:hidden">HedefBaşarı</span>
              <span className="hidden sm:inline">HedefBaşarı Özel Öğretim Kursu</span>
            </span>
            <span className="text-[9px] sm:text-[11px] text-cyan-400 font-bold uppercase tracking-wider block mt-0.5 sm:mt-1 truncate">
              {activeView === 'student' && 'Öğrenci Etüt & Ödev Portalı'}
              {activeView === 'teacher' && 'Öğretmen & Koçluk Masası'}
              {activeView === 'admin' && 'Merkezi Yönetim Paneli'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-medium">Aktif Gün:</span>
            <strong className="text-emerald-400">{currentSystemDay}</strong>
          </div>

          <div className="flex items-center gap-2.5 p-0.5 sm:pl-2 sm:pr-3 sm:py-1 rounded-full bg-slate-950/90 border border-slate-800">
            <UserAvatar
              src={activeHeaderAvatar}
              name={activeHeaderName}
              className="w-8 h-8 sm:w-9 sm:h-9"
              rounded="rounded-full"
              ringClass={
                activeView === 'admin'
                  ? 'ring-2 ring-amber-400/70'
                  : activeView === 'teacher'
                  ? 'ring-2 ring-emerald-400/70'
                  : 'ring-2 ring-cyan-400/70'
              }
              textClass="text-xs"
            />
            <div className="text-left hidden sm:block">
              <span className="text-xs font-extrabold text-white block leading-tight">{activeHeaderName}</span>
              <span className="text-[10px] text-slate-400 font-mono block">
                {activeView === 'admin'
                  ? 'Tam Yetkili Yönetici'
                  : currentUser?.className || currentUser?.branch || 'Aktif Oturum'}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="px-2.5 sm:px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] sm:text-xs font-extrabold transition flex items-center gap-1.5"
            title="Güvenli Çıkış"
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Çıkış</span>
            <span className="hidden sm:inline">Güvenli Çıkış</span>
          </button>
        </div>
      </div>
    </header>
  );
}