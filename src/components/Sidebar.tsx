import React from 'react';
import { 
  Building2, HardHat, Wrench, FileText, Users, PieChart, 
  ChevronLeft, ChevronRight, Box, LogOut, Settings, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserAccount, Company } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  currentUser: UserAccount;
  company: Company | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  currentUser,
  company,
  onLogout,
}) => {
  const menuItems = [
    { id: 'panoramica', label: 'Panoramica', icon: PieChart },
    { id: 'cantieri', label: 'Cantieri', icon: Building2 },
    { id: 'contabilita', label: 'Contabilità', icon: DollarSign },
    { id: 'personale', label: 'Personale', icon: HardHat },
    { id: 'mezzi', label: 'Mezzi', icon: Wrench },
    { id: 'materiali', label: 'Materiali', icon: Box },
    { id: 'rapportini', label: 'Rapportini', icon: FileText },
    { id: 'utenti', label: 'Gestione Utenti', icon: Users },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="bg-slate-950 border-r border-white/5 flex flex-col h-screen sticky top-0 z-50 transition-all duration-300 ease-in-out overflow-hidden"
    >
      {/* Sidebar Header */}
      <div className="p-6 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-slate-950" />
              </div>
              <span className="font-bold text-white tracking-tight whitespace-nowrap">
                CantieriCloud <span className="text-amber-500">Pro</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all group relative ${
              activeTab === item.id 
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)]' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon className={`w-5 h-5 min-w-[20px] ${activeTab === item.id ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  className="text-sm font-bold whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            
            {activeTab === item.id && isCollapsed && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-500 rounded-l-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            )}
          </button>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 mt-auto">
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-amber-500 font-bold">
              {currentUser.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">{currentUser.name}</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{currentUser.role}</span>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <div className="pt-2 space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                <Settings className="w-4 h-4" /> Impostazioni
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" /> Disconnetti
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};
