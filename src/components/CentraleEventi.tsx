import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, ShoppingBag, Clock, Truck, ClipboardCheck, FileText, 
  Receipt, Building2, User, Search, Filter, AlertTriangle, 
  CheckCircle2, Flame, ArrowUpRight, Calendar, Sparkles, RefreshCw,
  ChevronRight, MapPin, Eye
} from 'lucide-react';
import { 
  Company, Cantiere, Rapportino, MaterialDocument, TimbraturaBadge, 
  MaterialRequest, StockMovement, CantiereDocumentoTecnico, ContabilitaEntry, 
  CompanyEvent, CompanyEventType, UserAccount
} from '../types';
import { synthesizeAllEvents, calculateOperationalRhythm } from '../lib/eventSynthesis';
import { VersionBadge } from './VersionBadge';

interface CentraleEventiProps {
  company: Company | null;
  cantieri: Cantiere[];
  rapportini: Rapportino[];
  documents: MaterialDocument[];
  timbrature?: TimbraturaBadge[];
  materialRequests?: MaterialRequest[];
  technicalDocs?: CantiereDocumentoTecnico[];
  contabilita?: ContabilitaEntry[];
  users?: UserAccount[];
  explicitEvents?: CompanyEvent[];
  onSelectCantiere?: (cantiere: Cantiere) => void;
  onOpenRapportino?: (rapportino: Rapportino) => void;
  onOpenDocument?: (doc: MaterialDocument) => void;
  onOpenMaterialRequests?: () => void;
  onRefresh?: () => void;
  className?: string;
  isCompact?: boolean;
}

