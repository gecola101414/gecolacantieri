import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, 
  Search, RefreshCw, X, LogOut, Clock, Smartphone, HardHat, FileText, 
  ChevronDown, ChevronUp, Lock, Unlock, Copy, Check, Eye, EyeOff, 
  Calendar, Phone, UserCheck, UserX, AlertCircle, Database, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';
import { Company, UserAccount, ROLE_LABELS } from '../types';

interface CompanyMasterItem {
  company: Company;
  users: UserAccount[];
  cantieriCount: number;
  rapportiniCount: number;
  isOnlineNow: boolean;
  lastActiveFormatted: string;
}

interface MasterControlDashboardProps {
  onClose: () => void;
  onEnterCompanyAsInspector?: (company: Company) => void;
}

export function MasterControlDashboard({ onClose, onEnterCompanyAsInspector }: MasterControlDashboardProps) {
  const [items, setItems] = useState<CompanyMasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'online' | 'suspended' | 'active_quota'>('all');
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Note / Quota modal
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [modalQuotaStatus, setModalQuotaStatus] = useState<'attiva' | 'sospesa'>('attiva');
  const [modalAllowUpload, setModalAllowUpload] = useState<boolean>(true);
  const [modalScadenza, setModalScadenza] = useState<string>('');
  const [modalNote, setModalNote] = useState<string>('');
  const [isSavingQuota, setIsSavingQuota] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await firestoreService.getAllCompaniesWithDetails();
      setItems(data);
    } catch (err) {
      console.error('Error loading companies for Master Admin:', err);
      setError('Impossibile caricare i server aziendali da Firestore. Verifica la connessione.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Quick toggle quota directly from list
  const handleToggleQuotaDirect = async (item: CompanyMasterItem) => {
    const currentAllowUpload = item.company.allowDataUpload !== false && item.company.quotaStatus !== 'sospesa';
    const newAllowUpload = !currentAllowUpload;
    const newStatus: 'attiva' | 'sospesa' = newAllowUpload ? 'attiva' : 'sospesa';

    // Optimistic update
    setItems(prev => prev.map(it => {
      if (it.company.id === item.company.id) {
        return {
          ...it,
          company: {
            ...it.company,
            allowDataUpload: newAllowUpload,
            quotaStatus: newStatus
          }
        };
      }
      return it;
    }));

    try {
      await firestoreService.updateCompanyQuota(item.company.id, {
        allowDataUpload: newAllowUpload,
        quotaStatus: newStatus,
        quotaNote: item.company.quotaNote,
        quotaScadenza: item.company.quotaScadenza
      });
    } catch (err) {
      console.error('Error updating company quota:', err);
      alert('Errore durante l\'aggiornamento dello stato quota su Firestore.');
      loadData();
    }
  };

  const handleOpenQuotaModal = (company: Company) => {
    setEditingCompany(company);
    const isSuspended = company.allowDataUpload === false || company.quotaStatus === 'sospesa';
    setModalAllowUpload(!isSuspended);
    setModalQuotaStatus(isSuspended ? 'sospesa' : 'attiva');
    setModalScadenza(company.quotaScadenza || '');
    setModalNote(company.quotaNote || '');
  };

  const handleSaveQuotaModal = async () => {
    if (!editingCompany) return;
    setIsSavingQuota(true);
    try {
      await firestoreService.updateCompanyQuota(editingCompany.id, {
        allowDataUpload: modalAllowUpload,
        quotaStatus: modalAllowUpload ? 'attiva' : 'sospesa',
        quotaScadenza: modalScadenza.trim(),
        quotaNote: modalNote.trim()
      });

      // Update in memory
      setItems(prev => prev.map(it => {
        if (it.company.id === editingCompany.id) {
          return {
            ...it,
            company: {
              ...it.company,
              allowDataUpload: modalAllowUpload,
              quotaStatus: modalAllowUpload ? 'attiva' : 'sospesa',
              quotaScadenza: modalScadenza.trim(),
              quotaNote: modalNote.trim()
            }
          };
        }
        return it;
      }));

      setEditingCompany(null);
    } catch (err) {
      console.error('Error saving quota details:', err);
      alert('Errore nel salvataggio su Firestore.');
    } finally {
      setIsSavingQuota(false);
    }
  };

  // Filtered companies
  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      item.company.name.toLowerCase().includes(q) ||
      item.company.code.toLowerCase().includes(q) ||
      item.company.adminName.toLowerCase().includes(q) ||
      item.users.some(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const isSuspended = item.company.allowDataUpload === false || item.company.quotaStatus === 'sospesa';
    if (filterType === 'online') return item.isOnlineNow;
    if (filterType === 'suspended') return isSuspended;
    if (filterType === 'active_quota') return !isSuspended;

    return true;
  });

  // Global metrics
  const totalCompanies = items.length;
  const onlineCount = items.filter(it => it.isOnlineNow).length;
  const suspendedCount = items.filter(it => it.company.allowDataUpload === false || it.company.quotaStatus === 'sospesa').length;
  const activeQuotaCount = totalCompanies - suspendedCount;
  const totalUsers = items.reduce((acc, it) => acc + it.users.length, 0);
  const totalCantieri = items.reduce((acc, it) => acc + it.cantieriCount, 0);
  const totalRapportini = items.reduce((acc, it) => acc + it.rapportiniCount, 0);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 blur-[140px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="relative z-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40">
            <ShieldCheck className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Centro di Controllo Master
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SuperAdmin gecola • 1014
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Monitoraggio reale di tutti i server aziendali, stato connessioni e gestione quote
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition active:scale-95 disabled:opacity-50"
            title="Ricarica da Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>Chiudi Menu</span>
          </button>
        </div>
      </header>

      {/* METRIC STRIP */}
      <section className="relative z-10 bg-slate-900/60 border-b border-slate-800/60 px-4 sm:px-6 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Total Companies */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Server Creati</span>
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-white">
              {totalCompanies}
            </div>
            <span className="text-[10px] text-slate-500">Aziende su Cloud</span>
          </div>

          {/* Online now */}
          <div className="bg-slate-950/60 border border-emerald-900/40 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
              <span>Connessi Adesso</span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-300">
              {onlineCount}
            </div>
            <span className="text-[10px] text-slate-500">Negli ultimi 6 min</span>
          </div>

          {/* Quota Regolare */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Quota Pagata</span>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-blue-300">
              {activeQuotaCount}
            </div>
            <span className="text-[10px] text-slate-500">Caricamento Attivo</span>
          </div>

          {/* Quota Sospesa */}
          <div className="bg-slate-950/60 border border-rose-900/40 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
              <span>Quote Sospese</span>
              <Lock className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-rose-300">
              {suspendedCount}
            </div>
            <span className="text-[10px] text-slate-500">In Sola Lettura</span>
          </div>

          {/* Utenti totali */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Account Totali</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-purple-300">
              {totalUsers}
            </div>
            <span className="text-[10px] text-slate-500">Operatori & Dipendenti</span>
          </div>

          {/* Attività cantieri */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Cantieri Attivi</span>
              <HardHat className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-amber-200">
              {totalCantieri}
            </div>
            <span className="text-[10px] text-slate-500">{totalRapportini} Rapportini</span>
          </div>
        </div>
      </section>

      {/* CONTROLS BAR: SEARCH & FILTERS */}
      <div className="relative z-10 bg-slate-900/40 px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per azienda, codice CANT-XXXX, titolare..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              filterType === 'all' 
                ? 'bg-amber-500 text-slate-950 font-bold' 
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tutti ({items.length})
          </button>
          <button
            onClick={() => setFilterType('online')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              filterType === 'online' 
                ? 'bg-emerald-500 text-slate-950 font-bold' 
                : 'bg-slate-800 text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Online Adesso ({onlineCount})
          </button>
          <button
            onClick={() => setFilterType('active_quota')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              filterType === 'active_quota' 
                ? 'bg-blue-500 text-slate-950 font-bold' 
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Quota Pagata ({activeQuotaCount})
          </button>
          <button
            onClick={() => setFilterType('suspended')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              filterType === 'suspended' 
                ? 'bg-rose-500 text-white font-bold' 
                : 'bg-slate-800 text-rose-400 hover:text-rose-300'
            }`}
          >
            <Lock className="w-3 h-3" />
            Sospesi ({suspendedCount})
          </button>
        </div>
      </div>

      {/* MAIN CONTENT: LIST OF COMPANIES */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm font-medium">Interrogazione database server aziendali in corso...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold">Errore di lettura Firestore</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="text-center py-16 text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800/60 p-8">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">Nessun server aziendale trovato</p>
            <p className="text-xs text-slate-500 mt-1">Prova a cambiare i parametri di ricerca o il filtro selezionato.</p>
          </div>
        )}

        {!isLoading && filteredItems.map((item) => {
          const isSuspended = item.company.allowDataUpload === false || item.company.quotaStatus === 'sospesa';
          const isExpanded = expandedCompanyId === item.company.id;

          return (
            <div
              key={item.company.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isSuspended 
                  ? 'bg-gradient-to-b from-slate-900/90 to-rose-950/20 border-rose-900/40' 
                  : item.isOnlineNow 
                    ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/20' 
                    : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Main Card Header */}
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Company Main Info */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSuspended 
                      ? 'bg-rose-950 text-rose-400 border border-rose-800/60' 
                      : item.isOnlineNow 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60' 
                        : 'bg-slate-800 text-amber-400 border border-slate-700'
                  }`}>
                    {isSuspended ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        {item.company.name}
                      </h2>

                      {/* Company Code Badge with Copy */}
                      <button
                        onClick={() => handleCopyCode(item.company.code)}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-700 hover:border-amber-500/50 text-[11px] font-mono font-bold text-amber-300 transition"
                        title="Clicca per copiare codice aziendale"
                      >
                        <span>{item.company.code}</span>
                        {copiedCode === item.company.code ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>

                      {/* Online Status Pill */}
                      {item.isOnlineNow ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Online Adesso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {item.lastActiveFormatted}
                        </span>
                      )}

                      {/* Quota Status Badge */}
                      {isSuspended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-700/60">
                          <Lock className="w-3 h-3 text-rose-400" />
                          Caricamento Sospeso (Sola Lettura)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-300 border border-blue-700/50">
                          <ShieldCheck className="w-3 h-3 text-blue-400" />
                          Quota Regolare
                        </span>
                      )}
                    </div>

                    {/* Metadata Subline */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                      <span>Titolare: <strong className="text-slate-200">{item.company.adminName || 'Amministratore'}</strong></span>
                      <span>Creato il: <span className="text-slate-300">{new Date(item.company.createdAt || Date.now()).toLocaleDateString('it-IT')}</span></span>
                      {item.company.lastActiveUser && (
                        <span>Ultimo login: <span className="text-amber-300 font-medium">{item.company.lastActiveUser}</span></span>
                      )}
                      {item.company.quotaScadenza && (
                        <span>Scadenza Quota: <strong className="text-slate-200">{item.company.quotaScadenza}</strong></span>
                      )}
                    </div>

                    {/* Note Quota if any */}
                    {item.company.quotaNote && (
                      <div className="mt-1.5 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg inline-block">
                        <strong>Nota gecola:</strong> {item.company.quotaNote}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                  {/* Toggle Quota Button */}
                  <button
                    onClick={() => handleToggleQuotaDirect(item)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                      isSuspended
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/30'
                        : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40'
                    }`}
                    title={isSuspended ? 'Riabilita il caricamento dati' : 'Sospendi caricamento per mancato pagamento'}
                  >
                    {isSuspended ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Riabilita Caricamento</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        <span>Sospendi Quota (Sola Lettura)</span>
                      </>
                    )}
                  </button>

                  {/* Edit Quota / Notes */}
                  <button
                    onClick={() => handleOpenQuotaModal(item.company)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition active:scale-95"
                    title="Modifica scadenza o note interne"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dettagli Quota</span>
                  </button>

                  {/* Inspect company directly */}
                  {onEnterCompanyAsInspector && (
                    <button
                      onClick={() => onEnterCompanyAsInspector(item.company)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition active:scale-95"
                      title="Accedi come supervisore in questo server"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ispeziona Server</span>
                    </button>
                  )}

                  {/* Expand Users Button */}
                  <button
                    onClick={() => setExpandedCompanyId(isExpanded ? null : item.company.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                  >
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Utenti ({item.users.length})</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Data Summary Bar */}
              <div className="bg-slate-950/40 border-t border-slate-800/60 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <HardHat className="w-3.5 h-3.5 text-amber-400" />
                    Cantieri: <strong className="text-slate-200">{item.cantieriCount}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Rapportini: <strong className="text-slate-200">{item.rapportiniCount}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    Account registrati: <strong className="text-slate-200">{item.users.length}</strong>
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  ID Firestore: <span className="font-mono">{item.company.id}</span>
                </div>
              </div>

              {/* EXPANDED USERS LIST */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-800 bg-slate-950/70 p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        Account Utenti configurati in questo Server ({item.users.length})
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        Credenziali visibili per supporto tecnico e recupero accesso
                      </span>
                    </div>

                    {item.users.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">
                        Nessun utente dipendente configurato per questo server.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                        {item.users.map((user) => {
                          const showPass = visiblePasswords[user.id] || false;
                          return (
                            <div
                              key={user.id}
                              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                                user.active 
                                  ? 'bg-slate-900/90 border-slate-800' 
                                  : 'bg-slate-950/80 border-rose-900/30 opacity-75'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <strong className="text-xs text-white font-bold">{user.name}</strong>
                                    {user.active ? (
                                      <span className="w-2 h-2 rounded-full bg-emerald-400" title="Account attivo"></span>
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-rose-400" title="Account disattivato"></span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block mt-0.5">
                                    {ROLE_LABELS[user.role] || user.role}
                                  </span>
                                </div>

                                {user.phone && (
                                  <a 
                                    href={`tel:${user.phone}`} 
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                                    title="Chiama operatore"
                                  >
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <span>{user.phone}</span>
                                  </a>
                                )}
                              </div>

                              {/* Credentials Box */}
                              <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 text-[11px] space-y-1">
                                <div className="flex items-center justify-between text-slate-400">
                                  <span>Username:</span>
                                  <strong className="text-slate-200 font-mono">{user.username}</strong>
                                </div>
                                <div className="flex items-center justify-between text-slate-400">
                                  <span>Password:</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-amber-300 font-bold">
                                      {showPass ? user.password : '••••••••'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => togglePasswordVisibility(user.id)}
                                      className="text-slate-500 hover:text-slate-300"
                                      title={showPass ? 'Nascondi' : 'Mostra password'}
                                    >
                                      {showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>
                                {user.deviceId && (
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-900">
                                    <span>Cellulare associato:</span>
                                    <span className="font-mono text-slate-400 truncate max-w-[120px]">{user.deviceId}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </main>

      {/* MODAL EDIT QUOTA & NOTES */}
      <AnimatePresence>
        {editingCompany && (
          <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-750 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Gestione Quota & Licenza
                    </h3>
                    <p className="text-xs text-slate-400">{editingCompany.name} ({editingCompany.code})</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingCompany(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Permission Toggle */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-xs font-bold text-white block">
                      Autorizzazione Caricamento Dati
                    </strong>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Se disabilitato, l'azienda accede solo in consultazione (sola lettura).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !modalAllowUpload;
                      setModalAllowUpload(nextVal);
                      setModalQuotaStatus(nextVal ? 'attiva' : 'sospesa');
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      modalAllowUpload ? 'bg-emerald-500' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        modalAllowUpload ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className={`p-2 rounded-lg text-[11px] flex items-center gap-2 ${
                  modalAllowUpload 
                    ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40' 
                    : 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                }`}>
                  {modalAllowUpload ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Quota in regola: possono creare cantieri, rapportini e caricare file.</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      <span>Sola lettura: possono solo visualizzare i dati storici esistenti.</span>
                    </>
                  )}
                </div>
              </div>

              {/* Scadenza Quota */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Data Scadenza Quota / Abbonamento
                </label>
                <input
                  type="text"
                  value={modalScadenza}
                  onChange={(e) => setModalScadenza(e.target.value)}
                  placeholder="es. 31/12/2026 o Annuale"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Note interne per gecola */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  Note Interne Amministratore (Riservate)
                </label>
                <textarea
                  rows={3}
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="es. Inviata fattura via PEC. In attesa del bonifico. Proroga concordata telefonicamente..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuotaModal}
                  disabled={isSavingQuota}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingQuota ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvataggio...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Salva Modifiche Quota</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
