import React, { useState, useRef, useEffect } from 'react';
import { 
  Cantiere, Personale, Mezzo, Rapportino, StockMovement, MaterialDocument, 
  UserAccount, Company, CantiereChatMessage, CantiereDocumentoTecnico, TechnicalDocCategory 
} from '../types';
import { 
  Building2, HardHat, FileText, Box, MessageSquare, FolderArchive, ArrowLeft,
  Calendar, Clock, User, Phone, CheckCircle2, AlertCircle, Plus, Send, Mic, 
  Square, Play, Pause, Trash2, Download, Eye, File, UploadCloud, MapPin, 
  DollarSign, ReceiptText, ChevronRight, X, AlertTriangle, Sparkles, Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const formatItalianDate = (isoString?: string) => {
  if (!isoString) return '';
  const parts = isoString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoString;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const categoryLabels: Record<TechnicalDocCategory, { label: string; color: string }> = {
  planimetria: { label: 'Planimetria & Progetto', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  computo: { label: 'Computo Metrico', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  relazione: { label: 'Relazione Tecnica', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  sicurezza: { label: 'Sicurezza (PSC/POS)', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  foto_tecnica: { label: 'Rilievo & Foto Tecnica', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  scheda_materiale: { label: 'Scheda Tecnica Materiali', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  certificato: { label: 'Permessi & Certificati', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  altro: { label: 'Altro Documento', color: 'bg-slate-100 text-slate-800 border-slate-200' },
};

interface CantiereHubProps {
  cantiere: Cantiere;
  currentUser: UserAccount;
  company: Company | null;
  cantieri: Cantiere[];
  personale: Personale[];
  mezzi: Mezzo[];
  rapportini: Rapportino[];
  movements: StockMovement[];
  documents: MaterialDocument[];
  chatMessages: CantiereChatMessage[];
  technicalDocs: CantiereDocumentoTecnico[];
  onSendMessage: (msg: CantiereChatMessage) => Promise<void>;
  onSaveTechnicalDoc: (doc: CantiereDocumentoTecnico) => Promise<void>;
  onDeleteTechnicalDoc: (docId: string) => Promise<void>;
  onOpenRapportinoDetail: (r: Rapportino) => void;
  onCreateRapportinoForCantiere?: (cantiere: Cantiere) => void;
  onClose: () => void;
  onOpenPhotoLightbox?: (photoUrl: string) => void;
  initialTab?: 'materiali' | 'rapportini' | 'personale' | 'chat' | 'archivio';
}

export const CantiereHub: React.FC<CantiereHubProps> = ({
  cantiere,
  currentUser,
  company,
  cantieri,
  personale,
  mezzi,
  rapportini,
  movements,
  documents,
  chatMessages,
  technicalDocs,
  onSendMessage,
  onSaveTechnicalDoc,
  onDeleteTechnicalDoc,
  onOpenRapportinoDetail,
  onCreateRapportinoForCantiere,
  onClose,
  onOpenPhotoLightbox,
  initialTab = 'materiali',
}) => {
  const isReadOnly = currentUser.role === 'dirigente' || currentUser.permissions?.canEdit === false;

  const [activeTab, setActiveTab] = useState<'materiali' | 'rapportini' | 'personale' | 'chat' | 'archivio'>(initialTab);

  // Chat State
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Audio Playback state for voice messages
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<string | null>(null);
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Archive Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<string>('all');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadCategory, setUploadCategory] = useState<TechnicalDocCategory>('planimetria');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Material view sub-filter
  const [materialFilter, setMaterialFilter] = useState<'tutti' | 'bolle' | 'giacenza' | 'usati'>('tutti');

  // Filter cantiere-specific data
  const cantiereRapportini = rapportini
    .filter(r => r.cantiereId === cantiere.id)
    .sort((a, b) => {
      const dateA = `${a.date}T${a.ora || '00:00:00'}`;
      const dateB = `${b.date}T${b.ora || '00:00:00'}`;
      return dateB.localeCompare(dateA);
    });

  const cantiereChat = chatMessages
    .filter(m => m.cantiereId === cantiere.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const cantiereDocs = technicalDocs
    .filter(d => d.cantiereId === cantiere.id)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  // Auto-scroll chat to bottom when new messages arrive or tab changes to chat
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeTab, cantiereChat.length]);

  // Clean up audio & recorder on unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
    };
  }, []);

  // ----------------------------------------------------
  // PERSONALE AGGREGATION LOGIC
  // ----------------------------------------------------
  // Aggregate all personnel that worked on this cantiere across valid rapportini
  const validRapportini = cantiereRapportini.filter(r => r.status !== 'annullato' && !r.isNonLavorato);
  
  const personnelMap = new Map<string, {
    id: string;
    nome: string;
    role: string;
    oreTotali: number;
    giornate: Set<string>;
    hourlyRate: number;
    phone: string;
  }>();

  validRapportini.forEach(rap => {
    // 1. Check personnelHours & personale list
    (rap.personale || []).forEach(p => {
      const pId = p.personaleId || p.nome;
      const matchedPersonale = personale.find(per => per.id === p.personaleId || per.name.toLowerCase() === p.nome.toLowerCase());
      const ore = Number(p.ore) || (rap.personnelHours.find(ph => ph.personnelId === p.personaleId)?.hours || 0);

      const existing = personnelMap.get(pId) || {
        id: pId,
        nome: matchedPersonale?.name || p.nome,
        role: matchedPersonale?.role || 'Operaio',
        oreTotali: 0,
        giornate: new Set<string>(),
        hourlyRate: matchedPersonale?.hourlyRate || 25,
        phone: matchedPersonale?.phone || '',
      };

      existing.oreTotali += ore;
      existing.giornate.add(rap.date);
      personnelMap.set(pId, existing);
    });

    // Fallback for personnelHours entries without matching rap.personale item
    (rap.personnelHours || []).forEach(ph => {
      const matchedPersonale = personale.find(per => per.id === ph.personnelId);
      if (matchedPersonale && !personnelMap.has(matchedPersonale.id)) {
        personnelMap.set(matchedPersonale.id, {
          id: matchedPersonale.id,
          nome: matchedPersonale.name,
          role: matchedPersonale.role,
          oreTotali: ph.hours || 0,
          giornate: new Set<string>([rap.date]),
          hourlyRate: matchedPersonale.hourlyRate || 25,
          phone: matchedPersonale.phone || '',
        });
      }
    });
  });

  const cantierePersonnelList = Array.from(personnelMap.values()).sort((a, b) => b.oreTotali - a.oreTotali);
  const totalCantiereOre = cantierePersonnelList.reduce((acc, p) => acc + p.oreTotali, 0);
  const totalCantiereCostoPersonale = cantierePersonnelList.reduce((acc, p) => acc + (p.oreTotali * p.hourlyRate), 0);

  // ----------------------------------------------------
  // MATERIALI AGGREGATION LOGIC
  // ----------------------------------------------------
  // 1. Bolle / Forniture destinate a questo cantiere
  const cantiereBolle = documents.filter(d => 
    d.destinationCantiereId === cantiere.id || 
    d.items.some(i => i.destinationCantiereId === cantiere.id)
  );

  // 2. Materiali impiegati nei rapportini di questo cantiere
  const usedMaterialsMap = new Map<string, { name: string; quantity: number; unit: string; count: number }>();
  validRapportini.forEach(rap => {
    (rap.materiali || []).forEach(m => {
      const key = (m.materialeName || m.materialeId).toLowerCase();
      const current = usedMaterialsMap.get(key) || { name: m.materialeName, quantity: 0, unit: m.unit || 'pz', count: 0 };
      current.quantity += Number(m.quantity) || 0;
      current.count += 1;
      usedMaterialsMap.set(key, current);
    });
  });
  const cantiereMaterialiUsati = Array.from(usedMaterialsMap.values());

  // 3. Giacenza attuale
  const cantiereStock = cantiere.stock || [];
  const totalStockValore = cantiereStock.reduce((acc, s) => acc + (s.totalCost || 0), 0);

  // ----------------------------------------------------
  // CHAT AUDIO VOICE RECORDING HANDLERS
  // ----------------------------------------------------
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (base64Audio) {
            const voiceMsg: CantiereChatMessage = {
              id: 'chat-voice-' + Date.now(),
              cantiereId: cantiere.id,
              senderId: currentUser.id,
              senderName: currentUser.name,
              senderRole: currentUser.role,
              createdAt: new Date().toISOString(),
              type: 'voice',
              audioUrl: base64Audio,
              audioDurationSeconds: recordDuration || 1,
            };
            try {
              await onSendMessage(voiceMsg);
            } catch (err) {
              console.error('Error sending voice message:', err);
              alert('Errore nell\'invio del messaggio vocale.');
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(200);
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or unsupported:', err);
      alert('Impossibile accedere al microfono. Assicurati di aver concesso i permessi audio al browser per registrare messaggi vocali.');
    }
  };

  const handleStopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordDuration(0);
    }
  };

  const handleSendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const textMsg: CantiereChatMessage = {
      id: 'chat-txt-' + Date.now(),
      cantiereId: cantiere.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      createdAt: new Date().toISOString(),
      type: 'text',
      text: inputText.trim(),
    };

    try {
      await onSendMessage(textMsg);
      setInputText('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Errore nell\'invio del messaggio.');
    } finally {
      setIsSending(false);
    }
  };

  const togglePlayAudio = (msgId: string, audioUrl?: string) => {
    if (!audioUrl) return;

    if (currentlyPlayingAudio === msgId) {
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
      setCurrentlyPlayingAudio(null);
    } else {
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      activeAudioElementRef.current = audio;
      setCurrentlyPlayingAudio(msgId);

      audio.onended = () => {
        setCurrentlyPlayingAudio(null);
      };
      audio.onerror = () => {
        setCurrentlyPlayingAudio(null);
        alert('Impossibile riprodurre la nota vocale.');
      };
      audio.play().catch(err => {
        console.error('Audio play error:', err);
        setCurrentlyPlayingAudio(null);
      });
    }
  };

  // ----------------------------------------------------
  // ARCHIVIO TECNICO UPLOAD HANDLER
  // ----------------------------------------------------
  const handleUploadTechnicalDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadDocName.trim() || isUploading) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileDataUrl = reader.result as string;
        const newDoc: CantiereDocumentoTecnico = {
          id: 'tech-doc-' + Date.now(),
          cantiereId: cantiere.id,
          name: uploadDocName.trim(),
          category: uploadCategory,
          fileName: uploadFile.name,
          fileUrl: fileDataUrl,
          fileType: uploadFile.type || uploadFile.name.split('.').pop() || 'file',
          fileSize: uploadFile.size,
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString(),
          notes: uploadNotes.trim() || undefined,
        };

        await onSaveTechnicalDoc(newDoc);
        setShowUploadModal(false);
        setUploadDocName('');
        setUploadNotes('');
        setUploadFile(null);
        alert('Documento tecnico salvato nell\'archivio di cantiere.');
      };
      reader.readAsDataURL(uploadFile);
    } catch (err) {
      console.error('Error saving technical doc:', err);
      alert('Errore nel salvataggio del documento.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredArchiveDocs = cantiereDocs.filter(d => {
    if (archiveFilter === 'all') return true;
    return d.category === archiveFilter;
  });

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-slate-50 flex flex-col pb-24">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl transition-all shrink-0"
              title="Torna all'elenco cantieri"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-black text-white truncate">{cantiere.name}</h1>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                  cantiere.status === 'in_corso' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {cantiere.status === 'in_corso' ? 'In Corso' : cantiere.status}
                </span>
                {isReadOnly && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-amber-400" /> Sola Lettura
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{cantiere.address}</span>
              </p>
            </div>
          </div>

          {/* New Rapportino Quick Button (visible on top bar if not read-only) */}
          {!isReadOnly && onCreateRapportinoForCantiere && (
            <button
              onClick={() => onCreateRapportinoForCantiere(cantiere)}
              className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shrink-0 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Nuovo</span> Rapportino
            </button>
          )}
        </div>

        {/* 5 Distinct Navigation Tabs (Optimized for Mobile, 0 Horizontal Overflow) */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 bg-slate-950/60 border-t border-slate-800/80">
          <nav className="grid grid-cols-5 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            {[
              { key: 'materiali', label: 'Materiali', icon: Box },
              { key: 'rapportini', label: 'Rapportini', icon: FileText, badge: cantiereRapportini.length },
              { key: 'personale', label: 'Personale', icon: HardHat, badge: cantierePersonnelList.length },
              { key: 'chat', label: 'Chat', icon: MessageSquare, badge: cantiereChat.length },
              { key: 'archivio', label: 'Archivio', icon: FolderArchive, badge: cantiereDocs.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-3 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all border-b-2 ${
                    isActive 
                      ? 'border-amber-500 text-amber-400 bg-amber-500/10' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area - Strictly Vertical Scrolling, Zero Horizontal Spill */}
      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-5 flex-1 overflow-x-hidden space-y-6">

        {/* ==================================================== */}
        {/* 1. SEZIONE MATERIALI                                 */}
        {/* ==================================================== */}
        {activeTab === 'materiali' && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6 w-full max-w-full"
          >
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giacenza Cantiere</p>
                <p className="text-xl font-black text-slate-900 mt-1">{cantiereStock.length} Voci</p>
                <p className="text-[11px] font-bold text-amber-600 mt-0.5">Valore: €{totalStockValore.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bolle Consegnate</p>
                <p className="text-xl font-black text-slate-900 mt-1">{cantiereBolle.length} Documenti</p>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">Forniture arrivate</p>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiali Impiegati</p>
                <p className="text-xl font-black text-emerald-600 mt-1">{cantiereMaterialiUsati.length} Tipologie</p>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">Da rapportini validi</p>
              </div>
            </div>

            {/* Filter Toggle */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: 'tutti', label: 'Tutti i Materiali' },
                { id: 'bolle', label: `Bolle Fornitori (${cantiereBolle.length})` },
                { id: 'giacenza', label: `Giacenza Attuale (${cantiereStock.length})` },
                { id: 'usati', label: `Impiegati nei Rapportini (${cantiereMaterialiUsati.length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setMaterialFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    materialFilter === f.id
                      ? 'bg-slate-950 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 1. Bolle Fornitori assegnate */}
            {(materialFilter === 'tutti' || materialFilter === 'bolle') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <ReceiptText className="w-4 h-4 text-amber-500" />
                    Bolle & Forniture Assegnate al Cantiere
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{cantiereBolle.length} bolle</span>
                </div>

                {cantiereBolle.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                    Nessuna bolla o fornitura registrata direttamente per questo cantiere.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cantiereBolle.map(doc => {
                      const cantiereItems = doc.items.filter(i => 
                        i.destinationCantiereId === cantiere.id || doc.destinationCantiereId === cantiere.id
                      );
                      const totalDocNet = cantiereItems.reduce((acc, i) => {
                        const q = Number(i.quantity) || 1;
                        const u = Number(i.unitPrice) || 0;
                        let t = Number(i.totalPrice) || 0;
                        let d = i.discount ? String(i.discount).trim() : '';
                        let dPct = 0;
                        if (d) {
                          const m = d.match(/([0-9]+(?:[.,][0-9]+)?)/);
                          if (m) dPct = parseFloat(m[1].replace(',', '.'));
                        }
                        if ((t === 0 || (q > 1 && Math.abs(t - u) < 0.01)) && u > 0) {
                          const gross = q * u;
                          t = dPct > 0 ? parseFloat((gross * (1 - dPct / 100)).toFixed(2)) : parseFloat(gross.toFixed(2));
                        }
                        return acc + t;
                      }, 0);

                      return (
                        <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                  {doc.type.toUpperCase()} N. {doc.number}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500">{formatItalianDate(doc.date)}</span>
                              </div>
                              <h4 className="text-sm font-black text-slate-900 mt-1">{doc.supplier}</h4>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900">€{totalDocNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                              <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1 ${
                                doc.status === 'accettata' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {doc.status === 'accettata' ? 'Accettata' : 'In attesa'}
                              </span>
                            </div>
                          </div>

                          {/* Items breakdown */}
                          <div className="border-t border-slate-100 pt-2 space-y-1.5">
                            {cantiereItems.map((item, idx) => {
                              const q = Number(item.quantity) || 1;
                              const u = Number(item.unitPrice) || 0;
                              let t = Number(item.totalPrice) || 0;
                              let d = item.discount ? String(item.discount).trim() : '';
                              let dPct = 0;
                              if (d) {
                                const m = d.match(/([0-9]+(?:[.,][0-9]+)?)/);
                                if (m) dPct = parseFloat(m[1].replace(',', '.'));
                              }
                              if ((t === 0 || (q > 1 && Math.abs(t - u) < 0.01)) && u > 0) {
                                const gross = q * u;
                                t = dPct > 0 ? parseFloat((gross * (1 - dPct / 100)).toFixed(2)) : parseFloat(gross.toFixed(2));
                              }

                              return (
                                <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50">
                                  <div className="min-w-0 pr-2">
                                    <p className="font-bold text-slate-800 truncate">{item.materialeName}</p>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                                      <span>{item.quantity} {item.unit}</span>
                                      <span>•</span>
                                      <span>€{u > 0 ? u.toFixed(2) : '0.00'}/u</span>
                                      {d && (
                                        <span className="font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                                          Sc. {d.includes('%') ? d : `${d}%`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-black text-slate-900 shrink-0">€{t.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* 2. Giacenza attuale in cantiere */}
            {(materialFilter === 'tutti' || materialFilter === 'giacenza') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-emerald-500" />
                    Giacenza Disponibile in Cantiere
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{cantiereStock.length} materiali</span>
                </div>

                {cantiereStock.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                    Nessun materiale attualmente in giacenza per questo cantiere.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cantiereStock.map((s, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{s.materialeName}</h4>
                          <p className="text-[10px] text-slate-400 font-medium">Valore giacenza: €{(s.totalCost || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-emerald-600">{s.quantity} {s.unit}</p>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Residuo</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 3. Materiali impiegati nei rapportini */}
            {(materialFilter === 'tutti' || materialFilter === 'usati') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                    Materiali Impiegati nei Lavori
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{cantiereMaterialiUsati.length} voci</span>
                </div>

                {cantiereMaterialiUsati.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                    Nessun materiale ancora segnalato come impiegato nei rapportini di questo cantiere.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cantiereMaterialiUsati.map((mu, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{mu.name}</h4>
                          <p className="text-[10px] text-slate-400 font-medium">Utilizzato in {mu.count} rapportin{mu.count === 1 ? 'o' : 'i'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-slate-900">{mu.quantity} {mu.unit}</p>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Consumato</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </motion.div>
        )}

        {/* ==================================================== */}
        {/* 2. SEZIONE RAPPORTINI                                */}
        {/* ==================================================== */}
        {activeTab === 'rapportini' && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-5 w-full max-w-full"
          >
            {/* Action Banner */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Archivio Lavorazioni Cantiere</p>
                <h3 className="text-xl font-black text-white mt-0.5">{cantiereRapportini.length} Rapportini Emessi</h3>
                <p className="text-xs text-slate-400 mt-1">Tracciabilità completa di ore, maestranze e lavorazioni.</p>
              </div>
              {onCreateRapportinoForCantiere && (
                <button
                  onClick={() => onCreateRapportinoForCantiere(cantiere)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Compila Nuovo Rapportino
                </button>
              )}
            </div>

            {/* List of Rapportini */}
            {cantiereRapportini.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-3">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-base font-bold text-slate-800">Nessun rapportino inviato per questo cantiere</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Inizia a compilare i rapportini giornalieri per monitorare ore di lavoro, operai e materiali utilizzati.
                </p>
                {onCreateRapportinoForCantiere && (
                  <button
                    onClick={() => onCreateRapportinoForCantiere(cantiere)}
                    className="mt-2 bg-slate-950 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider"
                  >
                    Compila il Primo Rapportino
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {cantiereRapportini.map(r => {
                  const oreTotaliRapportino = (r.personale || []).reduce((acc, p) => acc + (Number(p.ore) || 0), 0);
                  const isAnnullato = r.status === 'annullato';
                  const isNonLav = r.isNonLavorato;

                  return (
                    <div 
                      key={r.id} 
                      className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-xs transition-all space-y-3 ${
                        isAnnullato ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-slate-950 text-amber-400 font-mono font-black text-xs px-2.5 py-0.5 rounded-lg">
                              N° {r.numeroProgressivo || '—'}
                            </span>
                            {isAnnullato ? (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                                Annullato
                              </span>
                            ) : isNonLav ? (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
                                Non Lavorato
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Valido
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-700">{formatItalianDate(r.date)}</span>
                            {r.ora && <span className="text-[11px] font-mono text-slate-400">ore {r.ora}</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Emesso da: <strong className="text-slate-800">{r.userName}</strong>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <button
                            onClick={() => onOpenRapportinoDetail(r)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <span>Dettagli</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content summary */}
                      {!isNonLav && !isAnnullato && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Ore Lavoro:</span>
                            <p className="font-black text-slate-900">{oreTotaliRapportino} h</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Operai:</span>
                            <p className="font-bold text-slate-800">{(r.personale || []).length} presenti</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Materiali:</span>
                            <p className="font-bold text-slate-800">{(r.materiali || []).length} usati</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Foto:</span>
                            <p className="font-bold text-slate-800">{(r.foto || []).length} allegate</p>
                          </div>
                        </div>
                      )}

                      {/* Notes snippet */}
                      {r.note && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl italic line-clamp-2">
                          "{r.note}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ==================================================== */}
        {/* 3. SEZIONE PERSONALE                                 */}
        {/* ==================================================== */}
        {activeTab === 'personale' && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6 w-full max-w-full"
          >
            {/* Aggregated KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maestranze Totali</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{cantierePersonnelList.length} Operatori</p>
                <p className="text-xs text-slate-500 mt-0.5">Hanno lavorato in questo cantiere</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ore Lavorate Totali</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{totalCantiereOre} h</p>
                <p className="text-xs text-slate-500 mt-0.5">Somma ore da tutti i rapportini validi</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Costo Manodopera</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">€{totalCantiereCostoPersonale.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-500 mt-0.5">Calcolato su tariffa oraria aziendale</p>
              </div>
            </div>

            {/* List of Personnel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <HardHat className="w-4 h-4 text-amber-500" />
                  Elenco Personale e Ore Effettuate
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{cantierePersonnelList.length} persone</span>
              </div>

              {cantierePersonnelList.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                  <HardHat className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Nessun dato sul personale registrato</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Le ore e il personale verranno calcolati automaticamente all'invio dei primi rapportini giornalieri per questo cantiere.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cantierePersonnelList.map(p => {
                    const costoTotalePersona = p.oreTotali * p.hourlyRate;
                    const giornateCount = p.giornate.size;

                    return (
                      <div key={p.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-slate-900 text-amber-400 font-black text-base flex items-center justify-center shrink-0">
                              {p.nome.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-slate-900 truncate">{p.nome}</h4>
                              <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 mt-0.5">
                                {p.role}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-base sm:text-lg font-black text-slate-900">{p.oreTotali} ore</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{giornateCount} giornat{giornateCount === 1 ? 'a' : 'e'}</p>
                          </div>
                        </div>

                        {/* Breakdown bar */}
                        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-600">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Costo Orario: </span>
                            <span className="font-bold text-slate-800">€{p.hourlyRate}/h</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Totale Maturato: </span>
                            <span className="font-black text-emerald-600">€{costoTotalePersona.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          {p.phone && (
                            <a 
                              href={`tel:${p.phone}`} 
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg"
                            >
                              <Phone className="w-3 h-3" />
                              <span className="hidden sm:inline">{p.phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================================================== */}
        {/* 4. SEZIONE CHAT DI CANTIERE (TESTO + VOCALE)         */}
        {/* ==================================================== */}
        {activeTab === 'chat' && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col h-[calc(100vh-220px)] min-h-[480px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* Chat Room Header */}
            <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Chat Operativa Cantiere</h3>
                  <p className="text-[10px] text-slate-400">Messaggi di testo e note vocali in tempo reale</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                {cantiereChat.length} messaggi
              </span>
            </div>

            {/* Chat Messages Feed */}
            <div 
              ref={chatScrollRef} 
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50"
            >
              {cantiereChat.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-300 mb-1" />
                  <p className="text-sm font-bold text-slate-700">Nessun messaggio in questa chat di cantiere</p>
                  <p className="text-xs max-w-xs text-slate-500">
                    Scrivi un messaggio di testo o registra una nota vocale dal microfono per coordinarti con la squadra e l'amministrazione.
                  </p>
                </div>
              ) : (
                cantiereChat.map(msg => {
                  const isMe = msg.senderId === currentUser.id;
                  const isVoice = msg.type === 'voice';
                  const isPlaying = currentlyPlayingAudio === msg.id;

                  const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
                  const dateStr = msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-medium">
                        <span className="font-bold text-slate-700">{msg.senderName}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-bold">
                          {msg.senderRole}
                        </span>
                        <span>• {dateStr} {timeStr}</span>
                      </div>

                      {/* Bubble */}
                      <div className={`max-w-[85%] sm:max-w-md p-3.5 rounded-2xl shadow-xs ${
                        isMe 
                          ? 'bg-slate-900 text-white rounded-tr-xs' 
                          : 'bg-white text-slate-900 border border-slate-200 rounded-tl-xs'
                      }`}>
                        {isVoice ? (
                          // Voice Message Player
                          <div className="flex items-center gap-3 min-w-[200px] sm:min-w-[240px]">
                            <button
                              type="button"
                              onClick={() => togglePlayAudio(msg.id, msg.audioUrl)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                                isMe ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-white'
                              }`}
                            >
                              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <span className={isMe ? 'text-amber-400 font-bold' : 'text-slate-700 font-bold'}>
                                  {isPlaying ? 'Riproduzione...' : 'Nota Vocale'}
                                </span>
                                <span className={isMe ? 'text-slate-300' : 'text-slate-500'}>
                                  {msg.audioDurationSeconds ? `${msg.audioDurationSeconds}s` : ''}
                                </span>
                              </div>

                              {/* Progress bar visualizer */}
                              <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                                isMe ? 'bg-slate-700' : 'bg-slate-200'
                              }`}>
                                <div className={`h-full ${isPlaying ? 'bg-amber-500 animate-pulse w-full' : 'w-1/3 bg-slate-400'}`} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Text Message
                          <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {msg.text}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Voice Recording Overlay / Standard Input Bar */}
            <div className="p-3 bg-white border-t border-slate-200">
              {isRecording ? (
                // Active Voice Recording Bar
                <div className="flex items-center justify-between gap-3 bg-rose-50 border border-rose-200 p-3 rounded-2xl animate-pulse">
                  <div className="flex items-center gap-2 text-rose-600">
                    <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider">Registrazione vocale in corso...</span>
                    <span className="font-mono text-sm font-black ml-1">{recordDuration}s</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelRecording}
                      className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-100 rounded-xl transition-colors"
                      title="Annulla registrazione"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleStopAndSendRecording}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Invia Vocale</span>
                    </button>
                  </div>
                </div>
              ) : isReadOnly ? (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs font-medium text-amber-300 flex items-center justify-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Account Dirigente (Sola Lettura): puoi consultare chat e foto di cantiere.</span>
                </div>
              ) : (
                // Text & Mic Input Bar
                <form onSubmit={handleSendTextMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="Scrivi un messaggio di cantiere..."
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500/40 transition-all text-slate-900"
                  />

                  {inputText.trim() ? (
                    <button
                      type="submit"
                      disabled={isSending}
                      className="p-3 bg-slate-950 text-white hover:bg-slate-800 active:scale-95 rounded-2xl transition-all shrink-0 shadow-md"
                      title="Invia messaggio"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="p-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-2xl transition-all shrink-0 shadow-md flex items-center gap-1.5 text-xs"
                      title="Tocca per registrare una nota vocale"
                    >
                      <Mic className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Vocale</span>
                    </button>
                  )}
                </form>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================================================== */}
        {/* 5. SEZIONE ARCHIVIO TECNICO                          */}
        {/* ==================================================== */}
        {activeTab === 'archivio' && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6 w-full max-w-full"
          >
            {/* Header & Upload Button */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Archivio Tecnico del Cantiere</p>
                <h3 className="text-xl font-black text-white mt-0.5">{cantiereDocs.length} Documenti Archiviati</h3>
                <p className="text-xs text-slate-400 mt-1">Planimetrie, computi, relazioni tecniche, PSC e schede materiali.</p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                  Carica Documento Tecnico
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setArchiveFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  archiveFilter === 'all'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tutti ({cantiereDocs.length})
              </button>
              {(Object.keys(categoryLabels) as TechnicalDocCategory[]).map(catKey => {
                const count = cantiereDocs.filter(d => d.category === catKey).length;
                if (count === 0 && archiveFilter !== catKey) return null;

                return (
                  <button
                    key={catKey}
                    onClick={() => setArchiveFilter(catKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      archiveFilter === catKey
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {categoryLabels[catKey].label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Documents List */}
            {filteredArchiveDocs.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-3">
                <FolderArchive className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-base font-bold text-slate-800">Nessun documento tecnico archiviato</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Carica progetti in PDF, planimetrie, computi metrici o schede tecniche da consultare rapidamente da smartphone e cantiere.
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-2 bg-slate-950 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider"
                >
                  Carica Ora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredArchiveDocs.map(doc => {
                  const catInfo = categoryLabels[doc.category] || categoryLabels.altro;
                  const isImage = doc.fileType.startsWith('image/') || doc.fileName.match(/\.(jpg|jpeg|png|webp)$/i);

                  return (
                    <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${catInfo.color}`}>
                            {catInfo.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {formatItalianDate(doc.uploadedAt?.split('T')[0])}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-slate-900 mt-2 line-clamp-1">{doc.name}</h4>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{doc.fileName} {doc.fileSize ? `(${formatFileSize(doc.fileSize)})` : ''}</p>

                        {doc.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mt-2 italic line-clamp-2">
                            "{doc.notes}"
                          </p>
                        )}
                      </div>

                      {/* Image Thumbnail Preview if available */}
                      {isImage && doc.fileUrl && (
                        <div 
                          className="h-28 w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative group cursor-pointer"
                          onClick={() => onOpenPhotoLightbox ? onOpenPhotoLightbox(doc.fileUrl) : window.open(doc.fileUrl, '_blank')}
                        >
                          <img src={doc.fileUrl} alt={doc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                            Ingrandisci
                          </div>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          Caricato da: {doc.uploadedBy}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={doc.fileUrl}
                            download={doc.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 rounded-xl transition-colors"
                            title="Visualizza / Scarica"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {(currentUser.role === 'admin' || doc.uploadedBy === currentUser.name) && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Sei sicuro di voler eliminare "${doc.name}" dall'archivio tecnico?`)) {
                                  await onDeleteTechnicalDoc(doc.id);
                                }
                              }}
                              className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                              title="Elimina documento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

      </main>

      {/* Upload Technical Document Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 overflow-y-auto max-h-[90vh] space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Carica Documento Tecnico</h3>
                    <p className="text-[10px] text-slate-400">{cantiere.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadTechnicalDoc} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Titolo Documento *
                  </label>
                  <input
                    type="text"
                    value={uploadDocName}
                    onChange={e => setUploadDocName(e.target.value)}
                    placeholder="es. Planimetria Piano Terra Variante 2"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Categoria Tecnica *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={e => setUploadCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none font-bold"
                  >
                    {(Object.keys(categoryLabels) as TechnicalDocCategory[]).map(catKey => (
                      <option key={catKey} value={catKey}>
                        {categoryLabels[catKey].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Seleziona File (PDF, Foto, Documento) *
                  </label>
                  <input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setUploadFile(file);
                        if (!uploadDocName) {
                          setUploadDocName(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    required
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-950 file:text-white hover:file:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Note / Descrizione Aggiuntiva (Opzionale)
                  </label>
                  <textarea
                    value={uploadNotes}
                    onChange={e => setUploadNotes(e.target.value)}
                    placeholder="Dettagli sul rilievo, autore del disegno, revisione..."
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 rounded-xl font-bold transition-all"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !uploadFile || !uploadDocName.trim()}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 py-3 rounded-xl font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-md"
                  >
                    {isUploading ? 'Caricamento...' : 'Salva nell\'Archivio'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
