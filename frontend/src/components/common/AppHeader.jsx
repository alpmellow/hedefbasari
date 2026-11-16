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
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-sm shadow-lg shadow-indigo-500/20">
            HB
          </div>
          <div>
            <span className="font-extrabold text-sm text-white tracking-tight block leading-none">
              HedefBaşarı Özel Öğretim Kursu
            </span>
            <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider block mt-1">
              {activeView === 'student' && 'Öğrenci Akademik Etüt & Ödev Portalı'}
              {activeView === 'teacher' && 'Öğretmen & Akademik Koçluk Masası'}
              {activeView === 'admin' && 'Merkezi Yönetim & Otomasyon Paneli'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-medium">Aktif Gün:</span>
            <strong className="text-emerald-400">{currentSystemDay}</strong>
          </div>

          <div className="flex items-center gap-3 pl-2 pr-3 py-1 rounded-full bg-slate-950/90 border border-slate-800">
            <UserAvatar
              src={activeHeaderAvatar}
              name={activeHeaderName}
              className="w-9 h-9"
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
            className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-extrabold transition flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Güvenli Çıkış</span>
          </button>
        </div>
      </div>
    </header>
  );
}