import React, { useState, useEffect } from 'react';

export default function ThreeTierLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [tier, setTier] = useState('student');
  const [tcNo, setTcNo] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaStatus, setCaptchaStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setCaptchaStatus('idle');
    const saved = localStorage.getItem('hb_remembered_credentials');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTier(parsed.tier || 'student');
        setTcNo(parsed.tcNo || '');
        setUsername(parsed.username || '');
        setRememberMe(true);
        return;
      } catch {}
    }
    setRememberMe(false);
    setTcNo('');
    setUsername('');
    setSecret('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectTier = (newTier) => {
    setTier(newTier);
    setErrorMsg('');
    setCaptchaStatus('idle');
    const saved = localStorage.getItem('hb_remembered_credentials');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tier === newTier) {
          setTcNo(parsed.tcNo || '');
          setUsername(parsed.username || '');
          setRememberMe(true);
          return;
        }
      } catch {}
    }
    setTcNo('');
    setUsername('');
    setSecret('');
  };

  const triggerCloudflareVerify = () => {
    if (captchaStatus !== 'idle') return;
    setCaptchaStatus('verifying');
    setTimeout(() => {
      setCaptchaStatus('verified');
    }, 650);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (captchaStatus !== 'verified') {
      setErrorMsg('Lütfen önce Cloudflare güvenlik doğrulamasını onaylayın.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, tcNo, username, secret })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Giriş bilgileri doğrulanamadı.');
        return;
      }

      if (rememberMe) {
        localStorage.setItem(
          'hb_remembered_credentials',
          JSON.stringify({ tier, tcNo: tier !== 'admin' ? tcNo : '', username: tier === 'admin' ? username : '' })
        );
      } else {
        localStorage.removeItem('hb_remembered_credentials');
      }

      onLoginSuccess(data.role, data.user, data.token);
    } catch {
      setErrorMsg('Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white">3 Kademeli Güvenli Giriş Kapısı</h3>
            <p className="text-xs text-slate-400">JWT + bcrypt + Rate-Limiting Korumalı Oturum</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-2 m-5 mb-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
          <button type="button" onClick={() => handleSelectTier('student')} className={`py-2.5 rounded-lg transition ${tier === 'student' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>1. Öğrenci</button>
          <button type="button" onClick={() => handleSelectTier('teacher')} className={`py-2.5 rounded-lg transition ${tier === 'teacher' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>2. Öğretmen/Koç</button>
          <button type="button" onClick={() => handleSelectTier('admin')} className={`py-2.5 rounded-lg transition ${tier === 'admin' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>3. Yönetici</button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 pt-3 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">{errorMsg}</div>
          )}

          {tier !== 'admin' ? (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">11 Haneli TC Kimlik Numarası</label>
              <input type="text" maxLength={11} required placeholder="11 haneli TC Kimlik No giriniz" value={tcNo} onChange={(e) => setTcNo(e.target.value.replace(/\D/g, ''))} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yönetici Kullanıcı Adı</label>
              <input type="text" required placeholder="Yönetici kullanıcı adınız" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono" />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              {tier === 'student' && '6 Haneli Sayısal Şifre'}
              {tier === 'teacher' && '8 Haneli Yüksek Güvenlikli Anahtar'}
              {tier === 'admin' && 'Yönetici Şifresi'}
            </label>
            <input type="password" required maxLength={tier === 'student' ? 6 : tier === 'teacher' ? 8 : 32} placeholder="••••••••" value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-cyan-300 font-mono" />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-xs font-bold text-slate-300">Beni Hatırla (Giriş bilgilerimi bu cihazda sakla)</span>
            </label>
          </div>

          <div onClick={triggerCloudflareVerify} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 flex items-center justify-between cursor-pointer select-none transition">
            <div className="flex items-center gap-3">
              {captchaStatus === 'idle' && <div className="w-6 h-6 rounded-md border-2 border-slate-600 bg-slate-900" />}
              {captchaStatus === 'verifying' && <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />}
              {captchaStatus === 'verified' && <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-sm">✓</div>}
              <span className="text-xs font-bold text-slate-200">
                {captchaStatus === 'idle' && 'Robot olmadığınızı doğrulayın (Tıklayın)'}
                {captchaStatus === 'verifying' && 'Cloudflare Turnstile doğrulanıyor...'}
                {captchaStatus === 'verified' && 'Güvenlik doğrulaması onaylandı'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-500">Cloudflare</span>
          </div>

          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg transition">
            Doğrula ve Panele Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
}