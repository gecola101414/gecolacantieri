import React, { useState } from 'react';
import { UserAccount, Company, TransferCode } from '../types';
import { Building2, Shield, User, Smartphone, Cloud, ChevronDown, CheckCircle2, LogOut, Key, Settings, Bell, Search, Globe, KeyRound, Timer, ShieldCheck, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Branding';

interface NavbarProps {
  currentUser: UserAccount;
  company: Company | null;
  onLogout: () => void;
  isMobileView: boolean;
  setIsMobileView: (val: boolean) => void;
  onGenerateTransferCode?: () => Promise<void>;
  activeTransferCode?: TransferCode | null;
  transferTimeLeft?: number;
  isGeneratingTransferCode?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  company,
  onLogout,
  isMobileView,
  setIsMobileView,
  onGenerateTransferCode,
  activeTransferCode,
  transferTimeLeft = 0,
  isGeneratingTransferCode = false,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyTransferCode = () => {
    if (!activeTransferCode) return;
    navigator.clipboard.writeText(activeTransferCode.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <nav className="bg-slate-950/95 backdrop-blur-xl border-b border-white/10 sticky top-0 z-[100] w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-20 gap-2">
          
          {/* Brand & Context */}
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <Logo className="scale-75 sm:scale-90 origin-left shrink-0" />

            {company && (
              <div className="hidden md:flex items-center gap-3 border-l border-white/10 pl-4 sm:pl-6 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white leading-none mb-1 truncate">{company.name}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Cloud Attivo</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Central Search (Desktop only) */}
          <div className="hidden xl:flex flex-1 max-w-md mx-6">
            <div className="w-full relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Cerca cantieri, operai, mezzi..." 
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-2 pl-12 pr-4 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-amber-500/50 focus:bg-slate-900 transition-all"
              />
            </div>
          </div>

          {/* Action Hub */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* PC Transfer Code Generator Button */}
            {onGenerateTransferCode && (
              <button
                onClick={onGenerateTransferCode}
                disabled={isGeneratingTransferCode || transferTimeLeft > 0}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all border ${
                  transferTimeLeft > 0
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_-4px_rgba(16,185,129,0.4)]'
                    : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Genera Codice Trasferimento PC"
              >
                <KeyRound className={`w-4 h-4 ${isGeneratingTransferCode ? 'animate-pulse text-amber-500' : ''}`} />
                {transferTimeLeft > 0 ? (
                  <span className="font-mono text-[11px] font-black text-emerald-400">{transferTimeLeft}s</span>
                ) : (
                  <span className="hidden sm:inline text-[10px] uppercase tracking-wider">Codice PC</span>
                )}
              </button>
            )}

            {/* View Toggle (Admin Only) */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setIsMobileView(!isMobileView)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all ${
                  isMobileView 
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/10'
                }`}
                title={isMobileView ? 'Passa alla Dashboard Admin' : 'Passa alla Vista Operativa Mobile'}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline text-[10px]">{isMobileView ? 'Admin' : 'Operativo'}</span>
              </button>
            )}

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 bg-slate-900/60 hover:bg-slate-800 p-1 sm:p-1.5 sm:pr-3 rounded-xl sm:rounded-2xl border border-white/10 transition-all group"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center overflow-hidden shadow-md">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-white leading-tight truncate max-w-[100px]">{currentUser.name}</span>
                  <span className="text-[9px] font-bold text-amber-500/90 uppercase tracking-tighter">{currentUser.role}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] bg-slate-900 rounded-2xl sm:rounded-3xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)] border border-white/10 p-2 z-[110] overflow-hidden"
                  >
                    <div className="p-3 sm:p-4 bg-slate-800/40 rounded-xl sm:rounded-2xl mb-2">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-lg">
                          {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-white truncate">{currentUser.name}</span>
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{currentUser.role}</span>
                          {company && (
                            <span className="text-[10px] text-slate-400 font-mono">Azienda: {company.code}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 py-1 px-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Cloud className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tight">Sincronizzazione Cloud Attiva</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <LogOut className="w-4 h-4 shrink-0" /> Esci dall'applicazione
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Active Transfer Code Banner (Integrated directly into the fixed header) */}
      <AnimatePresence>
        {activeTransferCode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gradient-to-r from-emerald-950 via-slate-950 to-emerald-950 border-t border-emerald-500/30 px-3 py-2 text-white overflow-hidden"
          >
            <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Accesso PC:</span>
                  <span className="font-mono font-black text-sm tracking-[0.15em] bg-emerald-500/20 text-white px-2 py-0.5 rounded-md border border-emerald-500/40">
                    {activeTransferCode.code}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-bold text-emerald-300 flex items-center gap-1">
                  <Timer className="w-3 h-3 text-emerald-400" /> {transferTimeLeft}s
                </span>
                <button
                  onClick={handleCopyTransferCode}
                  className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                >
                  {codeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span className="hidden xs:inline">{codeCopied ? 'Copiato' : 'Copia'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

