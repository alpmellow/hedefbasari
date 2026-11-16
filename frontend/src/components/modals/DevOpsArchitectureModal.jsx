import React, { useState } from 'react';
import { INFRASTRUCTURE_FILES } from '../../constants';
import { Server, Check, Copy } from '../common/Icons';

export default function DevOpsArchitectureModal({ isOpen, onClose }) {
  const fileNames = Object.keys(INFRASTRUCTURE_FILES);
  const [selectedFile, setSelectedFile] = useState(fileNames[0]);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(INFRASTRUCTURE_FILES[selectedFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-extrabold text-white">Docker Compose & Nginx Yapılandırması</h3>
              <p className="text-xs text-slate-400">Üretim ortamı için Docker ve Nginx kodları.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-900 text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="flex flex-wrap gap-2 px-6 py-3 bg-slate-900 border-b border-slate-800">
          {fileNames.map((fname) => (
            <button key={fname} onClick={() => setSelectedFile(fname)} className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition ${selectedFile === fname ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400'}`}>
              {fname}
            </button>
          ))}
          <button onClick={handleCopy} className="ml-auto px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Kopyalandı!' : 'Dosyayı Kopyala'}
          </button>
        </div>
        <pre className="p-6 bg-slate-950 text-slate-200 font-mono text-xs overflow-auto flex-1 leading-relaxed">
          <code>{INFRASTRUCTURE_FILES[selectedFile]}</code>
        </pre>
      </div>
    </div>
  );
}