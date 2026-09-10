import React, { useState } from 'react';
import { UserAccount, Company } from '../types';
import { Building2, Shield, User, Smartphone, Cloud, ChevronDown, CheckCircle2, LogOut, Key, Settings, Bell, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  currentUser: UserAccount;
  company: Company | null;
  onLogout: () => void;
  isMobileView: boolean;
  setIsMobileView: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  company,
  onLogout,
  isMobileView,
  setIsMobileView,
}) => {
  const [firebaseStatusOpen, setFirebaseStatusOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <nav className="bg-slate-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-[100]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand & Context */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_-5px_rgba(245,158,11,0.5)] group-hover:scale-105 transition-transform duration-300">
                <Building2 className="w-6 h-6 text-slate-950 stroke-[2]" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-white leading-tight">
                  CantieriCloud <span className="text-amber-500">Pro</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enterprise OS</span>
              </div>
            </div>

            {company && (
              <div className="hidden lg:flex items-center gap-4 border-l border-white/10 pl-8">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white leading-none mb-1">{company.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Server Cloud Attivo</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Central Search (Visual Only for now to make it look "Pro") */}
          <div className="hidden xl:flex flex-1 max-w-md mx-8">
            <div className="w-full relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Cerca cantieri, operai, mezzi..." 
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-2.5 pl-12 pr-4 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-amber-500/50 focus:bg-slate-900 transition-all"
              />
            </div>
          </div>

          {/* Action Hub */}
          <div className="flex items-center gap-4">
            
            {/* View Toggle (Admin Only) */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setIsMobileView(!isMobileView)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                  isMobileView 
                    ? 'bg-amber-500 text-slate-950 shadow-lg' 
                    : 'bg-slate-900/50 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden md:inline">{isMobileView ? 'Dashboard Admin' : 'Vista Operativa'}</span>
              </button>
            )}

            {/* Notifications (Mock) */}
            <button className="relative p-2.5 bg-slate-900/50 rounded-xl border border-white/5 text-slate-400 hover:text-white transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-amber-500 rounded-full border-2 border-slate-950"></span>
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 bg-slate-900/50 hover:bg-slate-800/80 p-1.5 pr-4 rounded-2xl border border-white/5 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg group-hover:border-amber-500/50 transition-colors">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-white leading-tight">{currentUser.name}</span>
                  <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-tighter">{currentUser.role}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-72 bg-slate-900 rounded-3xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] border border-white/10 p-2 z-[110] overflow-hidden"
                  >
                    <div className="p-4 bg-slate-800/30 rounded-2xl mb-2">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-lg">
                          {currentUser.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{currentUser.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium">Codice: {company?.code}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 py-1 px-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Cloud className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">Cloud Sync Active</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                        <Settings className="w-4 h-4" /> Impostazioni Profilo
                      </button>
                      <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                        <Key className="w-4 h-4" /> Sicurezza & Privacy
                      </button>
                      <div className="h-px bg-white/5 my-2 mx-2"></div>
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <LogOut className="w-4 h-4" /> Esci dalla Piattaforma
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
