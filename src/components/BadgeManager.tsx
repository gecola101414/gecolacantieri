import React, { useState, useEffect } from 'react';
import { 
  Clock, MapPin, CheckCircle2, LogOut, LogIn, Users, Building2, 
  Calendar, Filter, Search, Shield, RefreshCw, AlertCircle, ExternalLink, 
  ChevronRight, Navigation, Download, MessageSquare, Check, X, User
} from 'lucide-react';
import { TimbraturaBadge, Cantiere, UserAccount, BadgeType, BadgeGPSLocation } from '../types';

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
  // Clock state
  const [selectedCantiereId, setSelectedCantiereId] = useState<string>(
    currentUser.cantiereId || cantieri[0]?.id || 'centrale'
  );
  const [noteText, setNoteText] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<BadgeGPSLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter state
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCantiere, setFilterCantiere] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'timbratore' | 'registro' | 'presenti'>('timbratore');

  // Real-time clock display
  const [nowTime, setNowTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Request GPS position on load or manually
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
          resolve(loc);
        },
        (error) => {
          setIsLocating(false);
          let errMs = 'Impossibile rilevare la posizione GPS.';
          if (error.code === error.PERMISSION_DENIED) {
            errMs = 'Permesso GPS negato. Abilita la posizione per registrare il badge con coordinate.';
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
      notes: noteText.trim() || undefined,
      deviceInfo: navigator.userAgent.includes('Mobile') ? 'Smartphone' : 'Desktop/Tablet'
    };

    try {
      await onSaveTimbratura(newTimbratura);
      setNoteText('');
    } catch (e: any) {
      alert(`Errore salvataggio timbratura: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute live present workers (currently in cantiere)
  // For each user, get their latest timbratura overall
  const latestTimbratureByUser: Record<string, TimbraturaBadge> = {};
  timbrature.forEach(t => {
    if (!latestTimbratureByUser[t.userId] || new Date(t.timestamp) > new Date(latestTimbratureByUser[t.userId].timestamp)) {
      latestTimbratureByUser[t.userId] = t;
    }
  });

  const currentlyOnSite = Object.values(latestTimbratureByUser).filter(t => t.type === 'entrata');

  const isLavoratore = currentUser.role === 'lavoratore';

  // Filtered log entries
  const filteredTimbrature = timbrature.filter(t => {
    // A lavoratore can strictly ONLY see their own timbrature history
    if (isLavoratore && t.userId !== currentUser.id) return false;
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

  // Calculate stats for selected date
  const todayStr = new Date().toISOString().split('T')[0];
  const userBaseTimbrature = isLavoratore 
    ? timbrature.filter(t => t.userId === currentUser.id)
    : timbrature;

  const todayTimbrature = userBaseTimbrature.filter(t => t.date === (filterDate || todayStr));
  const todayEntrate = todayTimbrature.filter(t => t.type === 'entrata').length;
  const todayUscite = todayTimbrature.filter(t => t.type === 'uscita').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Clock className="w-7 h-7 font-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Badge & Registro Presenze GPS</h2>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Modulo Periferico
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Timbratura elettronica automatica di entrata e uscita con tracciamento geolocalizzato GPS e monitoraggio presenze in tempo reale.
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

      {/* Tabs Selector */}
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
          <span>Timbra Badge Personale</span>
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
          <span>Presenti in Cantiere ORA</span>
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
          <span>Registro & Storico Timbrature</span>
          <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-black">
            {filteredTimbrature.length}
          </span>
        </button>
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

            {/* Action Buttons: SMART COMPATIBLE SINGLE BADGE BUTTON moved to top */}
            <div className="pt-2">
              {isCurrentlyInCantiere ? (
                <div className="space-y-3 bg-rose-50/80 border border-rose-200/90 p-5 rounded-3xl shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-950">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                      Prossima Azione Disponibile:
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
                    <span>{isSubmitting ? 'REGISTRAZIONE USCITA GPS...' : 'TIMBRA USCITA (OUT)'}</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-500 font-medium">
                    Il pulsante Entrata è disabilitato perché risulti già presente in cantiere.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 bg-emerald-50/80 border border-emerald-200/90 p-5 rounded-3xl shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                      Prossima Azione Disponibile:
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
                    <span>{isSubmitting ? 'REGISTRAZIONE ENTRATA GPS...' : 'TIMBRA ENTRATA (IN)'}</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-500 font-medium">
                    Il pulsante Uscita è disabilitato perché sei fuori cantiere.
                  </p>
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
                  {cantieri.map(c => (
                    <option key={c.id} value={c.id}>
                      🚧 {c.name} ({c.address || c.client})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Note Opzionali (es. Turno, Attività svolta o motivazione)
                </label>
                <input
                  type="text"
                  placeholder="es. Inizio turno di posa armature, Pausa pranzo, Fine giornata..."
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
                    <span className="text-xs font-bold text-slate-800">Geolocalizzazione GPS Badge</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestGPSPosition()}
                    disabled={isLocating}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 transition-all"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>Rileva Coordinate</span>
                  </button>
                </div>

                {isLocating ? (
                  <p className="text-xs text-amber-700 font-semibold animate-pulse flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 animate-bounce" /> Acquisizione coordinate satellitari in corso...
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
                    La posizione GPS verrà registrata automaticamente al momento del click di Entrata/Uscita.
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

              <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
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
                <span>Tracciabilità Valida per la Sicurezza</span>
              </p>
              <p className="text-amber-800 text-[10px] leading-tight">
                Ogni timbratura viene archiviata nel registro ufficiale di cantiere con marca temporale e coordinata GPS per il controllo accessi.
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
                  Elenco in tempo reale degli utenti che hanno effettuato la timbratura d'entrata senza ancora timbrare l'uscita.
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
                  Tutti i lavoratori hanno timbrato l'uscita o non ci sono sessioni attive oggi.
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
                            IN CANTIERE
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                          <p className="flex items-center gap-2 text-slate-700 font-bold">
                            <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{t.cantiereName}</span>
                          </p>
                          <p className="flex items-center gap-2 text-slate-600 font-medium">
                            <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Entrata: <strong>{t.time}</strong> ({t.date})</span>
                          </p>
                          <p className="flex items-center gap-2 text-slate-600 font-medium">
                            <Navigation className="w-4 h-4 text-blue-500 shrink-0" />
                            <span>Tempo Trascorso: <strong className="text-slate-900 font-mono">{hours}h {mins}m</strong></span>
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

                      {/* Admin Force Clock Out Button */}
                      {(currentUser.role === 'admin' || currentUser.role === 'capo_cantiere') && (
                        <button
                          onClick={async () => {
                            if (confirm(`Confermi la timbratura d'uscita d'ufficio per ${t.userName}?`)) {
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
                                notes: `Uscita registrata d'ufficio da ${currentUser.name}`
                              };
                              await onSaveTimbratura(newOut);
                            }
                          }}
                          className="w-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 hover:border-rose-200 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Timbra Uscita d'Ufficio</span>
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

      {/* TAB 3: REGISTRO E STORICO TIMBRATURE */}
      {activeTab === 'registro' && (
        <div className="space-y-6">
          {/* KPI Cards Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {isLavoratore ? 'Le Mie Entrate' : 'Entrate Oggi'}
              </span>
              <p className="text-3xl font-black text-emerald-600">{todayEntrate}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Timbrature d'accesso</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {isLavoratore ? 'Le Mie Uscite' : 'Uscite Oggi'}
              </span>
              <p className="text-3xl font-black text-rose-600">{todayUscite}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Fine turno/pause</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">In Cantiere ORA</span>
              <p className="text-3xl font-black text-amber-500">{currentlyOnSite.length}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {isLavoratore ? 'Presenti in cantiere con te' : 'Operatori attivi'}
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {isLavoratore ? 'Mio Storico' : 'Totale Registro'}
              </span>
              <p className="text-3xl font-black text-slate-900">
                {isLavoratore ? userBaseTimbrature.length : timbrature.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Presenze complessive</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  placeholder="Cerca per nome operatore, cantiere o note..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none"
                />

                {isLavoratore ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5 text-xs font-black text-amber-900 flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{currentUser.name} (I miei orari)</span>
                  </div>
                ) : (
                  <select
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="all">Tutti gli Utenti</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}

                <select
                  value={filterCantiere}
                  onChange={(e) => setFilterCantiere(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">Tutti i Cantieri</option>
                  <option value="centrale">Magazzino Centrale</option>
                  {cantieri.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">Entrata / Uscita</option>
                  <option value="entrata">Solo Entrate (IN)</option>
                  <option value="uscita">Solo Uscite (OUT)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Log */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-400">
                    <th className="px-6 py-4">Data & Ora</th>
                    <th className="px-6 py-4">Evento</th>
                    <th className="px-6 py-4">Operatore / Utente</th>
                    <th className="px-6 py-4">Cantiere</th>
                    <th className="px-6 py-4">Posizione GPS</th>
                    <th className="px-6 py-4">Note / Dispositivo</th>
                    {currentUser.role === 'admin' && <th className="px-6 py-4 text-right">Azioni</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTimbrature.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                        Nessuna timbratura trovata con i filtri selezionati.
                      </td>
                    </tr>
                  ) : (
                    filteredTimbrature.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">
                          <div>{t.date}</div>
                          <div className="text-[11px] text-amber-600 font-black">{t.time}</div>
                        </td>

                        <td className="px-6 py-4">
                          {t.type === 'entrata' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase">
                              <LogIn className="w-3 h-3 text-emerald-600" /> ENTRATA (IN)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black uppercase">
                              <LogOut className="w-3 h-3 text-rose-600" /> USCITA (OUT)
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 font-bold text-slate-900">
                          <div>{t.userName}</div>
                          <span className="text-[9px] font-extrabold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {t.userRole.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="px-6 py-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{t.cantiereName}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {t.location ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                {t.location.latitude.toFixed(4)}, {t.location.longitude.toFixed(4)}
                              </span>
                              {t.location.mapsUrl && (
                                <a 
                                  href={t.location.mapsUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-1.5 text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200"
                                  title="Apri posizione in Google Maps"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Senza GPS</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-slate-600 max-w-xs">
                          {t.notes && <p className="font-medium text-slate-800">"{t.notes}"</p>}
                          {t.deviceInfo && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {t.deviceInfo}
                            </span>
                          )}
                        </td>

                        {currentUser.role === 'admin' && (
                          <td className="px-6 py-4 text-right">
                            {onDeleteTimbratura && (
                              <button
                                onClick={async () => {
                                  if (confirm(`Eliminare la timbratura di ${t.userName} del ${t.date} alle ${t.time}?`)) {
                                    await onDeleteTimbratura(t.id);
                                  }
                                }}
                                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                title="Elimina timbratura"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
