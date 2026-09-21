import React, { useState, useEffect } from 'react';
import { 
  Cantiere, Personale, Mezzo, Rapportino, UserAccount, Company, TransferCode, StockMovement, 
  MaterialDocument, CantiereChatMessage, CantiereDocumentoTecnico, TimbraturaBadge,
  MaterialRequest, MaterialRequestStatus, Materiale
} from '../types';
import { 
  Building2, HardHat, Wrench, FileText, Plus, Camera, Send, Clock, 
  MapPin, CheckCircle2, AlertCircle, ChevronRight, Fuel, User, 
  Trash2, Image as ImageIcon, Sparkles, Smartphone, Cloud, ArrowLeft, KeyRound, Timer, ShieldCheck, Loader2, ArrowRightLeft, Check, X,
  Calendar, RotateCcw, Ban, Search, Filter, AlertTriangle, RefreshCw, Box, MessageSquare, FolderArchive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';
import { compressPhoto } from '../utils/imageCompressor';
import { PhotoLightbox } from './PhotoLightbox';
import { Logo, FooterBranding } from './Branding';
import { CantiereHub } from './CantiereHub';
import { BadgeManager } from './BadgeManager';
import { VersionBadge } from './VersionBadge';
import { RiconoscimentoFerriModal } from './RiconoscimentoFerriModal';

const formatItalianDate = (isoString?: string) => {
  if (!isoString) return '';
  const parts = isoString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoString;
};

interface MobileRapportinoViewProps {
  currentUser: UserAccount;
  company: Company | null;
  cantieri: Cantiere[];
  personale: Personale[];
  mezzi: Mezzo[];
  rapportini: Rapportino[];
  movements: StockMovement[];
  documents?: MaterialDocument[];
  chatMessages?: CantiereChatMessage[];
  technicalDocs?: CantiereDocumentoTecnico[];
  users?: UserAccount[];
  timbrature?: TimbraturaBadge[];
  onAddRapportino: (r: Rapportino) => void;
  onCancelRapportino?: (rapportinoId: string, motivo: string) => Promise<void>;
  onAcceptTransfer: (moveId: string) => Promise<void>;
  onSendMessage?: (msg: CantiereChatMessage) => Promise<void>;
  onSaveTechnicalDoc?: (doc: CantiereDocumentoTecnico) => Promise<void>;
  onDeleteTechnicalDoc?: (docId: string) => Promise<void>;
  onSaveTimbratura?: (t: TimbraturaBadge) => Promise<void>;
  onDeleteTimbratura?: (tid: string) => Promise<void>;
  materialRequests?: MaterialRequest[];
  onSaveMaterialRequest?: (r: MaterialRequest) => Promise<void>;
  onUpdateMaterialRequestStatus?: (rid: string, status: MaterialRequestStatus) => Promise<void>;
  materialiArchive?: Materiale[];
  onAcceptDocument?: (docId: string) => Promise<void>;
  onSaveDocument?: (doc: MaterialDocument) => Promise<void>;
  onAddMateriale?: (m: Materiale) => Promise<void>;
}

export const MobileRapportinoView: React.FC<MobileRapportinoViewProps> = ({
  currentUser,
  company,
  cantieri,
  personale,
  mezzi,
  rapportini,
  movements,
  documents = [],
  chatMessages = [],
  technicalDocs = [],
  users = [],
  timbrature = [],
  onAddRapportino,
  onCancelRapportino,
  onAcceptTransfer,
  onSendMessage = async () => {},
  onSaveTechnicalDoc = async () => {},
  onDeleteTechnicalDoc = async () => {},
  onSaveTimbratura = async () => {},
  onDeleteTimbratura = async () => {},
  materialRequests = [],
  onSaveMaterialRequest = async (_r: MaterialRequest) => {},
  onUpdateMaterialRequestStatus = async (_rid: string, _status: MaterialRequestStatus) => {},
  materialiArchive = [],
  onAcceptDocument = async (_docId: string) => {},
  onSaveDocument,
  onAddMateriale,
}) => {
  const [step, setStep] = useState<'list' | 'create' | 'hub' | 'badge'>('list');
  const [selectedCantiere, setSelectedCantiere] = useState<Cantiere | null>(null);
  const [showMobileFerriModal, setShowMobileFerriModal] = useState(false);
  const [hubInitialTab, setHubInitialTab] = useState<'materiali' | 'rapportini' | 'personale' | 'chat' | 'archivio'>('materiali');
  
  // Real-time emission clock ticker
  const [currentTime, setCurrentTime] = useState(() => 
    new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to compute next sequential progressive number for a specific cantiere
  const getNextNumeroForCantiere = (cantiereId: string): number => {
    const cantiereRap = rapportini.filter(r => r.cantiereId === cantiereId);
    const maxNum = cantiereRap.reduce((max, cur) => Math.max(max, cur.numeroProgressivo || 0), 0);
    return Math.max(maxNum, cantiereRap.length) + 1;
  };

  // Create form state
  const [formStep, setFormStep] = useState(1);
  const [newRapportino, setNewRapportino] = useState<Partial<Rapportino>>({
    personale: [],
    materiali: [], // Visual only
    materialiUsed: [], // Database stock sync
    mezzi: [],
    personnelHours: [],
    mezziHours: [],
    foto: [],
    note: '',
  });

  // History filtering & cancellation modal states
  const [historyFilterCantiere, setHistoryFilterCantiere] = useState<string>('all');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'all' | 'valido' | 'annullato'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [missingDateBannerText, setMissingDateBannerText] = useState<string>('');
  
  const [cancelModalRapportino, setCancelModalRapportino] = useState<Rapportino | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const handleCreateNew = (cantiere: Cantiere) => {
    if (!currentUser.active) {
      alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
      return;
    }
    
    // Controllo rapportini mancanti
    const cantiereRap = rapportini.filter(r => r.cantiereId === cantiere.id && r.status !== 'annullato');
    let defaultDate = new Date().toISOString().split('T')[0];
    let bannerText = '';
    
    if (cantiereRap.length > 0) {
      const sortedRap = [...cantiereRap].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastDate = sortedRap[0].date;
      
      const lastDateObj = new Date(lastDate);
      const todayObj = new Date();
      todayObj.setHours(0,0,0,0);
      lastDateObj.setHours(0,0,0,0);
      
      const diffTime = todayObj.getTime() - lastDateObj.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Se manca più di 1 giorno e oggi non è lo stesso giorno dell'ultimo
      if (diffDays > 1) {
        const nextDate = new Date(lastDateObj);
        nextDate.setDate(nextDate.getDate() + 1);
        defaultDate = nextDate.toISOString().split('T')[0];
        const formattedNextDate = `${defaultDate.split('-')[2]}/${defaultDate.split('-')[1]}/${defaultDate.split('-')[0]}`;
        bannerText = `Attenzione: manca il rapportino del giorno ${formattedNextDate}. Sei obbligato a compilarlo (o segnarlo "Non Lavorato") prima di procedere con i giorni successivi.`;
      }
    }
    
    setSelectedCantiere(cantiere);
    setMissingDateBannerText(bannerText);
    setNewRapportino({
      userId: currentUser.id,
      userName: currentUser.name,
      cantiereId: cantiere.id,
      date: defaultDate,
      personale: [],
      materiali: [],
      materialiUsed: [],
      mezzi: [],
      personnelHours: [],
      mezziHours: [],
      foto: [],
      note: '',
    });
    setStep('create');
    setFormStep(1);
  };

  // Re-make or clone rapportino (supports re-doing an annulled rapportino preserving full trace)
  const handleRemakeRapportino = (oldRapportino: Rapportino) => {
    if (!currentUser.active) {
      alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
      return;
    }
    const cantiere = cantieri.find(c => c.id === oldRapportino.cantiereId);
    if (!cantiere) {
      alert('Cantiere non trovato o non più attivo.');
      return;
    }
    setSelectedCantiere(cantiere);
    setNewRapportino({
      userId: currentUser.id,
      userName: currentUser.name,
      cantiereId: cantiere.id,
      date: new Date().toISOString().split('T')[0],
      personale: oldRapportino.personale ? [...oldRapportino.personale] : [],
      materiali: oldRapportino.materiali ? [...oldRapportino.materiali] : [],
      materialiUsed: oldRapportino.materialiUsed ? [...oldRapportino.materialiUsed] : [],
      mezzi: oldRapportino.mezzi ? [...oldRapportino.mezzi] : [],
      personnelHours: oldRapportino.personnelHours ? [...oldRapportino.personnelHours] : [],
      mezziHours: oldRapportino.mezziHours ? [...oldRapportino.mezziHours] : [],
      foto: [],
      note: oldRapportino.note 
        ? `[Rifacimento a sostituzione di N° ${oldRapportino.numeroProgressivo || 'prec.'}]: ${oldRapportino.note}`
        : `[Rifacimento a sostituzione di N° ${oldRapportino.numeroProgressivo || 'prec.'}]`,
      sostituisceRapportinoId: oldRapportino.id,
      sostituisceNumero: oldRapportino.numeroProgressivo,
    });
    setSelectedHistoryRapportino(null);
    setStep('create');
    setFormStep(1);
  };

  const handleTogglePersonale = (p: Personale) => {
    const current = newRapportino.personale || [];
    const currentHours = newRapportino.personnelHours || [];
    const exists = current.find(item => item.personaleId === p.id);
    if (exists) {
      setNewRapportino({ 
        ...newRapportino, 
        personale: current.filter(item => item.personaleId !== p.id),
        personnelHours: currentHours.filter(item => item.personnelId !== p.id)
      });
    } else {
      setNewRapportino({ 
        ...newRapportino, 
        personale: [...current, { personaleId: p.id, nome: p.name, ore: 8 }],
        personnelHours: [...currentHours, { personnelId: p.id, hours: 8 }]
      });
    }
  };

  const handleUpdateOre = (pId: string, ore: number) => {
    const current = newRapportino.personale || [];
    const currentHours = newRapportino.personnelHours || [];
    setNewRapportino({
      ...newRapportino,
      personale: current.map(item => item.personaleId === pId ? { ...item, ore } : item),
      personnelHours: currentHours.map(item => item.personnelId === pId ? { ...item, hours: ore } : item)
    });
  };

  const handleAddMaterialeFromStock = (materialeId: string, quantity: number) => {
    if (!selectedCantiere?.stock) return;
    const stockItem = selectedCantiere.stock.find(s => s.materialeId === materialeId);
    if (!stockItem) return;

    const currentUsed = newRapportino.materialiUsed || [];
    const currentVisual = newRapportino.materiali || [];

    setNewRapportino({
      ...newRapportino,
      materialiUsed: [...currentUsed, { materialeId, quantity, unit: stockItem.unit }],
      materiali: [...currentVisual, { materialeId, materialeName: stockItem.materialeName, quantity, unit: stockItem.unit }]
    });
  };

  const handleAddManualMateriale = () => {
    const name = prompt('Nome materiale:');
    if (!name) return;
    const qty = prompt('Quantità:');
    if (!qty) return;
    const unit = prompt('Unità di misura:', 'u');
    if (!unit) return;

    const currentVisual = newRapportino.materiali || [];
    setNewRapportino({
      ...newRapportino,
      materiali: [...currentVisual, { materialeId: 'manual-' + Date.now(), materialeName: name, quantity: Number(qty), unit }]
    });
  };

  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [selectedHistoryRapportino, setSelectedHistoryRapportino] = useState<Rapportino | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same camera/file can be reselected if needed
    e.target.value = '';

    const currentFoto = newRapportino.foto || [];
    if (currentFoto.length >= 4) {
      alert('Puoi allegare al massimo 4 foto per rapportino.');
      return;
    }

    setIsCompressingPhoto(true);
    try {
      // Blazing-fast client-side canvas compression (< 200ms) to clean, optimized data URL
      const dataUrl = await compressPhoto(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.68
      });

      setNewRapportino(prev => ({
        ...prev,
        foto: [...(prev.foto || []), dataUrl]
      }));
    } catch (err) {
      console.error('Error compressing photo:', err);
      alert('Errore durante l\'elaborazione della foto. Riprova con un\'altra immagine.');
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleAddMezzo = (mezzoId: string, hours: number) => {
    const mezzo = mezzi.find(m => m.id === mezzoId);
    if (!mezzo) return;

    const currentMezzi = newRapportino.mezzi || [];
    const currentMezziHours = newRapportino.mezziHours || [];

    setNewRapportino({
      ...newRapportino,
      mezzi: [...currentMezzi, { mezzoId, nome: mezzo.name, ore: hours }],
      mezziHours: [...currentMezziHours, { mezzoId, hours }]
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (isNonLavoratoParam: boolean | React.SyntheticEvent = false) => {
    const isNonLavorato = isNonLavoratoParam === true;
    if (!currentUser.active) {
      alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
      return;
    }
    if (!selectedCantiere) return;
    setIsSubmitting(true);
    try {
      const now = new Date();
      const emissioneOra = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const emissioneData = newRapportino.date || now.toISOString().split('T')[0];
      const nextProg = getNextNumeroForCantiere(selectedCantiere.id);

      const rapportino: Rapportino = {
        id: 'rap-' + Date.now(),
        userId: currentUser.id,
        userName: currentUser.name,
        cantiereId: selectedCantiere.id,
        date: emissioneData,
        ora: emissioneOra,
        submittedAt: now.toISOString(),
        numeroProgressivo: nextProg,
        codiceRapportino: `N° ${nextProg}`,
        status: 'valido',
        isNonLavorato: isNonLavorato,
        sostituisceRapportinoId: newRapportino.sostituisceRapportinoId,
        sostituisceNumero: newRapportino.sostituisceNumero,
        personale: isNonLavorato ? [] : (newRapportino.personale || []),
        materiali: isNonLavorato ? [] : (newRapportino.materiali || []),
        mezzi: isNonLavorato ? [] : (newRapportino.mezzi || []),
        foto: isNonLavorato ? [] : (newRapportino.foto || []),
        note: isNonLavorato 
          ? `[Giorno Non Lavorato] ${newRapportino.note || 'Festivo, ferie o assenza di lavorazioni.'}`
          : (newRapportino.note || ''),
        personnelHours: isNonLavorato ? [] : (newRapportino.personnelHours || []),
        mezziHours: isNonLavorato ? [] : (newRapportino.mezziHours || []),
        materialiUsed: isNonLavorato ? [] : (newRapportino.materialiUsed || []),
      };
      await onAddRapportino(rapportino);
      setNewRapportino({
        personale: [],
        materiali: [],
        materialiUsed: [],
        mezzi: [],
        personnelHours: [],
        mezziHours: [],
        foto: [],
        note: '',
      });
      setStep(selectedCantiere ? 'hub' : 'list');
      const numFoto = (rapportino.foto || []).length;
      alert(`Rapportino N° ${nextProg} inviato con successo alle ore ${emissioneOra}!${numFoto > 0 ? ` (${numFoto} foto allegat${numFoto === 1 ? 'a' : 'e'})` : ''}`);
    } catch (err: any) {
      console.error('Error submitting rapportino:', err);
      let detail = 'Controlla la connessione internet e riprova.';
      if (err?.message) {
        detail = err.message;
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error) detail = parsed.error;
        } catch {
          // not JSON
        }
      }
      alert(`Errore nell'invio del rapportino:\n\n${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!currentUser.active) {
      alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
      return;
    }
    if (!cancelModalRapportino) return;
    if (!cancelReason.trim()) {
      alert('Inserisci la motivazione dell\'annullamento (obbligatoria per la tracciabilità aziendale).');
      return;
    }
    if (!onCancelRapportino) {
      alert('Funzione di annullamento non disponibile.');
      return;
    }
    setIsCancelling(true);
    try {
      await onCancelRapportino(cancelModalRapportino.id, cancelReason.trim());
      alert(`Rapportino N° ${cancelModalRapportino.numeroProgressivo || ''} annullato con successo. La tracciabilità è stata registrata.`);
      setCancelModalRapportino(null);
      setCancelReason('');
      setSelectedHistoryRapportino(null);
    } catch (err) {
      console.error('Error cancelling rapportino:', err);
      alert('Errore durante l\'annullamento del rapportino.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAccept = async (moveId: string) => {
    if (!currentUser.active) {
      alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onAcceptTransfer(moveId);
      alert('Carico accettato con successo. Le giacenze di cantiere sono state aggiornate.');
    } catch (err) {
      console.error('Error accepting transfer:', err);
      alert('Errore durante l\'accettazione del carico.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userRapportini = rapportini.filter(r => 
    currentUser.role === 'admin' || currentUser.role === 'tecnico' 
      ? true 
      : r.userId === currentUser.id
  );

  const filteredHistoryRapportini = userRapportini
    .filter(r => {
      if (historyFilterCantiere !== 'all' && r.cantiereId !== historyFilterCantiere) return false;
      if (historyFilterStatus === 'valido' && r.status === 'annullato') return false;
      if (historyFilterStatus === 'annullato' && r.status !== 'annullato') return false;
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const cName = (cantieri.find(c => c.id === r.cantiereId)?.name || '').toLowerCase();
        const note = (r.note || '').toLowerCase();
        const num = (r.numeroProgressivo ? `n° ${r.numeroProgressivo}` : '').toLowerCase();
        if (!cName.includes(q) && !note.includes(q) && !num.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = `${a.date}T${a.ora || '00:00:00'}`;
      const dateB = `${b.date}T${b.ora || '00:00:00'}`;
      return dateB.localeCompare(dateA);
    });

  const validiCount = userRapportini.filter(r => r.status !== 'annullato').length;
  const annullatiCount = userRapportini.filter(r => r.status === 'annullato').length;
  const filteredCantieri = (currentUser.role === 'admin' || currentUser.role === 'dirigente' || currentUser.role === 'amministrativo_contabile' || !currentUser.cantieriAccreditati || currentUser.cantieriAccreditati.length === 0)
    ? cantieri 
    : cantieri.filter(c => (currentUser.cantieriAccreditati || []).includes(c.id));

  return (
    <div className="w-full max-w-xl mx-auto px-3.5 py-4 sm:px-6 sm:py-6 overflow-x-hidden space-y-6 pb-20">
      <AnimatePresence mode="wait">
        {step === 'hub' && selectedCantiere ? (
          <motion.div
            key={`hub-${selectedCantiere.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full max-w-full overflow-x-hidden"
          >
            <CantiereHub
              cantiere={selectedCantiere}
              currentUser={currentUser}
              company={company}
              cantieri={cantieri}
              personale={personale}
              mezzi={mezzi}
              rapportini={rapportini}
              movements={movements}
              documents={documents}
              chatMessages={chatMessages}
              technicalDocs={technicalDocs}
              onSendMessage={onSendMessage}
              onSaveTechnicalDoc={onSaveTechnicalDoc}
              onDeleteTechnicalDoc={onDeleteTechnicalDoc}
              onOpenRapportinoDetail={(r) => setSelectedHistoryRapportino(r)}
              onCreateRapportinoForCantiere={(c) => handleCreateNew(c)}
              onClose={() => setStep('list')}
              onOpenPhotoLightbox={(url) => setPreviewPhoto(url)}
              initialTab={hubInitialTab}
              materialRequests={materialRequests}
              onSaveMaterialRequest={onSaveMaterialRequest}
              onUpdateMaterialRequestStatus={onUpdateMaterialRequestStatus}
              materialiArchive={materialiArchive}
              onAcceptDocument={onAcceptDocument}
              onSaveDocument={onSaveDocument}
              onAddMateriale={onAddMateriale}
            />
          </motion.div>
        ) : step === 'badge' ? (
          <motion.div
            key="badge"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full space-y-4"
          >
            <button
              onClick={() => setStep('list')}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 transition-all cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4" /> Torna al Menu Principale
            </button>

            <BadgeManager
              currentUser={currentUser}
              cantieri={cantieri}
              users={users}
              timbrature={timbrature}
              onSaveTimbratura={onSaveTimbratura}
              onDeleteTimbratura={onDeleteTimbratura}
            />
          </motion.div>
        ) : step === 'list' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 w-full max-w-full overflow-x-hidden"
          >
              {/* STATUS AGGIORNAMENTO E VERSIONE */}
              <VersionBadge variant="banner" className="shadow-sm" />

              {/* PROMINENT BADGE TIMBRATURA BUTTON */}
              <button
                type="button"
                onClick={() => setStep('badge')}
                className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 p-4 sm:p-5 rounded-[28px] shadow-xl border border-amber-300 flex items-center justify-between group transition-all active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                    <Clock className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-slate-950 text-white px-2 py-0.5 rounded-md">
                        Geolocalizzazione GPS
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-950 leading-tight mt-0.5">
                      Badge Presenze Cantiere
                    </h3>
                    <p className="text-[11px] font-bold text-slate-800 opacity-90">
                      Timbra Entrata / Uscita Cantiere con posizione
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-950/10 flex items-center justify-center shrink-0 group-hover:bg-slate-950 group-hover:text-amber-400 transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-950 group-hover:text-amber-400" />
                </div>
              </button>

              {/* 4 PROMINENT QUICK ACCESS FUNCTION CARDS FOR OPERATOR MOBILE */}
              <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-[28px] shadow-xl border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      Funzioni In Evidenza
                    </span>
                    <h2 className="text-base font-black text-white mt-1">Accesso Diretto Operazioni</h2>
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* 1. MATERIALI */}
                  <button
                    type="button"
                    onClick={() => {
                      setHubInitialTab('materiali');
                      if (filteredCantieri.length > 0) {
                        setSelectedCantiere(filteredCantieri[0]);
                        setStep('hub');
                      }
                    }}
                    className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 hover:from-amber-500/30 hover:to-orange-500/20 border border-amber-500/40 p-3.5 rounded-2xl flex flex-col items-start text-left transition-all active:scale-[0.97] cursor-pointer group shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center mb-2 shadow-md group-hover:scale-110 transition-transform">
                      <Box className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-amber-300">Materiali & Bolle</span>
                    <span className="text-[9px] text-slate-300 font-medium">Giacenze e carichi cantiere</span>
                  </button>

                  {/* 2. PERSONALE */}
                  <button
                    type="button"
                    onClick={() => {
                      setHubInitialTab('personale');
                      if (filteredCantieri.length > 0) {
                        setSelectedCantiere(filteredCantieri[0]);
                        setStep('hub');
                      }
                    }}
                    className="bg-gradient-to-br from-blue-500/20 to-indigo-500/10 hover:from-blue-500/30 hover:to-indigo-500/20 border border-blue-500/40 p-3.5 rounded-2xl flex flex-col items-start text-left transition-all active:scale-[0.97] cursor-pointer group shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-110 transition-transform">
                      <HardHat className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-blue-300">Personale & Presenze</span>
                    <span className="text-[9px] text-slate-300 font-medium">Squadra e ore lavorate</span>
                  </button>

                  {/* 3. CHAT */}
                  <button
                    type="button"
                    onClick={() => {
                      setHubInitialTab('chat');
                      if (filteredCantieri.length > 0) {
                        setSelectedCantiere(filteredCantieri[0]);
                        setStep('hub');
                      }
                    }}
                    className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 hover:from-emerald-500/30 hover:to-teal-500/20 border border-emerald-500/40 p-3.5 rounded-2xl flex flex-col items-start text-left transition-all active:scale-[0.97] cursor-pointer group shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-emerald-300">Chat & Foto Cantiere</span>
                    <span className="text-[9px] text-slate-300 font-medium">Invio scatti e messaggi</span>
                  </button>

                  {/* 4. ARCHIVIO */}
                  <button
                    type="button"
                    onClick={() => {
                      setHubInitialTab('archivio');
                      if (filteredCantieri.length > 0) {
                        setSelectedCantiere(filteredCantieri[0]);
                        setStep('hub');
                      }
                    }}
                    className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 hover:from-purple-500/30 hover:to-pink-500/20 border border-purple-500/40 p-3.5 rounded-2xl flex flex-col items-start text-left transition-all active:scale-[0.97] cursor-pointer group shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-110 transition-transform">
                      <FolderArchive className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-purple-300">Archivio Documenti</span>
                    <span className="text-[9px] text-slate-300 font-medium">POS, DVR e schede tecniche</span>
                  </button>
                </div>

                {/* 5. NUOVO MODULO VISIONE AI: RICONOSCIMENTO FERRI DA FOTO */}
                <button
                  type="button"
                  onClick={() => setShowMobileFerriModal(true)}
                  className="w-full bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/10 hover:from-amber-500/30 hover:to-orange-500/25 border border-amber-500/40 p-3.5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer group shadow-sm text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-amber-300">Riconoscimento Ferri da Foto</span>
                        <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full uppercase">
                          Vision AI
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 truncate">Scatta col telefono: conteggio barre e stima peso</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              </div>

              {/* Active Assignments */}
              <div>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">I Tuoi Cantieri</h2>
                  <Smartphone className="w-4 h-4 text-slate-300" />
                </div>
                
                <div className="space-y-4">
                  {filteredCantieri.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-12 text-center">
                      <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400">Nessun cantiere attivo assegnato.</p>
                    </div>
                  ) : (
                    filteredCantieri.map(c => (
                      <div
                        key={c.id}
                        className="w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-amber-500/40 transition-all space-y-3.5"
                      >
                        <div 
                          onClick={() => {
                            setSelectedCantiere(c);
                            setStep('hub');
                          }}
                          className="flex items-start justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="bg-slate-50 group-hover:bg-amber-500 group-hover:text-slate-950 p-3 rounded-2xl border border-slate-100 text-slate-800 shrink-0 transition-colors">
                              <Building2 className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{c.name}</h3>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
                                  Attivo
                                </span>
                              </div>
                              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-500" /> {c.address}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 5 Sections Preview Bar */}
                        <div 
                          onClick={() => {
                            setSelectedCantiere(c);
                            setStep('hub');
                          }}
                          className="grid grid-cols-5 gap-1 pt-1 cursor-pointer text-center text-[9px] font-bold text-slate-600"
                        >
                          <div className="bg-slate-50 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">📦 Materiali</div>
                          <div className="bg-slate-50 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">📋 Rapportini</div>
                          <div className="bg-slate-50 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">👷 Personale</div>
                          <div className="bg-slate-50 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">💬 Chat</div>
                          <div className="bg-slate-50 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">📁 Archivio</div>
                        </div>

                        {/* Dual Actions: Open Hub OR Direct Rapportino */}
                        <div className="flex gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCantiere(c);
                              setStep('hub');
                            }}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span>Gestione Cantiere</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          {currentUser.role !== 'lavoratore' && currentUser.permissions?.rapportini !== false && (
                            <button
                              type="button"
                              onClick={() => handleCreateNew(c)}
                              className="flex-1 bg-slate-950 hover:bg-slate-900 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />
                              <span>+ Rapportino</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pending Transfers */}
              {movements.some(m => m.status === 'pending' && m.toId && (currentUser.cantieriAccreditati || []).includes(m.toId)) && (
                <div>
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-amber-500" /> Materiali in Arrivo
                  </h2>
                  <div className="space-y-3">
                    {movements
                      .filter(m => m.status === 'pending' && m.toId && (currentUser.cantieriAccreditati || []).includes(m.toId))
                      .map(m => (
                        <div key={m.id} className="bg-amber-50 border border-amber-200 p-5 rounded-[28px] shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[9px] font-black text-amber-700 bg-amber-200/70 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  {m.documentNumber ? `Bolla N. ${m.documentNumber}` : 'Trasferimento'}
                                </span>
                                {m.supplier && (
                                  <span className="text-[10px] font-bold text-slate-600 truncate max-w-[140px]">
                                    {m.supplier}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-black text-slate-900">{m.materialeName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-slate-900 leading-none">{m.quantity}</p>
                              <p className="text-[9px] font-bold text-slate-500 uppercase">Quantità</p>
                            </div>
                          </div>

                          {m.acceptanceNote && (
                            <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80 mb-3 text-[11px] text-slate-700">
                              <span className="font-bold text-amber-800">Nota di consegna: </span>
                              {m.acceptanceNote}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 mb-5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <p className="text-[10px] font-bold text-slate-500">
                              DESTINAZIONE: {cantieri.find(c => c.id === m.toId)?.name}
                            </p>
                          </div>

                          <button 
                            onClick={() => handleAccept(m.id)}
                            disabled={isSubmitting}
                            className="w-full bg-slate-950 text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 text-emerald-400" />
                            )} Accetta Fornitura nel Cantiere
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <FooterBranding />

              {/* History Archive */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Archivio Rapportini</h2>
                    <p className="text-[10px] text-slate-500">Consulta, traccia orario, annulla o rifai</p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                    {filteredHistoryRapportini.length} di {userRapportini.length}
                  </span>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <button
                    onClick={() => setHistoryFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                      historyFilterStatus === 'all'
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tutti ({userRapportini.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilterStatus('valido')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      historyFilterStatus === 'valido'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Validi ({validiCount})
                  </button>
                  <button
                    onClick={() => setHistoryFilterStatus('annullato')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      historyFilterStatus === 'annullato'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    <Ban className="w-3 h-3" /> Annullati ({annullatiCount})
                  </button>
                </div>

                {/* Optional Search and Cantiere filter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cerca cantiere, note, N°..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  {filteredCantieri.length > 1 && (
                    <select
                      value={historyFilterCantiere}
                      onChange={(e) => setHistoryFilterCantiere(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="all">Tutti i Cantieri</option>
                      {filteredCantieri.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* List Cards */}
                <div className="space-y-3">
                  {filteredHistoryRapportini.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-500">Nessun rapportino trovato con questi filtri.</p>
                    </div>
                  ) : (
                    filteredHistoryRapportini.map(r => {
                      const isAnnullato = r.status === 'annullato';
                      const cName = cantieri.find(c => c.id === r.cantiereId)?.name || 'Cantiere';

                      return (
                        <div 
                          key={r.id} 
                          onClick={() => setSelectedHistoryRapportino(r)}
                          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer group shadow-xs hover:shadow-md ${
                            isAnnullato 
                              ? 'border-rose-200 bg-rose-50/20 hover:border-rose-400' 
                              : 'border-slate-200 hover:border-amber-500/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {/* Progressive Number Badge */}
                              <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-black shrink-0 ${
                                isAnnullato 
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                  : 'bg-amber-500/10 text-amber-700 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors'
                              }`}>
                                <span className="text-[8px] uppercase tracking-tighter leading-none">PROG</span>
                                <span className="text-xs leading-none mt-0.5">{r.numeroProgressivo ? `N°${r.numeroProgressivo}` : '—'}</span>
                              </div>

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={`text-xs font-bold leading-tight break-words line-clamp-1 ${isAnnullato ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                    {cName}
                                  </h4>
                                  {isAnnullato ? (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 shrink-0">
                                      <Ban className="w-2.5 h-2.5" /> Annullato
                                    </span>
                                  ) : r.isNonLavorato ? (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1 shrink-0">
                                      <Ban className="w-2.5 h-2.5" /> Non Lavorato
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Valido
                                    </span>
                                  )}
                                </div>

                                {/* Emission Date and Time */}
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-medium">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" /> {formatItalianDate(r.date)}
                                  </span>
                                  <span className="flex items-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                    <Clock className="w-3 h-3 text-amber-600" /> {r.ora || 'Orario N/D'}
                                  </span>
                                </div>

                                {r.sostituisceNumero && (
                                  <p className="text-[9px] font-bold text-amber-700 flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3" /> Sostituisce Rapportino N° {r.sostituisceNumero}
                                  </p>
                                )}

                                {isAnnullato && r.motivoAnnullamento && (
                                  <p className="text-[10px] text-rose-600 italic line-clamp-1">
                                    Motivo: "{r.motivoAnnullamento}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-center">
                              {r.foto && r.foto.length > 0 && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                                  <Camera className="w-3 h-3" /> {r.foto.length}
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 w-full max-w-full overflow-x-hidden"
            >
              {/* Breadcrumb / Back */}
              <button 
                onClick={() => setStep(selectedCantiere ? 'hub' : 'list')}
                className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {selectedCantiere ? `Torna al Cantiere` : 'Torna ai Cantieri'}
              </button>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-slate-950 p-5 sm:p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                      Nuovo Rapportino Giornaliero
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-mono font-black text-xs border border-amber-500/30">
                      Prog. N° {selectedCantiere ? getNextNumeroForCantiere(selectedCantiere.id) : '—'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">{selectedCantiere?.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatItalianDate(newRapportino.date) || 'Oggi'}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-amber-400 font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-500" /> Emissione ore {currentTime}
                    </span>
                  </div>

                  {newRapportino.sostituisceNumero && (
                    <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Rifacimento a sostituzione del <strong>Rapportino N° {newRapportino.sostituisceNumero}</strong> annullato</span>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6 space-y-6">
                  {/* Step Progress */}
                  <div className="flex items-center justify-between mb-4 w-full">
                    {[1, 2, 3].map((s, idx) => (
                      <div key={s} className="flex items-center flex-1 last:flex-initial">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          formStep >= s ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {s}
                        </div>
                        {idx < 2 && (
                          <div className={`flex-1 h-0.5 mx-2 rounded-full ${formStep > s ? 'bg-amber-500' : 'bg-slate-200'}`} />
                        )}
                      </div>
                    ))}
                  </div>

                  {formStep === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      {missingDateBannerText && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                          <p className="text-sm font-bold leading-tight">{missingDateBannerText}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-bold text-slate-900">Personale Impiegato</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">Seleziona i colleghi presenti in cantiere oggi e specifica le ore lavorate.</p>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm("Vuoi inviare questo rapportino come 'Non Lavorato'? L'invio sarà immediato e salterà i passaggi successivi.")) {
                              handleSubmit(true);
                            }
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-slate-200"
                        >
                          <Ban className="w-4 h-4" /> Segna come Non Lavorato
                        </button>
                      </div>

                      <div className="space-y-3">
                        {personale.map(p => {
                          const selected = newRapportino.personale?.find(item => item.personaleId === p.id);
                          return (
                            <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                              selected ? 'bg-amber-500/5 border-amber-500' : 'bg-slate-50 border-slate-100'
                            }`}>
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={!!selected} 
                                  onChange={() => handleTogglePersonale(p)}
                                  className="w-5 h-5 rounded-lg border-slate-300 text-amber-500 focus:ring-amber-500"
                                />
                                <span className={`text-sm font-bold ${selected ? 'text-slate-900' : 'text-slate-500'}`}>{p.name}</span>
                              </div>
                              {selected && (
                                <input 
                                  type="number" 
                                  value={selected.ore}
                                  onChange={(e) => handleUpdateOre(p.id, Number(e.target.value))}
                                  className="w-16 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {formStep === 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <h4 className="text-lg font-bold text-slate-900">Materiali & Mezzi</h4>
                      
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiali in Cantiere</p>
                            <button 
                              onClick={handleAddManualMateriale}
                              className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Aggiungi Manuale
                            </button>
                          </div>
                          {!selectedCantiere?.stock || selectedCantiere.stock.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic">Nessun materiale caricato in questo cantiere.</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedCantiere.stock.map(item => (
                                <button 
                                  key={item.materialeId}
                                  onClick={() => {
                                    const q = prompt(`Quantità di ${item.materialeName} (${item.unit}) utilizzata (Disponibile: ${item.quantity}):`);
                                    if (q) handleAddMaterialeFromStock(item.materialeId, Number(q));
                                  }}
                                  className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 text-left"
                                >
                                  <div>
                                    <p className="text-xs font-bold text-slate-900">{item.materialeName}</p>
                                    <p className="text-[10px] text-slate-500">Disp: {item.quantity} {item.unit}</p>
                                  </div>
                                  <Plus className="w-4 h-4 text-amber-500" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Mezzi Disponibili</p>
                          <div className="space-y-2">
                            {mezzi.map(m => (
                              <button 
                                key={m.id}
                                onClick={() => {
                                  const h = prompt(`Ore utilizzo per ${m.name}:`);
                                  if (h) handleAddMezzo(m.id, Number(h));
                                }}
                                className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 text-left"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{m.name}</p>
                                  <p className="text-[10px] text-slate-500">{m.plate}</p>
                                </div>
                                <Plus className="w-4 h-4 text-blue-500" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Summary List */}
                      {(newRapportino.materiali?.length || 0) + (newRapportino.mezzi?.length || 0) > 0 && (
                        <div className="space-y-2 mt-6">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Riepilogo Selezione</p>
                          {newRapportino.materiali?.map((m, i) => (
                            <div key={`mat-${i}`} className="flex items-center justify-between px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[10px] font-bold">
                              <span className="text-slate-900">{m.materialeName}</span>
                              <span className="text-amber-600">{m.quantity} {m.unit}</span>
                            </div>
                          ))}
                          {newRapportino.mezzi?.map((m, i) => (
                            <div key={`mez-${i}`} className="flex items-center justify-between px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-[10px] font-bold">
                              <span className="text-slate-900">{m.nome}</span>
                              <span className="text-blue-600">{m.ore} ore</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {formStep === 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <h4 className="text-lg font-bold text-slate-900">Note & Foto</h4>
                      <div className="space-y-4">
                        <textarea 
                          placeholder="Note di cantiere, imprevisti, avanzamento..."
                          value={newRapportino.note}
                          onChange={e => setNewRapportino({...newRapportino, note: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm min-h-[120px] outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documentazione Fotografica</p>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              {newRapportino.foto?.length || 0} / 4 foto
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2.5">
                            {newRapportino.foto?.map((f, i) => (
                              <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 relative group shadow-sm bg-slate-100">
                                <img 
                                  src={f} 
                                  alt={`Foto ${i + 1}`} 
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => setPreviewPhoto(f)}
                                />
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = [...(newRapportino.foto || [])];
                                    updated.splice(i, 1);
                                    setNewRapportino({...newRapportino, foto: updated});
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1.5 bg-slate-950/75 hover:bg-rose-600 text-white rounded-full shadow-md transition-colors"
                                  title="Elimina foto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold text-white bg-slate-950/60 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                                  #{i + 1}
                                </span>
                              </div>
                            ))}

                            {isCompressingPhoto && (
                              <div className="aspect-square rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 flex flex-col items-center justify-center text-amber-600 gap-2 animate-pulse">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="text-[9px] font-extrabold uppercase tracking-tight">Elaborazione...</span>
                              </div>
                            )}
                            
                            {(!newRapportino.foto || newRapportino.foto.length < 4) && !isCompressingPhoto && (
                              <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-500/5 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-amber-600 gap-1.5 transition-all cursor-pointer shadow-xs">
                                <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center">
                                  <Camera className="w-4 h-4 text-slate-700" />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider">Scatta Foto</span>
                                <span className="text-[8px] text-slate-400 font-medium">Istantanea</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment"
                                  onChange={handleFileChange}
                                  className="hidden" 
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-4 pt-8">
                    {formStep > 1 && (
                      <button 
                        onClick={() => setFormStep(prev => prev - 1)}
                        className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs hover:bg-slate-200 transition-colors"
                      >
                        Indietro
                      </button>
                    )}
                    {formStep < 3 ? (
                      <button 
                        onClick={() => setFormStep(prev => prev + 1)}
                        className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all"
                      >
                        Avanti
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSubmit(false)}
                        disabled={isSubmitting}
                        className="flex-1 bg-amber-500 text-slate-950 font-bold py-4 rounded-2xl text-xs shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>Inviando... <Loader2 className="w-4 h-4 animate-spin" /></>
                        ) : (
                          <>Invia Rapportino <Send className="w-4 h-4" /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Detail Modal for Past Rapportino */}
      <AnimatePresence>
        {selectedHistoryRapportino && (
          <div 
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedHistoryRapportino(null)}
          >
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-[32px] sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-slate-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md font-mono font-black text-[11px] bg-slate-950 text-amber-400">
                      Prog. N° {selectedHistoryRapportino.numeroProgressivo || '—'}
                    </span>
                    {selectedHistoryRapportino.status === 'annullato' ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <Ban className="w-3 h-3" /> Annullato
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Valido
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">
                    {cantieri.find(c => c.id === selectedHistoryRapportino.cantiereId)?.name || 'Cantiere'}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatItalianDate(selectedHistoryRapportino.date)}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> ore {selectedHistoryRapportino.ora || 'N/D'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Emesso da: <strong>{selectedHistoryRapportino.userName}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedHistoryRapportino(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner / Audit Box */}
              {selectedHistoryRapportino.status === 'annullato' ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Rapportino Annullato con Tracciabilità</span>
                  </div>
                  <p className="text-[11px] text-rose-800">
                    Annullato da <strong>{selectedHistoryRapportino.annullatoDa || 'Operatore'}</strong> il {selectedHistoryRapportino.annullatoIl || 'Data non disponibile'}
                  </p>
                  <div className="mt-1 bg-white/90 p-2.5 rounded-xl border border-rose-200 text-xs text-rose-900 font-mono">
                    <span className="font-bold">Motivazione:</span> {selectedHistoryRapportino.motivoAnnullamento || 'Nessuna motivazione specificata'}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Rapportino Valido e Registrato su Cloud</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md font-bold">
                    N° {selectedHistoryRapportino.numeroProgressivo || '—'}
                  </span>
                </div>
              )}

              {selectedHistoryRapportino.sostituisceNumero && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-900 font-medium">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Rifacimento a sostituzione del <strong>Rapportino N° {selectedHistoryRapportino.sostituisceNumero}</strong></span>
                </div>
              )}

              {/* Photos Section */}
              {selectedHistoryRapportino.foto && selectedHistoryRapportino.foto.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Foto Cantiere ({selectedHistoryRapportino.foto.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedHistoryRapportino.foto.map((f, i) => (
                      <div 
                        key={i} 
                        onClick={() => setPreviewPhoto(f)}
                        className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer group relative shadow-xs"
                      >
                        <img src={f} alt={`Foto ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white bg-slate-950/70 px-2 py-0.5 rounded-md">Ingrandisci</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Nessuna foto allegata a questo rapportino.
                </div>
              )}

              {/* Note */}
              {selectedHistoryRapportino.note && (
                <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note di Cantiere</p>
                  <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap">{selectedHistoryRapportino.note}</p>
                </div>
              )}

              {/* Personale */}
              {selectedHistoryRapportino.personale && selectedHistoryRapportino.personale.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personale Impiegato</p>
                  <div className="space-y-1.5">
                    {selectedHistoryRapportino.personale.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-800">{p.nome}</span>
                        <span className="font-bold text-amber-600">{p.ore} ore</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mezzi */}
              {selectedHistoryRapportino.mezzi && selectedHistoryRapportino.mezzi.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mezzi & Macchinari</p>
                  <div className="space-y-1.5">
                    {selectedHistoryRapportino.mezzi.map((m, i) => (
                      <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-800">{m.nome}</span>
                        <span className="font-bold text-blue-600">{m.ore} ore</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {/* Remake / Rifai Button */}
                <button 
                  onClick={() => handleRemakeRapportino(selectedHistoryRapportino)}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <RotateCcw className="w-4 h-4" /> Rifai / Sostituisci Questo Rapportino
                </button>

                {/* Cancel Button (if not already cancelled) */}
                {selectedHistoryRapportino.status !== 'annullato' && (
                  <button 
                    onClick={() => setCancelModalRapportino(selectedHistoryRapportino)}
                    className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Ban className="w-4 h-4" /> Annulla Rapportino (Lascia Traccia)
                  </button>
                )}

                <button 
                  onClick={() => setSelectedHistoryRapportino(null)}
                  className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl font-bold text-xs transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dedicated Cancellation Prompt Modal */}
      <AnimatePresence>
        {cancelModalRapportino && (
          <div 
            className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isCancelling && setCancelModalRapportino(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-rose-200"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Annulla Rapportino</h3>
                  <p className="text-xs text-slate-500">
                    Prog. N° {cancelModalRapportino.numeroProgressivo || '—'} • {cantieri.find(c => c.id === cancelModalRapportino.cantiereId)?.name}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50 rounded-2xl text-xs text-rose-800 space-y-1">
                <p className="font-bold">Attenzione: Tracciabilità Ufficiale</p>
                <p>
                  L'annullamento non cancella il documento ma lo marca come <strong>ANNULLATO</strong>, 
                  stornando automaticamente le ore e i costi associati al cantiere e registrando chi e quando ha effettuato l'annullamento.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Motivazione dell'Annullamento <span className="text-rose-600">*</span>
                </label>
                <textarea 
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Es: Errore ore operaio Rossi, inserito cantiere errato, ecc..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-rose-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  disabled={isCancelling}
                  onClick={() => {
                    setCancelModalRapportino(null);
                    setCancelReason('');
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Indietro
                </button>
                <button 
                  type="button"
                  disabled={isCancelling || !cancelReason.trim()}
                  onClick={handleConfirmCancel}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-colors disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>Annullando... <Loader2 className="w-4 h-4 animate-spin" /></>
                  ) : (
                    <>Conferma Annulla <Ban className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox for instant high-res photo viewing */}
      <PhotoLightbox 
        photoUrl={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        title="Foto Cantiere"
        subtitle={selectedCantiere?.name || 'Rapportino Giornaliero'}
      />

      {/* Riconoscimento Ferri Modal on Mobile */}
      {showMobileFerriModal && (
        <RiconoscimentoFerriModal
          isOpen={showMobileFerriModal}
          onClose={() => setShowMobileFerriModal(false)}
          cantieri={cantieri}
          currentUser={currentUser}
          defaultCantiereId={selectedCantiere?.id || cantieri[0]?.id}
          onSaveDocument={onSaveDocument}
          onAddMateriale={onAddMateriale}
        />
      )}
    </div>
  );
};
