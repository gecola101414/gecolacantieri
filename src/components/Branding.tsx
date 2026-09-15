import React from 'react';
import { Globe } from 'lucide-react';

export const Logo: React.FC<{ className?: string, iconOnly?: boolean }> = ({ className = "h-8", iconOnly = false }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center">
        <Globe className="w-10 h-10 text-amber-500 animate-[pulse_4s_infinite]" strokeWidth={1.5} />
        <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-white bg-slate-950 rounded-full w-6 h-6 m-auto border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
          G
        </span>
      </div>
      {!iconOnly && (
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tighter text-white leading-none">
            GECOLA<span className="text-amber-500">CANTIERI</span>
          </h1>
          <p className="text-[8px] font-bold text-slate-500 tracking-[0.2em] mt-1">
            2026@AETERNA
          </p>
        </div>
      )}
    </div>
  );
};

export const FooterBranding: React.FC = () => {
  return (
    <div className="py-8 mt-auto flex flex-col items-center justify-center border-t border-slate-100/5">
      <div className="flex items-center gap-2 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
        <Globe className="w-4 h-4 text-amber-500" />
        <span className="text-[10px] font-black tracking-widest text-slate-400">
          GIMONDO <span className="text-slate-600 font-medium">| 2026@AETERNA</span>
        </span>
      </div>
    </div>
  );
};
