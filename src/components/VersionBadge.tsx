import React, { useState } from 'react';
import { Sparkles, Clock, CheckCircle2, X, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APP_VERSION, APP_LAST_UPDATE, APP_BUILD, APP_RELEASE_NOTES } from '../version';

interface VersionBadgeProps {
  className?: string;
  variant?: 'pill' | 'compact' | 'footer' | 'banner';
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({ 
  className = '', 
  variant = 'pill' 
}) => {
  const [showModal, setShowModal] = useState(false);

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-black transition-all cursor-pointer ${className}`}
          title="Clicca per vedere i dettagli dell'aggiornamento"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          <span>v{APP_VERSION}</span>
          <span className="text-slate-400 hidden sm:inline">• {APP_LAST_UPDATE}</span>
        </button>

        {showModal && <VersionModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  if (variant === 'footer') {
    return (
      <>
        <div className={`flex flex-col gap-1 text-left ${className}`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            <span className="text-xs font-mono font-black text-amber-400 tracking-tight">
              Versione v{APP_VERSION}
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400">
            Ultimo aggiornamento: <span className="text-slate-200 font-mono">{APP_LAST_UPDATE}</span>
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-[10px] font-bold text-amber-500 hover:text-amber-400 underline flex items-center gap-1 mt-0.5 cursor-pointer text-left"
          >
            <Info className="w-3 h-3" /> Note di rilascio
          </button>
        </div>

        {showModal && <VersionModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <div className={`p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs ${className}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <div className="truncate">
              <span className="font-mono font-black text-amber-400">v{APP_VERSION}</span>
              <span className="text-slate-400 ml-2 text-[11px] font-medium hidden sm:inline">
                Ultimo aggiornamento: <strong className="text-slate-200">{APP_LAST_UPDATE}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-[11px] font-black text-amber-400 hover:text-amber-300 underline shrink-0 cursor-pointer"
          >
            Dettagli
          </button>
        </div>

        {showModal && <VersionModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // Default 'pill' variant
  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shadow-sm text-left ${className}`}
        title="Dettagli versione e data/ora aggiornamento"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div className="flex flex-col leading-tight text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black font-mono text-amber-400 tracking-tight">
              v{APP_VERSION}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded border border-emerald-500/30">
              Aggiornato
            </span>
          </div>
          <span className="text-[9px] font-mono text-slate-400 font-medium">
            {APP_LAST_UPDATE}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all ml-0.5" />
      </button>

      {showModal && <VersionModal onClose={() => setShowModal(false)} />}
    </>
  );
};

const VersionModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Versione {APP_VERSION}</h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-black uppercase">
                  Attiva
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Build ID: {APP_BUILD}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timestamp Card */}
        <div className="my-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data e Ora Ultimo Aggiornamento</p>
            <p className="text-sm font-black font-mono text-amber-300 mt-0.5">{APP_LAST_UPDATE}</p>
          </div>
        </div>

        {/* Release Notes */}
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Cosa è cambiato in questo rilascio:
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {APP_RELEASE_NOTES.map((note, index) => (
              <div 
                key={index}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 font-medium">CantieriCloud Pro • 2026 @ AETERNA</p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer"
          >
            Ho capito
          </button>
        </div>
      </motion.div>
    </div>
  );
};
