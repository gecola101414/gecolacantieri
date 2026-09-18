import React from 'react';
import { Globe } from 'lucide-react';

export const Logo: React.FC<{ className?: string, iconOnly?: boolean }> = ({ className = "h-8", iconOnly = false }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <Globe className="w-10 h-10 text-amber-500 animate-[pulse_4s_infinite]" strokeWidth={1.5} />
        <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-white bg-slate-950 rounded-full w-6 h-6 m-auto border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
          G
        </span>
      </div>
      {!iconOnly && (
        <div className="flex flex-col text-left">
          <h1 className="text-xl font-black tracking-tighter text-white leading-none">
            GECOLA<span className="text-amber-500">CANTIERI</span>
          </h1>
          <p className="text-[11px] font-black text-amber-400/90 tracking-wider mt-1 text-left">
            2026 @ AETERNA - MILANO
          </p>
        </div>
      )}
    </div>
  );
};

export const FooterBranding: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`w-full py-6 mt-auto border-t border-slate-100/10 flex items-center justify-start text-left px-2 sm:px-4 ${className}`}>
      <div className="flex items-center gap-2.5 text-left">
        <Globe className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-xs sm:text-sm font-bold tracking-wider text-slate-300">
          2026 @ AETERNA - MILANO
        </span>
      </div>
    </div>
  );
};

