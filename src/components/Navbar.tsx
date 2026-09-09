import React, { useState } from 'react';
import { UserAccount, Company } from '../types';
import { Building2, Shield, User, Smartphone, Cloud, ChevronDown, CheckCircle2, LogOut, Key } from 'lucide-react';

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
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Company Info */}
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500 p-2 rounded-xl text-slate-900 shadow-inner flex items-center justify-center">
              <Building2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-amber-400 bg-clip-text text-transparent">
                  CantieriCloud Pro
                </span>
                {company && (
                  <span className="hidden sm:inline-block bg-amber-500/20 text-amber-400 text-xs px-2.5 py-0.5 rounded font-mono border border-amber-500/30">
                    {company.name} [{company.code}]
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Contabilità Cantieri & Rapportini in Cloud</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            {/* Firebase Cloud status indicator */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setFirebaseStatusOpen(!firebaseStatusOpen)}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/30 transition-colors"
              >
                <Cloud className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Firebase Cloud</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </button>

              {firebaseStatusOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-800 rounded-xl shadow-2xl p-4 border border-slate-700 text-xs z-50 text-slate-200">
                  <div className="flex items-center gap-2 font-bold text-emerald-400 mb-2">
                    <CheckCircle2 className="w-4 h-4" /> Server Firebase Attivo
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Sincronizzazione in tempo reale abilitata. Codice Aziendale: <strong className="text-amber-400">{company?.code}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Mobile / Desktop view toggle for non-operatives */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setIsMobileView(!isMobileView)}
                className={`p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isMobileView 
                    ? 'bg-amber-500 text-slate-900 shadow-lg' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Simula Vista Smartphone (Rapportini)"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">{isMobileView ? 'Torna Admin' : 'Simula Smartphone'}</span>
              </button>
            )}

            {/* User Profile & Logout */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-700 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-900 font-bold flex items-center justify-center text-sm shadow">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-semibold text-white truncate max-w-[140px]">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 capitalize">{currentUser.role}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-2xl shadow-2xl p-3 border border-slate-700 z-50 text-slate-200">
                  <div className="px-3 py-2 border-b border-slate-700 mb-2">
                    <p className="text-xs text-slate-400">Utente Connesso:</p>
                    <p className="font-semibold text-sm text-white">{currentUser.name}</p>
                    <p className="text-[11px] text-amber-400 capitalize mt-0.5">Ruolo: {currentUser.role}</p>
                    {company && (
                      <p className="text-[10px] font-mono text-slate-400 mt-1">Codice Azienda: {company.code}</p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      onLogout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-rose-500/30"
                  >
                    <LogOut className="w-4 h-4" /> Esci / Disconnetti
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
