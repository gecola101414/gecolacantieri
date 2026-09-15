import React from 'react';
import { UserAccount, Company } from '../types';
import { ShieldAlert, LogOut, Radio, UserX, Building2, PhoneCall } from 'lucide-react';
import { motion } from 'motion/react';
import { Logo, FooterBranding } from './Branding';

interface AccountDeactivatedScreenProps {
  currentUser: UserAccount;
  company: Company;
  onLogout: () => void;
}

export const AccountDeactivatedScreen: React.FC<AccountDeactivatedScreenProps> = ({
  currentUser,
  company,
  onLogout
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 font-sans selection:bg-rose-500 selection:text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between max-w-lg mx-auto w-full">
        <Logo className="scale-90" />
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          Accesso Bloccato
        </div>
      </div>

      {/* Main card */}
      <div className="max-w-md mx-auto w-full my-auto py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900/90 border border-rose-500/30 rounded-3xl p-7 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl text-center space-y-6"
        >
          {/* Subtle glowing background accent */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 shadow-inner relative">
            <UserX className="w-10 h-10" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border border-rose-500/40 flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 inline-block">
              Utenza Sospesa
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Accesso Disattivato
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              L'amministratore del server aziendale ha disattivato la tua utenza.
              Tutte le operazioni (invio rapportini, movimentazione e visione cantieri) sono bloccate.
            </p>
          </div>

          {/* User Details box */}
          <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-left space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Collaboratore:</span>
              <span className="font-bold text-white">{currentUser.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Username:</span>
              <span className="font-mono font-semibold text-slate-300">@{currentUser.username}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Azienda:</span>
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {company.name}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
              <span className="text-slate-500 font-medium">Stato utenza:</span>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-bold text-[10px] uppercase tracking-wider">
                Spento / Inattivo
              </span>
            </div>
          </div>

          {/* Real-time status badge */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium bg-white/5 py-2.5 px-4 rounded-xl border border-white/5">
            <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>In ascolto del server: sblocco automatico in tempo reale</span>
          </div>

          {/* Action button */}
          <button
            onClick={onLogout}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all shadow-lg active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            Disconnetti ed Esci
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <FooterBranding />
    </div>
  );
};