export const CentraleEventi: React.FC<CentraleEventiProps> = ({
  company,
  cantieri,
  rapportini,
  documents,
  timbrature = [],
  materialRequests = [],
  technicalDocs = [],
  contabilita = [],
  users = [],
  explicitEvents = [],
  onSelectCantiere,
  onOpenRapportino,
  onOpenDocument,
  onOpenMaterialRequests,
  onRefresh,
  className = '',
  isCompact = false,
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCantiereId, setSelectedCantiereId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyToday, setOnlyToday] = useState<boolean>(false);
  const [showHourlyBar, setShowHourlyBar] = useState<boolean>(false);

  // Unifica e sintetizza tutti gli eventi
  const allEvents = useMemo(() => {
    return synthesizeAllEvents({
      explicitEvents,
      materialRequests,
      timbrature,
      documents,
      rapportini,
      technicalDocs,
      contabilita,
      cantieri,
    });
  }, [
    explicitEvents,
    materialRequests,
    timbrature,
    documents,
    rapportini,
    technicalDocs,
    contabilita,
    cantieri,
  ]);

  // Calcola il ritmo operativo per il dirigente
  const rhythm = useMemo(() => {
    return calculateOperationalRhythm(allEvents);
  }, [allEvents]);

  // Filtra gli eventi per visualizzazione
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      if (selectedType !== 'all' && event.type !== selectedType) {
        return false;
      }
      if (selectedCantiereId !== 'all' && event.cantiereId !== selectedCantiereId) {
        return false;
      }
      if (onlyToday && !event.timestamp.startsWith(todayStr)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = event.title.toLowerCase().includes(q);
        const inSummary = event.summary.toLowerCase().includes(q);
        const inUser = event.userName.toLowerCase().includes(q);
        const inCantiere = (event.cantiereName || '').toLowerCase().includes(q);
        const inDetails = (event.details || '').toLowerCase().includes(q);
        if (!inTitle && !inSummary && !inUser && !inCantiere && !inDetails) {
          return false;
        }
      }
      return true;
    });
  }, [allEvents, selectedType, selectedCantiereId, onlyToday, searchQuery, todayStr]);

  // Formatta data orario relativo e assoluto
  const formatTimeInfo = (isoString: string) => {
    if (!isoString) return { date: '-', time: '-', relative: '-' };
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      const isToday = d.toISOString().split('T')[0] === now.toISOString().split('T')[0];

      let relative = '';
      if (diffMins < 1) relative = 'Adesso';
      else if (diffMins < 60) relative = `${diffMins}m fa`;
      else if (diffHours < 24 && isToday) relative = `${diffHours}h fa`;
      else if (diffHours < 48) relative = 'Ieri';
      else relative = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

      const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const date = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

      return { date, time, relative, isToday };
    } catch {
      return { date: isoString, time: '', relative: '', isToday: false };
    }
  };

  const getTypeVisual = (type: CompanyEventType) => {
    switch (type) {
      case 'ordine':
        return {
          icon: ShoppingBag,
          color: 'text-amber-600',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          badge: 'bg-amber-100 text-amber-900 border-amber-200',
          label: 'Ordine Materiale'
        };
      case 'badge':
        return {
          icon: Clock,
          color: 'text-indigo-600',
          bg: 'bg-indigo-500/10',
          border: 'border-indigo-500/30',
          badge: 'bg-indigo-100 text-indigo-900 border-indigo-200',
          label: 'Beggiatura GPS'
        };
      case 'bolla':
        return {
          icon: Truck,
          color: 'text-purple-600',
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/30',
          badge: 'bg-purple-100 text-purple-900 border-purple-200',
          label: 'Bolla / DDT'
        };
      case 'rapportino':
        return {
          icon: ClipboardCheck,
          color: 'text-emerald-600',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
          label: 'Rapportino'
        };
      case 'documento':
        return {
          icon: FileText,
          color: 'text-sky-600',
          bg: 'bg-sky-500/10',
          border: 'border-sky-500/30',
          badge: 'bg-sky-100 text-sky-900 border-sky-200',
          label: 'Doc Tecnico'
        };
      case 'contabilita':
        return {
          icon: Receipt,
          color: 'text-emerald-700',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
          label: 'Contabilità / SAL'
        };
      default:
        return {
          icon: Activity,
          color: 'text-slate-600',
          bg: 'bg-slate-500/10',
          border: 'border-slate-300',
          badge: 'bg-slate-100 text-slate-800 border-slate-200',
          label: 'Attività'
        };
    }
  };

  const handleEventClick = (event: CompanyEvent) => {
    if (event.cantiereId && onSelectCantiere) {
      const c = cantieri.find(item => item.id === event.cantiereId);
      if (c) {
        onSelectCantiere(c);
        return;
      }
    }
    if (event.type === 'rapportino' && onOpenRapportino && event.entityId) {
      const r = rapportini.find(item => item.id === event.entityId);
      if (r) onOpenRapportino(r);
    } else if (event.type === 'bolla' && onOpenDocument && event.entityId) {
      const d = documents.find(item => item.id === event.entityId);
      if (d) onOpenDocument(d);
    } else if (event.type === 'ordine' && onOpenMaterialRequests) {
      onOpenMaterialRequests();
    }
  };

  return (
    <div id="centrale-eventi-container" className={`space-y-6 ${className}`}>
      
      {/* SEZIONE RITMO DELLA MANOVRA GIORNALIERA (Pannello Dirigenziale) */}
      <div className="bg-slate-950 text-white rounded-3xl sm:rounded-[36px] p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping inline-block" />
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                  Centrale Operativa & Tracciato Eventi
                </span>
                <span className="text-xs text-slate-500 font-mono hidden sm:inline">• Tempo Reale</span>
                <VersionBadge variant="compact" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <span>Ritmo della Manovra Aziendale</span>
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Ogni operazione svolta sul campo dai capicantiere (ordini, beggiature presenze, carichi da bolla, rapportini) lascia un tracciato istantaneo per monitorare l'andamento produttivo dell'impresa.
              </p>
            </div>

            {/* Pulsante ricarica / orario */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowHourlyBar(!showHourlyBar)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  showHourlyBar 
                    ? 'bg-amber-500 text-slate-950 border-amber-400' 
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Visualizza istogramma fasce orarie della giornata"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{showHourlyBar ? 'Nascondi Grafico Orario' : 'Distribuzione Oraria'}</span>
              </button>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Aggiorna flusso eventi"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Radar Status Bar & KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* KPI 1: Stato Ritmo Manovra */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              rhythm.status === 'calma_piatta'
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                : rhythm.status === 'avvio'
                ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                : rhythm.status === 'regolare'
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                : 'bg-indigo-950/40 border-indigo-800/80 text-indigo-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Stato Operatività
                </span>
                {rhythm.status === 'calma_piatta' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : rhythm.status === 'intenso' ? (
                  <Flame className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Activity className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-lg font-black tracking-tight text-white mb-1">
                {rhythm.statusLabel}
              </p>
              <p className="text-[11px] leading-snug text-slate-300">
                {rhythm.status === 'calma_piatta' 
                  ? 'Nessun movimento oggi: se la giornata è iniziata, verificare i cantieri.' 
                  : `${rhythm.todayCount} operazioni registrate oggi sul campo.`}
              </p>
            </div>

            {/* KPI 2: Eventi Oggi */}
            <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Movimenti Oggi
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                  Oggi
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">{rhythm.todayCount}</span>
                <span className="text-xs text-slate-400">eventi totali</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {rhythm.lastHourCount > 0 
                  ? `⚡ ${rhythm.lastHourCount} movimenti nell'ultima ora` 
                  : 'Nessun movimento nell\'ultima ora'}
              </p>
            </div>

            {/* KPI 3: Cantieri in Azione */}
            <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Cantieri Attivi Oggi
                </span>
                <Building2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{rhythm.activeCantieriCount}</span>
                <span className="text-xs text-slate-400">su {cantieri.length} totali</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                {rhythm.activeCantieriToday.length > 0 
                  ? rhythm.activeCantieriToday.join(', ') 
                  : 'Nessun cantiere mosso'}
              </p>
            </div>

            {/* KPI 4: Ultima Stringa Tracciata */}
            <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Ultimo Rilevamento
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              {rhythm.lastEvent ? (
                <>
                  <p className="text-xs font-bold text-white truncate">
                    {rhythm.lastEvent.summary}
                  </p>
                  <p className="text-[10px] text-amber-400 font-mono mt-1">
                    {formatTimeInfo(rhythm.lastEvent.timestamp).relative} • {rhythm.lastEvent.userName}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">Nessun evento registrato</p>
              )}
            </div>
          </div>

          {/* ALLERTA CALMA PIATTA (Se 0 eventi oggi) */}
          {rhythm.status === 'calma_piatta' && (
            <div className="bg-rose-500/15 border-2 border-rose-500/50 rounded-2xl p-4 flex items-start gap-3 text-rose-200 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="font-bold text-white uppercase tracking-wide block mb-0.5">
                  Avviso Dirigenziale: Calma Piatta Rilevata
                </strong>
                Non risulta ancora alcun ordine approvato, bolla caricata, timbratura presenze o rapportino per la giornata odierna. Se i cantieri sono regolarmente aperti, sollecita i capicantiere a trasmettere le attività o beggiare le presenze.
              </div>
            </div>
          )}

          {/* ISTOGRAMMA FASCE ORARIE (Espandibile) */}
          <AnimatePresence>
            {showHourlyBar && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4 border-t border-slate-800"
              >
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">
                    Ritmo Orario della Giornata (Ore 06:00 - 20:00)
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Picchi di attività (timbrature mattina, bolle/ordini mezzogiorno, rapportini sera)
                  </span>
                </div>
                <div className="grid grid-cols-15 gap-1.5 h-16 items-end bg-slate-900 p-3 rounded-2xl border border-slate-800">
                  {rhythm.hourlyDistribution.map(item => {
                    const maxCount = Math.max(...rhythm.hourlyDistribution.map(d => d.count), 1);
                    const heightPercent = Math.max((item.count / maxCount) * 100, item.count > 0 ? 20 : 6);
                    return (
                      <div key={item.hour} className="flex flex-col items-center gap-1 h-full justify-end group relative">
                        <div 
                          className={`w-full rounded-xs transition-all ${
                            item.count > 0 
                              ? 'bg-amber-400 group-hover:bg-amber-300' 
                              : 'bg-slate-800'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[9px] font-mono text-slate-500">
                          {item.hour < 10 ? `0${item.hour}` : item.hour}
                        </span>
                        {item.count > 0 && (
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-[10px] text-white px-1.5 py-0.5 rounded-md pointer-events-none whitespace-nowrap z-20">
                            {item.count} op.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* STRUMENTI DI FILTRO E RICERCA */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Categorie Filtro */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            {[
              { id: 'all', label: 'Tutti gli Eventi', count: allEvents.length },
              { id: 'ordine', label: '📦 Ordini Materiali', count: allEvents.filter(e => e.type === 'ordine').length },
              { id: 'badge', label: '⏱️ Beggiature GPS', count: allEvents.filter(e => e.type === 'badge').length },
              { id: 'bolla', label: '🚚 Bolle & DDT', count: allEvents.filter(e => e.type === 'bolla').length },
              { id: 'rapportino', label: '📋 Rapportini', count: allEvents.filter(e => e.type === 'rapportino').length },
              { id: 'documento', label: '📁 Documenti', count: allEvents.filter(e => e.type === 'documento').length },
              { id: 'contabilita', label: '💶 Contabilità', count: allEvents.filter(e => e.type === 'contabilita').length },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedType(cat.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  selectedType === cat.id
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  selectedType === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Switch Solo Oggi */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOnlyToday(!onlyToday)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                onlyToday
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              📅 Solo Movimenti di Oggi ({rhythm.todayCount})
            </button>
          </div>
        </div>

        {/* Search Input & Cantiere Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca evento per parola chiave (es. cemento, DDT, Mario Rossi, plinti, entrata)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <select
              value={selectedCantiereId}
              onChange={e => setSelectedCantiereId(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-amber-500 transition-colors cursor-pointer"
            >
              <option value="all">Tutti i Cantieri ({cantieri.length})</option>
              {cantieri.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* FEED DEGLI EVENTI IN TEMPO REALE (Tracciato Sintetico) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-900">
              Tracciato Eventi ({filteredEvents.length} voci)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            Ordinati dal più recente
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Activity className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">
              Nessun evento corrisponde ai filtri selezionati.
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Prova a reimpostare i filtri su "Tutti gli Eventi" o a disattivare il filtro di ricerca.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEvents.slice(0, isCompact ? 10 : 50).map((event, idx) => {
              const visual = getTypeVisual(event.type);
              const IconComp = visual.icon;
              const timeInfo = formatTimeInfo(event.timestamp);

              return (
                <motion.div
                  key={event.id || idx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleEventClick(event)}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Icon Container */}
                    <div className={`w-10 h-10 rounded-2xl ${visual.bg} ${visual.border} border flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform`}>
                      <IconComp className={`w-5 h-5 ${visual.color}`} />
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${visual.badge}`}>
                          {event.badgeLabel || visual.label}
                        </span>

                        {event.cantiereName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{event.cantiereName}</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{event.userName}</span>
                        </span>
                      </div>

                      {/* STRINGA SINTETICA PRINCIPALE */}
                      <p className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors leading-snug">
                        {event.summary}
                      </p>

                      {/* Dettagli Opzionali */}
                      {event.details && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {event.details}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Timestamp & Action Hint */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-1 text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-xs font-black text-slate-900 font-mono">
                      {timeInfo.time}
                    </span>
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">
                      {timeInfo.relative}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                      {timeInfo.date}
                    </span>

                    <div className="text-[11px] font-bold text-slate-400 group-hover:text-slate-900 flex items-center gap-0.5 mt-1 transition-colors">
                      <span>Dettagli</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {filteredEvents.length > (isCompact ? 10 : 50) && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-500 font-semibold">
              Visualizzati {isCompact ? 10 : 50} di {filteredEvents.length} eventi registrati.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
