import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, MapPin, CheckCircle2, LogOut, LogIn, Users, Building2, 
  Calendar, Filter, Search, Shield, RefreshCw, AlertCircle, ExternalLink, 
  ChevronRight, Navigation, Download, MessageSquare, Check, X, User,
  ShieldAlert, ShieldCheck, AlertTriangle, Sparkles, CheckCheck, Plus
} from 'lucide-react';
import { TimbraturaBadge, Cantiere, UserAccount, BadgeType, BadgeGPSLocation, PresenzaGiornaliera } from '../types';
import { calculateDistanceMeters, findNearestCantiere } from '../utils/geoUtils';
import { calculateDailyPresenze, calculateMonthlyWorkerSummaries, getWeekDates } from '../utils/presenceUtils';

interface BadgeManagerProps {
  currentUser: UserAccount;
  cantieri: Cantiere[];
  users: UserAccount[];
  timbrature: TimbraturaBadge[];
  onSaveTimbratura: (timbratura: TimbraturaBadge) => Promise<void>;
  onDeleteTimbratura?: (id: string) => Promise<void>;
}

export const BadgeManager: React.FC<BadgeManagerProps> = ({
  currentUser,
  cantieri,
  users,
  timbrature = [],
  onSaveTimbratura,
  onDeleteTimbratura
}) => {
  // Cantieri access: if operative/collaboratore/lavoratore, prioritize assigned cantieri
  const relevantCantieri = useMemo(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'dirigente' || currentUser.role === 'capo_cantiere') {
      return cantieri;
    }
    if (currentUser.cantieriAccreditati && currentUser.cantieriAccreditati.length > 0) {
      return cantieri.filter(c => currentUser.cantieriAccreditati!.includes(c.id));
    }
    if (currentUser.cantiereId) {
      return cantieri.filter(c => c.id === currentUser.cantiereId);
    }
    return cantieri;
  }, [cantieri, currentUser]);

  // Clock state
  const [selectedCantiereId, setSelectedCantiereId] = useState<string>(
    currentUser.cantiereId || relevantCantieri[0]?.id || 'centrale'
  );
  const [noteText, setNoteText] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<BadgeGPSLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [recognizedCantiere, setRecognizedCantiere] = useState<{ cantiere: Cantiere; distance: number } | null>(null);

  // Emergency Modal
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>('Segnalazione posizione straordinaria / Emergenza');
  const [isSendingEmergency, setIsSendingEmergency] = useState<boolean>(false);

  // Manual worker presence modal for Capo Cantiere
  const [showManualPresenzaModal, setShowManualPresenzaModal] = useState<boolean>(false);
  const [manualWorkerId, setManualWorkerId] = useState<string>('');
  const [manualInTime, setManualInTime] = useState<string>('07:30');
  const [manualOutTime, setManualOutTime] = useState<string>('16:30');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualCantiereId, setManualCantiereId] = useState<string>(cantieri[0]?.id || '');
  const [manualNote, setManualNote] = useState<string>('Presenza registrata direttamente dal Capo Cantiere');

  // Filter state
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCantiere, setFilterCantiere] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Tabs: 'timbratore' | 'presenti' | 'registro'
  const [activeTab, setActiveTab] = useState<'timbratore' | 'presenti' | 'registro'>('timbratore');
  // Registro view sub-mode: 'giornaliero' | 'settimanale' | 'mensile' | 'movimenti'
  const [registroSubMode, setRegistroSubMode] = useState<'giornaliero' | 'settimanale' | 'mensile' | 'movimenti'>('giornaliero');

  // Real-time clock display
  const [nowTime, setNowTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Request GPS position and auto-recognize cantiere
  const requestGPSPosition = (): Promise<BadgeGPSLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError('La geolocalizzazione non è supportata da questo browser.');
        resolve(null);
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsLocating(false);
          const loc: BadgeGPSLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
            altitude: position.coords.altitude,
            mapsUrl: `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`
          };
          setCurrentLocation(loc);

          // Check proximity against cantieri
          const nearest = findNearestCantiere(loc, relevantCantieri, 300);
          if (nearest && nearest.isWithinRadius) {
            setRecognizedCantiere({
              cantiere: nearest.cantiere,
              distance: nearest.distanceMeters
            });
            setSelectedCantiereId(nearest.cantiere.id);
          } else if (nearest) {
            setRecognizedCantiere(null);
          }
          resolve(loc);
        },
        (error) => {
          setIsLocating(false);
          let errMs = 'Impossibile rilevare la posizione GPS.';
          if (error.code === error.PERMISSION_DENIED) {
            errMs = 'Permesso GPS negato. Abilita la posizione sul dispositivo.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errMs = 'Segnale GPS non disponibile al momento.';
          } else if (error.code === error.TIMEOUT) {
            errMs = 'Richiesta posizione GPS scaduta per timeout.';
          }
          setLocationError(errMs);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  // Run initial GPS check on component mount for instant recognition
  useEffect(() => {
    requestGPSPosition();
  }, []);

  // Find user's last timbratura today
  const userTodayTimbrature = timbrature
    .filter(t => t.userId === currentUser.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const lastUserTimbratura = userTodayTimbrature[0];
  const isCurrentlyInCantiere = lastUserTimbratura?.type === 'entrata';
  const activeCantiereName = isCurrentlyInCantiere 
    ? (cantieri.find(c => c.id === lastUserTimbratura.cantiereId)?.name || lastUserTimbratura.cantiereName)
    : null;

  // Handle Badge Clock In / Out
  const handleBadgeClock = async (type: BadgeType) => {
    if (!selectedCantiereId) {
      alert('Seleziona il cantiere prima di timbrare.');
      return;
    }

    if (type === 'entrata' && isCurrentlyInCantiere) {
      alert('Risulti già presente in cantiere! Per registrare un nuovo movimento devi prima effettuare la timbratura di Uscita.');
      return;
    }

    if (type === 'uscita' && !isCurrentlyInCantiere) {
      alert('Non risulti attualmente presente in cantiere! È possibile registrare solo la timbratura di Entrata.');
      return;
    }

    const selectedCantiere = cantieri.find(c => c.id === selectedCantiereId);
    const cantiereName = selectedCantiere ? selectedCantiere.name : (selectedCantiereId === 'centrale' ? 'Magazzino Centrale' : 'Cantiere');

    setIsSubmitting(true);

    // Request GPS
    const gpsLocation = await requestGPSPosition();

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const newTimbratura: TimbraturaBadge = {
      id: `timb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      cantiereId: selectedCantiereId,
      cantiereName: cantiereName,
      type: type,
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      location: gpsLocation || undefined,
      notes: noteText.trim() || (recognizedCantiere ? `Riconosciuto automaticamente (${recognizedCantiere.distance}m)` : undefined),
      deviceInfo: navigator.userAgent.includes('Mobile') ? 'Smartphone' : 'Desktop/Tablet'
    };

    try {
      await onSaveTimbratura(newTimbratura);
      setNoteText('');
      alert(`Timbratura di ${type.toUpperCase()} registrata con successo!`);
    } catch (e: any) {
      alert(`Errore salvataggio timbratura: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Emergency Position
  const handleSendEmergency = async () => {
    setIsSendingEmergency(true);
    try {
      const gpsLocation = await requestGPSPosition();
      const now = new Date();
      const selectedCantiere = cantieri.find(c => c.id === selectedCantiereId) || cantieri[0];

      const emergencyTimbratura: TimbraturaBadge = {
        id: `timb-emerg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        cantiereId: selectedCantiere?.id || 'emergenza',
        cantiereName: selectedCantiere?.name || 'Posizione Straordinaria',
        type: isCurrentlyInCantiere ? 'uscita' : 'entrata',
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('it-IT'),
        location: gpsLocation || undefined,
        notes: `[SEGNALAZIONE POSIZIONE / EMERGENZA]: ${emergencyReason}`,
        isEmergency: true,
        deviceInfo: 'Invio Emergenza'
      };

      await onSaveTimbratura(emergencyTimbratura);
      setShowEmergencyModal(false);
      alert('Posizione straordinaria / Emergenza inviata con successo alla direzione!');
    } catch (err: any) {
      alert(`Errore invio posizione emergenza: ${err.message || err}`);
    } finally {
      setIsSendingEmergency(false);
    }
  };

  // Capo Cantiere / Admin: Confirm Worker Attendance
  const handleConfirmAttendance = async (presenza: PresenzaGiornaliera) => {
    try {
      const now = new Date().toLocaleString('it-IT');
      for (const t of presenza.timbrature) {
        const updated: TimbraturaBadge = {
          ...t,
          confermatoDaCapo: true,
          confermatoDaNome: currentUser.name,
          confermatoIl: now,
        };
        await onSaveTimbratura(updated);
      }
      alert(`Presenza di ${presenza.userName} del ${presenza.date} confermata con successo dal Capo Cantiere!`);
    } catch (e: any) {
      alert(`Errore durante la conferma: ${e.message || e}`);
    }
  };

  // Bulk Confirm all today's workers
  const handleBulkConfirmToday = async (dailyPresenze: PresenzaGiornaliera[]) => {
    if (!confirm(`Confermare tutte le ${dailyPresenze.length} presenze del ${filterDate} come Capo Cantiere?`)) return;
    try {
      const now = new Date().toLocaleString('it-IT');
      let count = 0;
      for (const p of dailyPresenze) {
        if (!p.confermatoDaCapo) {
          for (const t of p.timbrature) {
            await onSaveTimbratura({
              ...t,
              confermatoDaCapo: true,
              confermatoDaNome: currentUser.name,
              confermatoIl: now,
            });
          }
          count++;
        }
      }
      alert(`Confermate ${count} presenze lavorative dal Capo Cantiere.`);
    } catch (e: any) {
      alert(`Errore nella conferma multipla: ${e.message || e}`);
    }
  };

  // Manual attendance creation by Capo Cantiere
  const handleCreateManualPresenza = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualWorkerId || !manualCantiereId) {
      alert('Seleziona operaio e cantiere.');
      return;
    }
    const targetUser = users.find(u => u.id === manualWorkerId);
    const targetCantiere = cantieri.find(c => c.id === manualCantiereId);
    if (!targetUser || !targetCantiere) return;

    try {
      const nowIso = new Date().toISOString();
      const inDateIso = `${manualDate}T${manualInTime}:00.000Z`;
      const outDateIso = `${manualDate}T${manualOutTime}:00.000Z`;

      // 1. Entrata
      const tIn: TimbraturaBadge = {
        id: `timb-man-in-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: targetUser.id,
        userName: targetUser.name,
        userRole: targetUser.role,
        cantiereId: targetCantiere.id,
        cantiereName: targetCantiere.name,
        type: 'entrata',
        timestamp: inDateIso,
        date: manualDate,
        time: manualInTime + ':00',
        notes: manualNote,
        confermatoDaCapo: true,
        confermatoDaNome: currentUser.name,
        confermatoIl: new Date().toLocaleString('it-IT'),
        creatoDaCapoCantiere: true,
        deviceInfo: 'Inserito da Capo Cantiere'
      };

      // 2. Uscita
      const tOut: TimbraturaBadge = {
        id: `timb-man-out-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: targetUser.id,
        userName: targetUser.name,
        userRole: targetUser.role,
        cantiereId: targetCantiere.id,
        cantiereName: targetCantiere.name,
        type: 'uscita',
        timestamp: outDateIso,
        date: manualDate,
        time: manualOutTime + ':00',
        notes: manualNote,
        confermatoDaCapo: true,
        confermatoDaNome: currentUser.name,
        confermatoIl: new Date().toLocaleString('it-IT'),
        creatoDaCapoCantiere: true,
        deviceInfo: 'Inserito da Capo Cantiere'
      };

      await onSaveTimbratura(tIn);
      await onSaveTimbratura(tOut);
      setShowManualPresenzaModal(false);
      alert(`Giornata di presenza inserita e confermata con successo per ${targetUser.name}!`);
    } catch (err: any) {
      alert(`Errore inserimento presenza: ${err.message || err}`);
    }
  };

  // Compute live present workers (currently in cantiere)
  const latestTimbratureByUser: Record<string, TimbraturaBadge> = {};
  timbrature.forEach(t => {
    if (!latestTimbratureByUser[t.userId] || new Date(t.timestamp) > new Date(latestTimbratureByUser[t.userId].timestamp)) {
      latestTimbratureByUser[t.userId] = t;
    }
  });

  const currentlyOnSite = Object.values(latestTimbratureByUser).filter(t => t.type === 'entrata');

  const isLavoratore = currentUser.role === 'lavoratore' || currentUser.role === 'collaboratore';
  const isCapoOrAdmin = currentUser.role === 'capo_cantiere' || currentUser.role === 'admin' || currentUser.role === 'dirigente';

  // Base Timbrature for user
  const userBaseTimbrature = isLavoratore 
    ? timbrature.filter(t => t.userId === currentUser.id)
    : timbrature;

  // Filtered raw timbrature
  const filteredTimbrature = userBaseTimbrature.filter(t => {
    if (!isLavoratore && filterUser !== 'all' && t.userId !== filterUser) return false;
    if (filterCantiere !== 'all' && t.cantiereId !== filterCantiere) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterDate && t.date !== filterDate) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchName = t.userName.toLowerCase().includes(s);
      const matchCant = t.cantiereName.toLowerCase().includes(s);
      const matchNote = (t.notes || '').toLowerCase().includes(s);
      if (!matchName && !matchCant && !matchNote) return false;
    }
    return true;
  });

  // Calculate aggregated daily presenze
  const dailyPresenze = useMemo(() => {
    let list = userBaseTimbrature;
    if (!isLavoratore && filterUser !== 'all') {
      list = list.filter(t => t.userId === filterUser);
    }
    if (filterCantiere !== 'all') {
      list = list.filter(t => t.cantiereId === filterCantiere);
    }
    return calculateDailyPresenze(list, users, cantieri, filterDate);
  }, [userBaseTimbrature, users, cantieri, filterDate, filterUser, filterCantiere, isLavoratore]);

  // Calculate weekly dates & weekly matrix
  const weekDates = useMemo(() => getWeekDates(filterDate), [filterDate]);
  const weeklyPresenze = useMemo(() => {
    let list = userBaseTimbrature;
    if (!isLavoratore && filterUser !== 'all') {
      list = list.filter(t => t.userId === filterUser);
    }
    const allDaily = calculateDailyPresenze(list, users, cantieri);
    // Group by user
    const byUser = new Map<string, { user: UserAccount | undefined; name: string; days: Record<string, PresenzaGiornaliera>; totalHours: number; daysCount: number }>();

    allDaily.forEach(dp => {
      if (!weekDates.includes(dp.date)) return;
      if (!byUser.has(dp.userId)) {
        byUser.set(dp.userId, {
          user: users.find(u => u.id === dp.userId),
          name: dp.userName,
          days: {},
          totalHours: 0,
          daysCount: 0
        });
      }
      const entry = byUser.get(dp.userId)!;
      entry.days[dp.date] = dp;
      entry.totalHours = Math.round((entry.totalHours + dp.oreTotali) * 10) / 10;
      entry.daysCount += 1;
    });

    return Array.from(byUser.values());
  }, [userBaseTimbrature, users, cantieri, weekDates, filterUser, isLavoratore]);

  // Calculate monthly summaries
  const monthlyWorkerSummaries = useMemo(() => {
    let list = userBaseTimbrature;
    if (!isLavoratore && filterUser !== 'all') {
      list = list.filter(t => t.userId === filterUser);
    }
    const allDaily = calculateDailyPresenze(list, users, cantieri);
    return calculateMonthlyWorkerSummaries(allDaily, filterMonth);
  }, [userBaseTimbrature, users, cantieri, filterMonth, filterUser, isLavoratore]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTimbrature = userBaseTimbrature.filter(t => t.date === (filterDate || todayStr));
  const todayEntrate = todayTimbrature.filter(t => t.type === 'entrata').length;
  const todayUscite = todayTimbrature.filter(t => t.type === 'uscita').length;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Clock className="w-7 h-7 font-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Registro Presenze & Badge GPS</h2>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Controllo Personale
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Riconoscimento automatico del cantiere per posizione GPS, conteggio giornate di presenza con orari inizio/fine e convalida Capo Cantiere.
            </p>
          </div>
        </div>

        {/* Live Clock Display */}
        <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 border border-slate-800 shadow-md flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-amber-400 tracking-widest">Ora Corrente</p>
            <p className="text-xl font-black font-mono leading-none mt-0.5 text-white">
              {nowTime.toLocaleTimeString('it-IT')}
            </p>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Data</p>
            <p className="text-xs font-bold text-slate-200 mt-0.5">
              {nowTime.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-blue-700/40 flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-300" />
          </div>
          <div className="text-xs">
            <span className="font-black text-blue-200 uppercase tracking-wider block text-[10px]">
              Garanzia Trasparenza & Privacy Lavoratori
            </span>
            <p className="text-blue-100/90 font-medium text-[11px] mt-0.5">
              Il sistema attiva la posizione GPS localmente solo per riconoscere in quale cantiere ti trovi. Le coordinate vengono trasmesse al server <strong>ESCLUSIVAMENTE</strong> quando clicchi su Entrata o Uscita oppure premendo Segnala Posizione.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowEmergencyModal(true)}
          className="shrink-0 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/30"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Invia Posizione / Emergenza</span>
        </button>
      </div>

      {/* Tabs Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-fit border border-slate-200/80">
          <button
            onClick={() => setActiveTab('timbratore')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'timbratore'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Timbra Badge</span>
          </button>

          <button
            onClick={() => setActiveTab('presenti')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'presenti'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-500" />
            <span>Presenti Ora</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-black">
              {currentlyOnSite.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('registro')}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'registro'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>Registro Presenze (Giornaliero / Settimanale / Mensile)</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-black">
              {dailyPresenze.length}
            </span>
          </button>
        </div>

        {isCapoOrAdmin && (
          <button
            type="button"
            onClick={() => setShowManualPresenzaModal(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Inserisci Presenza Manuale (Capocantiere)</span>
          </button>
        )}
      </div>

      {/* TAB 1: BADGE CLOCK IN / OUT WIDGET */}
      {activeTab === 'timbratore' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Badge Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md space-y-6">
            {/* Status Header Banner */}
            <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${
              isCurrentlyInCantiere 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                  isCurrentlyInCantiere ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 animate-pulse' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isCurrentlyInCantiere ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Stato Badge Attuale</p>
                  <p className="text-base font-black">
                    {isCurrentlyInCantiere ? (
                      <span className="text-emerald-800 flex items-center gap-2">
                        🟢 IN CANTIERE: <strong className="underline decoration-emerald-400">{activeCantiereName}</strong>
                      </span>
                    ) : (
                      <span className="text-slate-600">🔴 FUORI CANTIERE (Nessuna sessione attiva)</span>
                    )}
                  </p>
                  {lastUserTimbratura && (
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      Ultimo cambio: {lastUserTimbratura.type === 'entrata' ? 'Entrata' : 'Uscita'} il {lastUserTimbratura.date} alle ore {lastUserTimbratura.time}
                    </p>
                  )}
                </div>
              </div>

              {isCurrentlyInCantiere && (
                <span className="bg-emerald-600 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-sm shrink-0">
                  PRESENTE ORA
                </span>
              )}
            </div>

            {/* Automatic Recognition Notice */}
            {recognizedCantiere && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-950">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black block">
                      📍 Cantiere Riconosciuto Automaticamente: {recognizedCantiere.cantiere.name}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      Ti trovi a circa {recognizedCantiere.distance} metri dal cantiere.
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black bg-emerald-200 text-emerald-900 px-2.5 py-1 rounded-full uppercase">
                  Agganciato GPS
                </span>
              </div>
            )}

            {/* Action Buttons: SMART COMPATIBLE SINGLE BADGE BUTTON */}
            <div className="pt-2">
              {isCurrentlyInCantiere ? (
                <div className="space-y-3 bg-rose-50/80 border border-rose-200/90 p-5 rounded-3xl shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-950">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                      Prossima Azione:
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded-full border border-rose-300">
                      In Cantiere
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBadgeClock('uscita')}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-600 active:scale-[0.99] text-white font-black py-4.5 px-6 rounded-2xl shadow-xl shadow-rose-600/25 text-base flex items-center justify-center gap-3 transition-all cursor-pointer"
                  >
                    <LogOut className="w-6 h-6 stroke-[2.5]" />
                    <span>{isSubmitting ? 'REGISTRAZIONE USCITA GPS...' : 'TIMBRA USCITA (FINE LAVORO)'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 bg-emerald-50/80 border border-emerald-200/90 p-5 rounded-3xl shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                      Prossima Azione:
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Fuori Cantiere
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBadgeClock('entrata')}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.99] text-white font-black py-4.5 px-6 rounded-2xl shadow-xl shadow-emerald-600/25 text-base flex items-center justify-center gap-3 transition-all cursor-pointer"
                  >
                    <LogIn className="w-6 h-6 stroke-[2.5]" />
                    <span>{isSubmitting ? 'REGISTRAZIONE ENTRATA GPS...' : 'TIMBRA ENTRATA (INIZIO LAVORO)'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Seleziona Cantiere di Riferimento *
                </label>
                <select
                  value={selectedCantiereId}
                  onChange={(e) => setSelectedCantiereId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                >
                  <option value="centrale">🏢 Magazzino / Sede Centrale</option>
                  {relevantCantieri.map(c => (
                    <option key={c.id} value={c.id}>
                      🚧 {c.name} {c.localita ? `(${c.localita})` : ''} - {c.via ? `${c.via} ${c.civico || ''}` : c.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Note Opzionali (Attività svolta, straordinari o note sicurezza)
                </label>
                <input
                  type="text"
                  placeholder="es. Inizio turno getto calcestruzzo, Pausa, Fine giornata..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              {/* GPS Position Box */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800">Geolocalizzazione GPS Attiva</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestGPSPosition()}
                    disabled={isLocating}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>Rileva Coordinate</span>
                  </button>
                </div>

                {isLocating ? (
                  <p className="text-xs text-amber-700 font-semibold animate-pulse flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 animate-bounce" /> Acquisizione satellitare in corso...
                  </p>
                ) : currentLocation ? (
                  <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                    <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      Lat: {currentLocation.latitude.toFixed(5)}, Lng: {currentLocation.longitude.toFixed(5)} (±{currentLocation.accuracy}m)
                    </span>
                    <a 
                      href={currentLocation.mapsUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-amber-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                    >
                      Mappa Google <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : locationError ? (
                  <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {locationError}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    La posizione GPS viene letta localmente e salvata all'atto della timbratura.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* User's Recent Timbrature Today */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Le Tue Timbrature di Oggi</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {userTodayTimbrature.filter(t => t.date === todayStr).length} registrate
                </span>
              </div>

              <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {userTodayTimbrature.filter(t => t.date === todayStr).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-2">
                    <Clock className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-xs italic">Nessuna timbratura effettuata oggi.</p>
                  </div>
                ) : (
                  userTodayTimbrature.filter(t => t.date === todayStr).map(t => (
                    <div 
                      key={t.id}
                      className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                        t.type === 'entrata' 
                          ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950' 
                          : 'bg-rose-50/60 border-rose-200/80 text-rose-950'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          t.type === 'entrata' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}>
                          {t.type === 'entrata' ? 'IN' : 'OUT'}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">{t.cantiereName}</p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Ore {t.time} • {t.type === 'entrata' ? 'Entrata' : 'Uscita'}
                          </p>
                          {t.notes && <p className="text-[10px] italic text-slate-600 mt-0.5">"{t.notes}"</p>}
                        </div>
                      </div>

                      {t.location?.mapsUrl && (
                        <a 
                          href={t.location.mapsUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 text-slate-400 hover:text-amber-600 bg-white rounded-xl border border-slate-200 shadow-sm"
                          title="Vedi su mappa"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl text-[11px] text-amber-900 font-medium space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>Tracciabilità Sicurezza Cantiere</span>
              </p>
              <p className="text-amber-800 text-[10px] leading-tight">
                Ogni timbratura viene registrata con orario esatto per il calcolo delle ore lavorate e validazione del Capo Cantiere.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPERATORI PRESENTI IN CANTIERE ORA */}
      {activeTab === 'presenti' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-500" />
                  <span>Personale Attualmente in Cantiere ({currentlyOnSite.length})</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Elenco in tempo reale degli operatori che hanno effettuato la timbratura d'entrata senza ancora timbrare l'uscita.
                </p>
              </div>

              <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                MONITORAGGIO LIVE
              </span>
            </div>

            {currentlyOnSite.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Nessun operatore in cantiere al momento</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Tutti i lavoratori hanno timbrato l'uscita o non ci sono presenze attive oggi.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentlyOnSite.map(t => {
                  const entryDate = new Date(t.timestamp);
                  const diffMs = nowTime.getTime() - entryDate.getTime();
                  const hours = Math.floor(diffMs / (1000 * 60 * 60));
                  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <div 
                      key={t.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-800 font-black rounded-xl flex items-center justify-center text-sm shadow-sm">
                              {t.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 text-sm">{t.userName}</p>
                              <span className="text-[10px] font-extrabold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                {t.userRole.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                            PRESENTE
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                          <p className="flex items-center gap-2 text-slate-700 font-bold">
                            <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{t.cantiereName}</span>
                          </p>
                          <p className="flex items-center gap-2 text-slate-600 font-medium">
                            <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Inizio Lavoro: <strong>{t.time}</strong></span>
                          </p>
                          <p className="flex items-center gap-2 text-slate-600 font-medium">
                            <Navigation className="w-4 h-4 text-blue-500 shrink-0" />
                            <span>Tempo in Cantiere: <strong className="text-slate-900 font-mono">{hours}h {mins}m</strong></span>
                          </p>
                        </div>

                        {t.location && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] flex items-center justify-between text-slate-700">
                            <span className="font-mono truncate">
                              GPS: {t.location.latitude.toFixed(4)}, {t.location.longitude.toFixed(4)}
                            </span>
                            {t.location.mapsUrl && (
                              <a 
                                href={t.location.mapsUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-amber-600 font-bold hover:underline shrink-0 ml-2"
                              >
                                Mappa
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Capo Cantiere / Admin Force Clock Out */}
                      {isCapoOrAdmin && (
                        <button
                          onClick={async () => {
                            if (confirm(`Confermi la timbratura d'uscita per ${t.userName}?`)) {
                              const now = new Date();
                              const newOut: TimbraturaBadge = {
                                id: `timb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                userId: t.userId,
                                userName: t.userName,
                                userRole: t.userRole,
                                cantiereId: t.cantiereId,
                                cantiereName: t.cantiereName,
                                type: 'uscita',
                                timestamp: now.toISOString(),
                                date: now.toISOString().split('T')[0],
                                time: now.toTimeString().split(' ')[0],
                                notes: `Uscita registrata dal Capo Cantiere (${currentUser.name})`
                              };
                              await onSaveTimbratura(newOut);
                            }
                          }}
                          className="w-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 hover:border-rose-200 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Timbra Uscita (Capocantiere)</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REGISTRO PRESENZE GIORNALIERE, SETTIMANALI O MENSILI */}
      {activeTab === 'registro' && (
        <div className="space-y-6">
          {/* Sub-mode selector */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setRegistroSubMode('giornaliero')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  registroSubMode === 'giornaliero'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Giornaliero
              </button>

              <button
                type="button"
                onClick={() => setRegistroSubMode('settimanale')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  registroSubMode === 'settimanale'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Settimanale
              </button>

              <button
                type="button"
                onClick={() => setRegistroSubMode('mensile')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  registroSubMode === 'mensile'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mensile (Conteggio Giornate)
              </button>

              <button
                type="button"
                onClick={() => setRegistroSubMode('movimenti')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  registroSubMode === 'movimenti'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tutte le Timbrature
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {registroSubMode === 'mensile' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Mese:</span>
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Data di Riferimento:</span>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              )}

              {isCapoOrAdmin && registroSubMode === 'giornaliero' && dailyPresenze.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleBulkConfirmToday(dailyPresenze)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Conferma Tutte le Presenze ({dailyPresenze.filter(p => !p.confermatoDaCapo).length})</span>
                </button>
              )}
            </div>
          </div>

          {/* SUB-VIEW 1: REGISTRO GIORNALIERO */}
          {registroSubMode === 'giornaliero' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Registro Presenze Giornaliero del {filterDate}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Conteggio ore lavorate per singolo operaio, inizio e fine turno, e stato di conferma del Capo Cantiere.
                  </p>
                </div>
                <span className="text-xs font-black bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl">
                  {dailyPresenze.length} Lavoratori
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-400">
                      <th className="px-6 py-4">Operaio / Collaboratore</th>
                      <th className="px-6 py-4">Cantiere</th>
                      <th className="px-6 py-4">Inizio Lavoro</th>
                      <th className="px-6 py-4">Fine Lavoro</th>
                      <th className="px-6 py-4">Ore Lavorate</th>
                      <th className="px-6 py-4">Conferma Capocantiere</th>
                      <th className="px-6 py-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {dailyPresenze.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                          Nessuna presenza registrata per la data {filterDate}.
                        </td>
                      </tr>
                    ) : (
                      dailyPresenze.map((p) => (
                        <tr key={`${p.userId}_${p.date}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">
                            <div>{p.userName}</div>
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              {p.userRole.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="px-6 py-4 font-semibold text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{p.cantiereName}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4 font-mono font-bold text-emerald-600">
                            {p.entrataTime || 'Non timbrato'}
                          </td>

                          <td className="px-6 py-4 font-mono font-bold text-rose-600">
                            {p.uscitaTime || (p.stato === 'presente' ? (
                              <span className="text-amber-600 animate-pulse font-sans">In corso...</span>
                            ) : 'Non timbrato')}
                          </td>

                          <td className="px-6 py-4">
                            <span className="bg-amber-100 text-amber-950 font-black px-2.5 py-1 rounded-lg text-xs">
                              {p.oreTotali} h
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {p.confermatoDaCapo ? (
                              <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-full text-[11px] font-black">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Confermata da {p.confermatoDaNome || 'Capo Cantiere'}</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-full text-[11px] font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>In attesa di convalida</span>
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            {isCapoOrAdmin && !p.confermatoDaCapo && (
                              <button
                                type="button"
                                onClick={() => handleConfirmAttendance(p)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ml-auto shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Conferma Presenza</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: REGISTRO SETTIMANALE */}
          {registroSubMode === 'settimanale' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Registro Presenze Settimanale ({weekDates[0]} - {weekDates[6]})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prospetto settimanale ore e giornate lavorate per ciascun dipendente/collaboratore.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-400">
                      <th className="px-4 py-3">Operaio</th>
                      {weekDates.map(d => {
                        const dateObj = new Date(d);
                        const dayName = dateObj.toLocaleDateString('it-IT', { weekday: 'short' });
                        return (
                          <th key={d} className="px-4 py-3 text-center">
                            <div>{dayName}</div>
                            <div className="text-[9px] text-slate-500">{d.slice(5)}</div>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 text-center">Giorni</th>
                      <th className="px-4 py-3 text-right">Totale Ore</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {weeklyPresenze.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic">
                          Nessuna presenza registrata in questa settimana.
                        </td>
                      </tr>
                    ) : (
                      weeklyPresenze.map(wp => (
                        <tr key={wp.name} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">{wp.name}</td>
                          {weekDates.map(d => {
                            const dayRecord = wp.days[d];
                            return (
                              <td key={d} className="px-4 py-3 text-center">
                                {dayRecord ? (
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-1 text-[11px]">
                                    <span className="font-black text-emerald-950 block">{dayRecord.oreTotali}h</span>
                                    <span className="text-[9px] text-slate-500">{dayRecord.entrataTime?.slice(0, 5)}-{dayRecord.uscitaTime?.slice(0, 5) || '..'}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            {wp.daysCount} gg
                          </td>
                          <td className="px-4 py-3 text-right font-black text-amber-600 text-sm">
                            {wp.totalHours} h
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: REGISTRO MENSILE & CONTEGGIO GIORNATE */}
          {registroSubMode === 'mensile' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Conteggio Presenze Mensili ({filterMonth})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Totale giornate di presenza effettive lavorate nel mese per ogni operaio con inizio/fine lavoro.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyWorkerSummaries.map(s => (
                  <div key={s.userId} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">{s.userName}</h4>
                        <span className="text-[10px] font-bold uppercase text-slate-500">{s.userRole.replace('_', ' ')}</span>
                      </div>
                      <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-1 rounded-xl">
                        {s.totalGiornate} Giornate
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Giornate Totali</span>
                        <span className="text-lg font-black text-slate-900">{s.totalGiornate}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Ore Totali Mese</span>
                        <span className="text-lg font-black text-amber-600">{s.totalOre} h</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-200 max-h-48 overflow-y-auto pr-1">
                      <p className="text-[10px] uppercase font-black text-slate-400">Dettaglio Giorni Mese:</p>
                      {s.dailyDetails.map(d => (
                        <div key={d.date} className="bg-white p-2 rounded-lg border border-slate-200/60 text-[11px] flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800">{d.date}</span>
                            <span className="text-slate-500 ml-1.5">({d.entrataTime || '--'} - {d.uscitaTime || '--'})</span>
                          </div>
                          <span className="font-black text-amber-600">{d.oreTotali}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-VIEW 4: MOVIMENTI GREZZI AUDIT TABLE */}
          {registroSubMode === 'movimenti' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-400">
                      <th className="px-6 py-4">Data & Ora</th>
                      <th className="px-6 py-4">Evento</th>
                      <th className="px-6 py-4">Operatore</th>
                      <th className="px-6 py-4">Cantiere</th>
                      <th className="px-6 py-4">GPS</th>
                      <th className="px-6 py-4">Note / Convalida</th>
                      {currentUser.role === 'admin' && <th className="px-6 py-4 text-right">Azioni</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredTimbrature.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">
                          <div>{t.date}</div>
                          <div className="text-[11px] text-amber-600 font-black">{t.time}</div>
                        </td>
                        <td className="px-6 py-4">
                          {t.type === 'entrata' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase">
                              <LogIn className="w-3 h-3 text-emerald-600" /> ENTRATA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black uppercase">
                              <LogOut className="w-3 h-3 text-rose-600" /> USCITA
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{t.userName}</td>
                        <td className="px-6 py-4">{t.cantiereName}</td>
                        <td className="px-6 py-4">
                          {t.location ? (
                            <a href={t.location.mapsUrl} target="_blank" rel="noreferrer" className="text-amber-600 font-bold hover:underline flex items-center gap-1 text-[11px]">
                              Mappa GPS <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-slate-400 italic">Senza GPS</span>}
                        </td>
                        <td className="px-6 py-4">
                          {t.confermatoDaCapo && (
                            <span className="text-emerald-700 font-bold block text-[10px]">
                              ✅ Confermato da {t.confermatoDaNome}
                            </span>
                          )}
                          {t.notes && <p className="text-slate-600">"{t.notes}"</p>}
                        </td>
                        {currentUser.role === 'admin' && (
                          <td className="px-6 py-4 text-right">
                            {onDeleteTimbratura && (
                              <button
                                onClick={async () => {
                                  if (confirm(`Eliminare la timbratura di ${t.userName}?`)) {
                                    await onDeleteTimbratura(t.id);
                                  }
                                }}
                                className="p-2 text-slate-300 hover:text-rose-600 rounded-xl"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Presence Creation Modal for Capo Cantiere */}
      {showManualPresenzaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900">
                  Registrazione Presenza dal Capocantiere
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManualPresenzaModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualPresenza} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Seleziona Operaio / Collaboratore *
                </label>
                <select
                  value={manualWorkerId}
                  onChange={(e) => setManualWorkerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold outline-none"
                  required
                >
                  <option value="">Seleziona utente...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Cantiere di Riferimento *
                </label>
                <select
                  value={manualCantiereId}
                  onChange={(e) => setManualCantiereId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold outline-none"
                  required
                >
                  {cantieri.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.localita ? `(${c.localita})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                    Data
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                    Inizio (Entrata)
                  </label>
                  <input
                    type="time"
                    value={manualInTime}
                    onChange={(e) => setManualInTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                    Fine (Uscita)
                  </label>
                  <input
                    type="time"
                    value={manualOutTime}
                    onChange={(e) => setManualOutTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Note di Convalida
                </label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowManualPresenzaModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition"
                >
                  Salva & Conferma Presenza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Invia Posizione di Emergenza</h3>
                <p className="text-xs text-rose-300 font-medium">
                  Segnalazione posizione straordinaria o soccorso
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Questa funzione invia le tue coordinate GPS esatte alla centrale operativa e al Capo Cantiere.
            </p>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Motivazione / Nota
              </label>
              <textarea
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-rose-500"
                placeholder="Specifica se emergenza, guasto, intervento fuori cantiere..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSendEmergency}
                disabled={isSendingEmergency}
                className="px-5 py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <span>{isSendingEmergency ? 'Invio in corso...' : 'Invia Subito'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
