import React, { useState, useEffect, useMemo } from 'react';
import { 
  Cantiere, UserAccount, TimbraturaBadge, BadgeType, BadgeGPSLocation, CantiereChatMessage 
} from '../types';
import { 
  Clock, MapPin, CheckCircle2, LogOut, LogIn, ShieldCheck, AlertTriangle, 
  Send, Calendar, AlertCircle, RefreshCw, MessageSquare, ChevronRight, Check,
  Navigation, PhoneCall, ExternalLink, ShieldAlert, Sparkles, Building2
} from 'lucide-react';
import { calculateDistanceMeters, findNearestCantiere } from '../utils/geoUtils';
import { calculateDailyPresenze } from '../utils/presenceUtils';
import { Logo } from './Branding';
import { VersionBadge } from './VersionBadge';

interface CollaboratoreDashboardProps {
  currentUser: UserAccount;
  cantieri: Cantiere[];
  timbrature: TimbraturaBadge[];
  chatMessages?: CantiereChatMessage[];
  onSaveTimbratura: (t: TimbraturaBadge) => Promise<void>;
  onSendMessage?: (msg: CantiereChatMessage) => Promise<void>;
  onLogout: () => void;
}

export const CollaboratoreDashboard: React.FC<CollaboratoreDashboardProps> = ({
  currentUser,
  cantieri,
  timbrature,
  chatMessages = [],
  onSaveTimbratura,
  onSendMessage = async (_msg: CantiereChatMessage) => {},
  onLogout
}) => {
  // Assigned cantieri only
  const assignedCantieri = useMemo(() => {
    if (currentUser.cantieriAccreditati && currentUser.cantieriAccreditati.length > 0) {
      return cantieri.filter(c => currentUser.cantieriAccreditati!.includes(c.id));
    }
    if (currentUser.cantiereId) {
      return cantieri.filter(c => c.id === currentUser.cantiereId);
    }
    return cantieri;
  }, [cantieri, currentUser]);

  const [selectedCantiereId, setSelectedCantiereId] = useState<string>(
    assignedCantieri[0]?.id || ''
  );

  const [currentLocation, setCurrentLocation] = useState<BadgeGPSLocation | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Rilevamento posizione GPS in corso...');
  const [recognizedCantiere, setRecognizedCantiere] = useState<{ cantiere: Cantiere; distance: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>('');

  // Emergency dialog state
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>('Segnalazione posizione straordinaria / Emergenza');
  const [isSendingEmergency, setIsSendingEmergency] = useState<boolean>(false);

  // Active view tab: 'presenza' | 'storico' | 'chat'
  const [activeTab, setActiveTab] = useState<'presenza' | 'storico' | 'chat'>('presenza');

  // Real-time clock display
  const [nowTime, setNowTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Request GPS and check proximity to assigned cantieri
  const detectLocationAndRecognizeCantiere = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocalizzazione non supportata su questo dispositivo.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Rilevamento GPS in corso per riconoscimento cantiere...');

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

        // Find nearest cantiere among assigned cantieri
        const nearest = findNearestCantiere(loc, assignedCantieri, 300);
        if (nearest && nearest.isWithinRadius) {
          setRecognizedCantiere({
            cantiere: nearest.cantiere,
            distance: nearest.distanceMeters
          });
          setSelectedCantiereId(nearest.cantiere.id);
          setLocationStatus(`Cantiere Riconosciuto: ${nearest.cantiere.name} (${nearest.distanceMeters}m)`);
        } else if (nearest) {
          setRecognizedCantiere(null);
          setLocationStatus(`Più vicino: ${nearest.cantiere.name} a ${nearest.distanceMeters}m (fuori raggio cantiere)`);
        } else {
          setRecognizedCantiere(null);
          setLocationStatus('Coordinate GPS rilevate localmente con successo.');
        }
      },
      (error) => {
        setIsLocating(false);
        let msg = 'Segnale GPS non disponibile';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permesso posizione negato. Abilitalo per il riconoscimento automatico.';
        }
        setLocationStatus(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    detectLocationAndRecognizeCantiere();
  }, [assignedCantieri]);

  // User presence status today
  const userTimbratureToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return timbrature
      .filter(t => t.userId === currentUser.id && t.date === today)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [timbrature, currentUser.id]);

  const lastTimbratura = userTimbratureToday[0];
  const isCurrentlyInCantiere = lastTimbratura?.type === 'entrata';
  const activeCantiere = cantieri.find(c => c.id === lastTimbratura?.cantiereId);

  // Handle Clock In / Out
  const handleClockAction = async (type: BadgeType) => {
    const cantiereToUse = cantieri.find(c => c.id === selectedCantiereId) || assignedCantieri[0];
    if (!cantiereToUse) {
      alert('Seleziona il cantiere a cui timbrare la presenza.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Re-read fresh GPS coordinates for high accuracy at the exact moment of clocking
      let freshLoc = currentLocation;
      if (navigator.geolocation) {
        try {
          const freshPos = await new Promise<GeolocationPosition>((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 })
          );
          freshLoc = {
            latitude: freshPos.coords.latitude,
            longitude: freshPos.coords.longitude,
            accuracy: Math.round(freshPos.coords.accuracy),
            altitude: freshPos.coords.altitude,
            mapsUrl: `https://www.google.com/maps?q=${freshPos.coords.latitude},${freshPos.coords.longitude}`
          };
          setCurrentLocation(freshLoc);
        } catch {
          // Keep existing or undefined
        }
      }

      const now = new Date();
      const newTimbratura: TimbraturaBadge = {
        id: `timb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        cantiereId: cantiereToUse.id,
        cantiereName: cantiereToUse.name,
        type: type,
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        location: freshLoc || undefined,
        notes: noteText.trim() || (recognizedCantiere ? `Riconosciuto automaticamente a ${recognizedCantiere.distance}m` : undefined),
        deviceInfo: 'App Collaboratore Mobile'
      };

      await onSaveTimbratura(newTimbratura);
      setNoteText('');
      alert(`Timbratura di ${type === 'entrata' ? 'ENTRATA' : 'USCITA'} registrata con successo per ${cantiereToUse.name}!`);
    } catch (e: any) {
      alert(`Errore salvataggio presenza: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Emergency / Outside Position
  const handleSendEmergencyPosition = async () => {
    setIsSendingEmergency(true);
    try {
      let freshLoc = currentLocation;
      if (navigator.geolocation) {
        try {
          const freshPos = await new Promise<GeolocationPosition>((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 })
          );
          freshLoc = {
            latitude: freshPos.coords.latitude,
            longitude: freshPos.coords.longitude,
            accuracy: Math.round(freshPos.coords.accuracy),
            altitude: freshPos.coords.altitude,
            mapsUrl: `https://www.google.com/maps?q=${freshPos.coords.latitude},${freshPos.coords.longitude}`
          };
          setCurrentLocation(freshLoc);
        } catch {
          // fallback
        }
      }

      const now = new Date();
      const cantiereToUse = cantieri.find(c => c.id === selectedCantiereId) || assignedCantieri[0];

      const emergencyTimbratura: TimbraturaBadge = {
        id: `timb-emerg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        cantiereId: cantiereToUse?.id || 'emergenza',
        cantiereName: cantiereToUse?.name || 'Posizione Straordinaria',
        type: isCurrentlyInCantiere ? 'uscita' : 'entrata',
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        location: freshLoc || undefined,
        notes: `[SEGNALAZIONE POSIZIONE / EMERGENZA]: ${emergencyReason}`,
        isEmergency: true,
        deviceInfo: 'Invio Emergenza Collaboratore'
      };

      await onSaveTimbratura(emergencyTimbratura);
      setShowEmergencyModal(false);
      alert('Posizione e allarme inviati con successo alla direzione e al capo cantiere!');
    } catch (e: any) {
      alert(`Errore invio posizione di emergenza: ${e.message || e}`);
    } finally {
      setIsSendingEmergency(false);
    }
  };

  // Personal presence history calculation
  const personalPresenze = useMemo(() => {
    const userTimbratures = timbrature.filter(t => t.userId === currentUser.id);
    return calculateDailyPresenze(userTimbratures, [currentUser], cantieri);
  }, [timbrature, currentUser, cantieri]);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-10"
  const monthPresenze = personalPresenze.filter(p => p.date.startsWith(currentMonthStr));
  const totalGiornateMese = monthPresenze.length;
  const totalOreMese = Math.round(monthPresenze.reduce((acc, p) => acc + p.oreTotali, 0) * 10) / 10;
  const presenzeConfermateCount = monthPresenze.filter(p => p.confermatoDaCapo).length;

  // Selected cantiere object
  const currentSelectedCantiere = cantieri.find(c => c.id === selectedCantiereId) || assignedCantieri[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white tracking-tight">{currentUser.name}</span>
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Collaboratore
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Accesso Semplificato • {assignedCantieri.length} Cantieri Assegnati
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            className="text-xs font-bold text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            Esci
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-md mx-auto w-full px-4 pt-4">
        <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl grid grid-cols-3 gap-1">
          <button
            onClick={() => setActiveTab('presenza')}
            className={`py-2 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'presenza' 
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Presenza</span>
          </button>

          <button
            onClick={() => setActiveTab('storico')}
            className={`py-2 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'storico' 
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Registro ({totalGiornateMese})</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'chat' 
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Cantiere</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto w-full px-4 pt-4 flex-1 space-y-4">
        {/* TAB 1: PRESENZA & TIMBRATURA */}
        {activeTab === 'presenza' && (
          <div className="space-y-4">
            {/* Live Clock Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-400 tracking-widest">Ora Corrente</p>
                <p className="text-3xl font-black font-mono text-white tracking-tight mt-0.5">
                  {nowTime.toLocaleTimeString('it-IT')}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {nowTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="text-right">
                <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full border ${
                  isCurrentlyInCantiere 
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30 animate-pulse' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isCurrentlyInCantiere ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  {isCurrentlyInCantiere ? 'PRESENTE IN CANTIERE' : 'FUORI CANTIERE'}
                </span>
                {lastTimbratura && (
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Ultimo: {lastTimbratura.type.toUpperCase()} alle {lastTimbratura.time}
                  </p>
                )}
              </div>
            </div>

            {/* Automatic Cantiere Detection Alert */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-amber-400">
                  <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>Riconoscimento Automatico GPS</span>
                </div>
                <button
                  type="button"
                  onClick={detectLocationAndRecognizeCantiere}
                  disabled={isLocating}
                  className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded-xl transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>Aggiorna GPS</span>
                </button>
              </div>

              {recognizedCantiere ? (
                <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 font-black" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-300">
                      Cantiere Riconosciuto: {recognizedCantiere.cantiere.name}
                    </p>
                    <p className="text-[11px] text-emerald-400/80 mt-0.5 font-medium">
                      Ti trovi a soli <strong>{recognizedCantiere.distance} metri</strong> dal cantiere. Il sistema ha impostato automaticamente questo cantiere per la timbratura.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-300 font-medium">
                    {locationStatus}
                  </p>
                </div>
              )}

              {/* Cantiere Selection from Assigned */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                  Cantiere Assegnato Selezionato
                </label>
                <select
                  value={selectedCantiereId}
                  onChange={(e) => setSelectedCantiereId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white font-bold rounded-2xl px-3.5 py-3 text-sm focus:outline-none focus:border-amber-500"
                >
                  {assignedCantieri.map(c => (
                    <option key={c.id} value={c.id}>
                      🏗️ {c.name} {c.localita ? `(${c.localita})` : ''}
                    </option>
                  ))}
                  {assignedCantieri.length === 0 && (
                    <option value="">Nessun cantiere assegnato</option>
                  )}
                </select>
                {currentSelectedCantiere && (currentSelectedCantiere.via || currentSelectedCantiere.localita) && (
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>
                      {currentSelectedCantiere.via} {currentSelectedCantiere.civico}, {currentSelectedCantiere.localita}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Privacy Shield Notice */}
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-200/90 leading-relaxed font-medium">
                <strong>Tutela Totale della Privacy:</strong> La posizione GPS viene controllata esclusivamente in locale sul tuo telefono per riconoscere il cantiere. La posizione viene inviata al server <u>SOLO</u> quando premi Entrata, Uscita o Segnala Posizione.
              </p>
            </div>

            {/* Optional Note Field */}
            <div>
              <input
                type="text"
                placeholder="Nota facoltativa (es. straordinario, trasferta)..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-2xl px-3.5 py-2.5 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Big Action Clock In / Out Buttons */}
            <div className="space-y-3 pt-1">
              {!isCurrentlyInCantiere ? (
                <button
                  type="button"
                  onClick={() => handleClockAction('entrata')}
                  disabled={isSubmitting || assignedCantieri.length === 0}
                  className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-emerald-600/30 text-base flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-6 h-6 stroke-[2.5]" />
                  <span>
                    {isSubmitting ? 'REGISTRAZIONE IN CORSO...' : `TIMBRA ENTRATA IN CANTIERE`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleClockAction('uscita')}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-rose-600/30 text-base flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-6 h-6 stroke-[2.5]" />
                  <span>
                    {isSubmitting ? 'REGISTRAZIONE IN CORSO...' : `TIMBRA USCITA DA CANTIERE`}
                  </span>
                </button>
              )}

              {/* Emergency / Outside Position Transmission */}
              <button
                type="button"
                onClick={() => setShowEmergencyModal(true)}
                className="w-full bg-slate-900 hover:bg-slate-850 border border-rose-500/40 hover:border-rose-500/70 text-rose-300 font-bold py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Invia Posizione di Emergenza / Fuori Cantiere</span>
              </button>
            </div>

            {/* Quick Summary of Today's Timbrature */}
            {userTimbratureToday.length > 0 && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  I Tuoi Movimenti Registrati Oggi
                </p>
                <div className="space-y-1.5">
                  {userTimbratureToday.map((t) => (
                    <div key={t.id} className="bg-slate-800/60 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${t.type === 'entrata' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="font-bold text-white capitalize">{t.type}</span>
                        <span className="text-slate-400 text-[11px]">• {t.cantiereName}</span>
                      </div>
                      <span className="font-mono font-bold text-amber-400">{t.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STORICO & CONTEGGIO GIORNATE DI PRESENZA */}
        {activeTab === 'storico' && (
          <div className="space-y-4">
            {/* Monthly Summary Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 rounded-3xl p-5 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Riepilogo Presenze Mese in Corso
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/50">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Giornate di Presenza</p>
                  <p className="text-2xl font-black text-white mt-1">
                    {totalGiornateMese} <span className="text-xs font-normal text-slate-400">giorni</span>
                  </p>
                  <p className="text-[10px] text-emerald-400 mt-0.5">
                    {presenzeConfermateCount} confermate dal Capo Cantiere
                  </p>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/50">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Ore Totali Registrate</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">
                    {totalOreMese} <span className="text-xs font-normal text-slate-400">ore</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Calcolate da inizio a fine lavoro
                  </p>
                </div>
              </div>
            </div>

            {/* List of Days with Start / End work and confirmation */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                Dettaglio Giornate con Inizio e Fine Lavoro
              </p>

              {personalPresenze.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-xs font-medium">
                  Nessuna giornata di presenza registrata finora.
                </div>
              ) : (
                personalPresenze.map((p) => (
                  <div key={`${p.userId}_${p.date}`} className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-sm text-white">{p.date}</span>
                        <span className="text-xs text-slate-400">({p.cantiereName})</span>
                      </div>
                      <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                        {p.oreTotali} ore
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-800/50 p-2 rounded-xl">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Inizio Lavoro</span>
                        <span className="font-mono font-bold text-emerald-400">{p.entrataTime || 'Non registrato'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Fine Lavoro</span>
                        <span className="font-mono font-bold text-rose-400">{p.uscitaTime || (p.stato === 'presente' ? 'In corso...' : 'Non registrato')}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {p.confermatoDaCapo ? (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confermata dal Capocantiere {p.confermatoDaNome ? `(${p.confermatoDaNome})` : ''}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>In attesa di convalida Capocantiere</span>
                        </span>
                      )}

                      {p.timbrature.some(t => t.location) && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>GPS Registrato</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CHAT DI CANTIERE RAPIDA */}
        {activeTab === 'chat' && (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm text-white">Chat Cantiere & Sicurezza</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {currentSelectedCantiere?.name}
                </span>
              </div>

              {/* Chat messages */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {chatMessages.filter(m => m.cantiereId === selectedCantiereId).length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-6 font-medium">
                    Nessun messaggio recente per questo cantiere.
                  </p>
                ) : (
                  chatMessages
                    .filter(m => m.cantiereId === selectedCantiereId)
                    .map((msg) => {
                      const isMe = msg.senderId === currentUser.id;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                            isMe 
                              ? 'bg-amber-500 text-slate-950 font-medium' 
                              : 'bg-slate-800 text-slate-100 font-normal'
                          }`}>
                            <p className="text-[10px] font-black opacity-75 mb-0.5">{msg.senderName}</p>
                            <p>{msg.text}</p>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                            {new Date(msg.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Quick message sender */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const target = e.currentTarget.elements.namedItem('chatInput') as HTMLInputElement;
                  if (!target || !target.value.trim() || !selectedCantiereId) return;
                  const text = target.value.trim();
                  target.value = '';

                  const newMsg: CantiereChatMessage = {
                    id: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    cantiereId: selectedCantiereId,
                    senderId: currentUser.id,
                    senderName: currentUser.name,
                    senderRole: currentUser.role,
                    createdAt: new Date().toISOString(),
                    type: 'text',
                    text: text
                  };

                  await onSendMessage(newMsg);
                }}
                className="flex items-center gap-2 pt-2 border-t border-slate-800"
              >
                <input
                  name="chatInput"
                  type="text"
                  placeholder="Scrivi messaggio al capocantiere..."
                  className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center cursor-pointer transition shadow-md shadow-amber-500/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
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
              Questa operazione invia immediatamente le coordinate GPS esatte della tua posizione attuale alla direzione aziendale e al capo cantiere.
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
                onClick={handleSendEmergencyPosition}
                disabled={isSendingEmergency}
                className="px-5 py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingEmergency ? 'Invio in corso...' : 'Invia Subito Posizione'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
