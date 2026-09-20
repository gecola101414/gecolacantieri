import React, { useState, useRef, useEffect } from 'react';
import { 
  Cantiere, Personale, Mezzo, Rapportino, StockMovement, MaterialDocument, 
  UserAccount, Company, CantiereChatMessage, CantiereDocumentoTecnico, TechnicalDocCategory,
  MaterialRequest, MaterialRequestStatus, Materiale, StockItem
} from '../types';
import { 
  Building2, HardHat, FileText, Box, MessageSquare, FolderArchive, ArrowLeft,
  Calendar, Clock, User, Phone, CheckCircle2, AlertCircle, Plus, Send, Mic, 
  Square, Play, Pause, Trash2, Download, Eye, File, UploadCloud, MapPin, 
  DollarSign, ReceiptText, ChevronRight, X, AlertTriangle, Sparkles, Volume2,
  PackageCheck, ShoppingBag, Check, Layers, ShoppingCart, Maximize2, Minus, History, Undo2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialRequestManager } from './MaterialRequestManager';

export interface ExtendedStockItem extends StockItem {
  caricoValore?: number;
  unitPrice?: number;
  valoreResiduo?: number;
}

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
  materialRequests?: MaterialRequest[];
  onSaveMaterialRequest?: (r: MaterialRequest) => Promise<void>;
  onUpdateMaterialRequestStatus?: (rid: string, status: MaterialRequestStatus) => Promise<void>;
  materialiArchive?: Materiale[];
  onAcceptDocument?: (docId: string) => Promise<void>;
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
  materialRequests = [],
  onSaveMaterialRequest = async (_r: MaterialRequest) => {},
  onUpdateMaterialRequestStatus = async (_rid: string, _status: MaterialRequestStatus) => {},
  materialiArchive = [],
  onAcceptDocument = async (_docId: string) => {},
}) => {
  const isReadOnly = currentUser.role === 'dirigente' || currentUser.permissions?.canEdit === false;
  const canUploadDocs = !isReadOnly && currentUser.permissions?.documentale !== false && currentUser.role !== 'lavoratore';
  const canCreateRapportini = !isReadOnly && currentUser.permissions?.rapportini !== false && currentUser.role !== 'lavoratore';

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
  const [materialFilter, setMaterialFilter] = useState<'tutti' | 'bolle' | 'giacenza' | 'usati' | 'richieste'>('giacenza');

  // Ordering workflow state
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderItems, setOrderItems] = useState<Map<string, number>>(new Map()); // materialeId -> quantity
  const [orderNotes, setOrderNotes] = useState('');
  const [manualItems, setManualItems] = useState<StockItem[]>([]);

  // Scheda Prodotto / Materiale Detail Modal
  const [selectedMaterialCard, setSelectedMaterialCard] = useState<ExtendedStockItem | null>(null);
  const [materialCardOrderQty, setMaterialCardOrderQty] = useState<number>(1);

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
  // 1. Bolle / Forniture destinate a questo cantiere (ordinate dalla più recente in alto)
  const cantiereBolle = documents
    .filter(d => 
      d.destinationCantiereId === cantiere.id || 
      d.items.some(i => i.destinationCantiereId === cantiere.id)
    )
    .sort((a, b) => {
      const timeA = new Date(a.date || a.createdAt || '').getTime() || 0;
      const timeB = new Date(b.date || b.createdAt || '').getTime() || 0;
      return timeB - timeA;
    });

  const pendingBolle = cantiereBolle.filter(d => d.status === 'in_attesa_accettazione' || d.status === 'parzialmente_accettata');
  const cantiereRequests = materialRequests.filter(r => r.cantiereId === cantiere.id);

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

  // Calcolo valore totale materiali assegnati dall'amministrazione a questo cantiere
  const assignedMaterialsTotal = documents
    .filter(d => d.status !== 'annullato')
    .reduce((totalAcc, doc) => {
      const docItemsSum = (doc.items || []).reduce((itemAcc, item) => {
        const isAssignedToThis = item.destinationCantiereId === cantiere.id || 
          (!item.destinationCantiereId && doc.destinationCantiereId === cantiere.id);
        if (isAssignedToThis) {
          const itemVal = Number(item.totalPrice) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
          return itemAcc + itemVal;
        }
        return itemAcc;
      }, 0);
      return totalAcc + docItemsSum;
    }, 0) + (movements || [])
    .filter(m => m.toId === cantiere.id && !m.documentId && (m.type === 'trasferimento_cantiere' || m.type === 'carico_cantiere'))
    .reduce((acc, m) => acc + ((Number(m.quantity) || 0) * (Number(m.costoUnitario) || 0)), 0);

  // 3. Giacenza attuale (CALCOLATA: Carico - Consumo)
  const inventoryMap = new Map<string, ExtendedStockItem>();

  // A. Add everything from Documents assigned to this cantiere (Carico)
  documents.filter(d => d.status !== 'annullato').forEach(doc => {
    doc.items.forEach(item => {
      const isAssigned = item.destinationCantiereId === cantiere.id || 
        (!item.destinationCantiereId && doc.destinationCantiereId === cantiere.id);
      if (!isAssigned) return;

      const existing = inventoryMap.get(item.materialeId) || {
        materialeId: item.materialeId,
        materialeName: item.materialeName,
        quantity: 0,
        unit: item.unit || 'pz',
        totalCost: 0,
        carico: 0,
        consumo: 0,
        caricoValore: 0,
        unitPrice: Number(item.unitPrice) || 0,
        valoreResiduo: 0
      };
      const qty = Number(item.quantity) || 0;
      const lineCost = Number(item.totalPrice) || (qty * (Number(item.unitPrice) || 0));
      
      existing.carico = (existing.carico || 0) + qty;
      existing.quantity += qty;
      existing.caricoValore = (existing.caricoValore || 0) + lineCost;
      if (existing.carico > 0) {
        existing.unitPrice = existing.caricoValore / existing.carico;
      }
      inventoryMap.set(item.materialeId, existing);
    });
  });

  // Include transfers from movements
  (movements || []).filter(m => m.toId === cantiere.id && !m.documentId && (m.type === 'trasferimento_cantiere' || m.type === 'carico_cantiere')).forEach(m => {
    const existing = inventoryMap.get(m.materialeId) || {
      materialeId: m.materialeId,
      materialeName: m.materialeName,
      quantity: 0,
      unit: m.unit || 'pz',
      totalCost: 0,
      carico: 0,
      consumo: 0,
      caricoValore: 0,
      unitPrice: Number(m.costoUnitario) || 0,
      valoreResiduo: 0
    };
    const qty = Number(m.quantity) || 0;
    const lineCost = qty * (Number(m.costoUnitario) || 0);
    existing.carico = (existing.carico || 0) + qty;
    existing.quantity += qty;
    existing.caricoValore = (existing.caricoValore || 0) + lineCost;
    if (existing.carico > 0) {
      existing.unitPrice = existing.caricoValore / existing.carico;
    }
    inventoryMap.set(m.materialeId, existing);
  });

  // If cantiere.stock has items that were initialized directly
  (cantiere.stock || []).forEach(s => {
    if (!inventoryMap.has(s.materialeId)) {
      inventoryMap.set(s.materialeId, {
        ...s,
        carico: s.carico || s.quantity,
        consumo: s.consumo || 0,
        caricoValore: s.totalCost || 0,
        unitPrice: s.carico ? (s.totalCost / s.carico) : 0,
        valoreResiduo: s.totalCost || 0
      });
    }
  });

  // B. Subtract everything from Rapportini (Consumo)
  validRapportini.forEach(rap => {
    (rap.materiali || []).forEach(m => {
      const existing = inventoryMap.get(m.materialeId) || {
        materialeId: m.materialeId,
        materialeName: m.materialeName,
        quantity: 0,
        unit: m.unit || 'pz',
        totalCost: 0,
        carico: 0,
        consumo: 0,
        caricoValore: 0,
        unitPrice: 0,
        valoreResiduo: 0
      };
      const qtyUsed = Number(m.quantity) || 0;
      existing.consumo = (existing.consumo || 0) + qtyUsed;
      existing.quantity -= qtyUsed;
      inventoryMap.set(m.materialeId, existing);
    });
  });

  // Calculate residual value
  inventoryMap.forEach(item => {
    const up = item.unitPrice || 0;
    item.valoreResiduo = Math.max(0, item.quantity * up);
    item.totalCost = item.valoreResiduo;
  });

  const cantiereInventory = [...Array.from(inventoryMap.values()), ...manualItems].sort((a, b) => a.materialeName.localeCompare(b.materialeName));
  const totalInventoryValore = cantiereInventory.reduce((acc, s) => acc + (s.valoreResiduo || s.totalCost || 0), 0);

  const handleToggleOrderItem = (materialeId: string) => {
    setOrderItems(prev => {
      const next = new Map(prev);
      if (next.has(materialeId)) {
        next.delete(materialeId);
      } else {
        next.set(materialeId, 1);
      }
      return next;
    });
  };

  const handleUpdateOrderQuantity = (materialeId: string, qty: number) => {
    setOrderItems(prev => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(materialeId);
      } else {
        next.set(materialeId, qty);
      }
      return next;
    });
  };

  const handleRemoveOrderItem = (materialeId: string) => {
    setOrderItems(prev => {
      const next = new Map(prev);
      next.delete(materialeId);
      return next;
    });
  };

  const handleSaveNewOrder = async () => {
    if (orderItems.size === 0) {
      alert('Seleziona almeno un materiale per l\'ordine.');
      return;
    }

    const newRequest: MaterialRequest = {
      id: `req-${Date.now()}`,
      cantiereId: cantiere.id,
      cantiereName: cantiere.name,
      userId: currentUser.id,
      userName: currentUser.name,
      date: new Date().toISOString().split('T')[0],
      items: Array.from(orderItems.entries()).map(([mid, qty]) => {
        const mat = materialiArchive.find(m => m.id === mid) || cantiereInventory.find(i => i.materialeId === mid);
        return {
          materialeId: mid,
          materialeName: mat?.name || mat?.materialeName || 'Materiale',
          quantity: qty,
          unit: mat?.unit || 'pz'
        };
      }),
      status: 'pending' as any, // Using existing pending status
      notes: orderNotes,
      createdAt: new Date().toISOString()
    };

    try {
      await onSaveMaterialRequest(newRequest);
      setIsOrdering(false);
      setOrderItems(new Map());
      setOrderNotes('');
      alert('Ordine inviato con successo.');
    } catch (err) {
      console.error('Error saving order:', err);
      alert('Errore durante l\'invio dell\'ordine.');
    }
  };

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Mat. Assegnati</p>
                <p className="text-xl font-black text-slate-900 mt-1">€{assignedMaterialsTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Valore da Amministrazione</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Giacenza Attuale</p>
                <p className="text-xl font-black text-slate-900 mt-1">{cantiereInventory.length} Voci</p>
                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">Valore: €{totalInventoryValore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bolle / Forniture</p>
                <p className="text-xl font-black text-slate-900 mt-1">{cantiereBolle.length}</p>
                {pendingBolle.length > 0 ? (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {pendingBolle.length} da accettare
                  </p>
                ) : (
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Tutte caricate</p>
                )}
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consumo Rapportini</p>
                <p className="text-xl font-black text-slate-900 mt-1">{cantiereMaterialiUsati.length}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Materiali impiegati</p>
              </div>
            </div>

            {/* Pending Bolle Alert Section */}
            {pendingBolle.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-[28px] space-y-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h4 className="text-xs font-black uppercase tracking-wider">Bolle in attesa di accettazione</h4>
                </div>
                <div className="space-y-2">
                  {pendingBolle.map(doc => (
                    <div key={doc.id} className="bg-white p-3 rounded-2xl border border-amber-200/60 shadow-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-500 uppercase">N. {doc.number}</span>
                          <span className="text-[10px] font-bold text-slate-800 truncate">{doc.supplier}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {doc.items.length} voci • €{doc.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        onClick={() => onAcceptDocument(doc.id)}
                        className="bg-slate-950 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                      >
                        <PackageCheck className="w-4 h-4 text-amber-400" />
                        Conferma e Carica
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Toggle & Order Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'giacenza', label: `Inventario Cantiere (${cantiereInventory.length})` },
                  { id: 'bolle', label: `Bolle Fornitori (${cantiereBolle.length})` },
                  { id: 'richieste', label: `Ordini & Richieste (${cantiereRequests.length})` },
                  { id: 'usati', label: `Consumi Rapportini (${cantiereMaterialiUsati.length})` },
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

              {!isReadOnly && materialFilter === 'giacenza' && (
                <button
                  onClick={() => setIsOrdering(!isOrdering)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                    isOrdering 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  }`}
                >
                  {isOrdering ? (
                    <> <X className="w-4 h-4" /> Annulla Ordine </>
                  ) : (
                    <> <ShoppingBag className="w-4 h-4" /> Apri Nuovo Ordine </>
                  )}
                </button>
              )}
            </div>

            {/* Order Preview Bar */}
            {isOrdering && orderItems.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-200 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black">
                    {orderItems.size}
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-900 uppercase">Ordine in Preparazione</p>
                    <p className="text-[10px] text-emerald-700">{orderItems.size} materiali selezionati dall'inventario.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input 
                    type="text"
                    placeholder="Note per l'ordine..."
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    className="flex-1 sm:w-64 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                  <button 
                    onClick={handleSaveNewOrder}
                    className="bg-slate-950 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all"
                  >
                    Invia Ordine
                  </button>
                </div>
              </motion.div>
            )}

            {/* 1. Inventario Cantiere (Carico - Consumo = Giacenza) */}
            {(materialFilter === 'giacenza') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-emerald-500" />
                    Inventario di Cantiere (Carico/Consumo)
                  </h3>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto relative custom-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-0 min-w-[1050px]">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {/* Colonna Descrizione FISSA a sinistra durante lo scroll orizzontale - Ottimizzata Mobile (massimo 1/4 dello schermo con puntini) */}
                          <th className="sticky left-0 z-30 bg-slate-100/95 backdrop-blur-xs px-2.5 sm:px-5 py-3.5 text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 w-[25vw] max-w-[25vw] min-w-[95px] sm:w-auto sm:min-w-[240px] sm:max-w-[300px] border-b border-r-2 border-slate-200 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)]">
                            Materiale / Descrizione
                          </th>
                          <th className="px-3.5 py-3.5 text-center text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 min-w-[80px]">
                            U.M.
                          </th>
                          <th className="px-3.5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 min-w-[110px]">
                            Valore Unit.
                          </th>
                          <th className="px-3.5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-emerald-600 border-b border-slate-100 min-w-[110px]">
                            Carico (+)
                          </th>
                          <th className="px-3.5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-emerald-700 border-b border-slate-100 min-w-[120px]">
                            Val. Carico
                          </th>
                          <th className="px-3.5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 min-w-[110px]">
                            Consumo (-)
                          </th>
                          <th className="px-3.5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 min-w-[120px]">
                            Giacenza (=)
                          </th>
                          <th className="px-3.5 py-3.5 text-right text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 min-w-[120px]">
                            Val. Residuo
                          </th>
                          <th className="px-3.5 py-3.5 text-center text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 min-w-[120px]">
                            Stato Scorta
                          </th>
                          {/* Colonna Colorata messa alla fine quando si apre un ordine */}
                          {isOrdering && (
                            <th className="px-5 py-3.5 text-center text-xs font-black uppercase tracking-wider bg-amber-500 text-slate-950 border-b border-l-2 border-amber-600 shadow-md min-w-[260px]">
                              <div className="flex items-center justify-center gap-1.5">
                                <ShoppingCart className="w-4 h-4 text-slate-950" />
                                <span>Quantità da Ordinare</span>
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cantiereInventory.length === 0 ? (
                          <tr>
                            <td colSpan={isOrdering ? 10 : 9} className="px-4 py-12 text-center text-xs text-slate-400 font-medium italic">
                              Nessun materiale caricato o utilizzato in questo cantiere.
                            </td>
                          </tr>
                        ) : (
                          cantiereInventory.map((item) => {
                            const isSelectedInOrder = isOrdering && orderItems.has(item.materialeId);
                            const currentOrderQty = orderItems.get(item.materialeId) || 0;
                            const isLowStock = item.quantity > 0 && item.quantity <= 5;
                            const isOutOfStock = item.quantity <= 0;

                            return (
                              <tr 
                                key={item.materialeId} 
                                className={`group hover:bg-slate-50/70 transition-colors ${isSelectedInOrder ? 'bg-amber-50/40' : ''}`}
                              >
                                {/* Colonna Descrizione FISSA a sinistra - Troncata con puntini su mobile (max 1/4 schermo) + Click/Doppio Click per Scheda Prodotto */}
                                <td 
                                  onClick={() => {
                                    setSelectedMaterialCard(item);
                                    setMaterialCardOrderQty(orderItems.get(item.materialeId) || 1);
                                  }}
                                  onDoubleClick={() => {
                                    setSelectedMaterialCard(item);
                                    setMaterialCardOrderQty(orderItems.get(item.materialeId) || 1);
                                  }}
                                  className={`sticky left-0 z-20 bg-white group-hover:bg-amber-50/50 px-2 sm:px-4 py-2.5 sm:py-3.5 w-[25vw] max-w-[25vw] min-w-[95px] sm:w-auto sm:min-w-[240px] sm:max-w-[300px] border-b border-r-2 border-slate-200 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] transition-colors cursor-pointer select-none ${
                                    isSelectedInOrder ? '!bg-amber-50' : ''
                                  }`}
                                  title="Fai clic o doppio clic per aprire la Scheda Prodotto completa e ordinare"
                                >
                                  <div className="w-full min-w-0">
                                    <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate hover:text-amber-600 transition-colors" title={item.materialeName}>
                                      {item.materialeName}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="text-[9px] text-amber-600 font-black sm:hidden flex items-center gap-0.5 shrink-0">
                                        <Maximize2 className="w-2.5 h-2.5" /> Scheda
                                      </span>
                                      <span className="hidden sm:inline-block text-[10px] font-mono font-bold text-slate-400 uppercase truncate">
                                        ID: {item.materialeId.slice(-6).toUpperCase()}
                                      </span>
                                      {isOutOfStock && (
                                        <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 shrink-0">
                                          Esaurito
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* U.M. */}
                                <td className="px-3.5 py-3.5 text-center border-b border-slate-100">
                                  <span className="text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                    {item.unit}
                                  </span>
                                </td>

                                {/* Valore Unitario */}
                                <td className="px-3.5 py-3.5 text-right border-b border-slate-100">
                                  <span className="text-xs font-mono font-bold text-slate-600">
                                    €{(item.unitPrice || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </td>

                                {/* Carico (+) */}
                                <td className="px-3.5 py-3.5 text-right border-b border-slate-100">
                                  <span className="text-xs font-bold text-emerald-600">
                                    +{(item.carico || 0).toLocaleString('it-IT')}
                                  </span>
                                </td>

                                {/* Valore Carico (€) */}
                                <td className="px-3.5 py-3.5 text-right border-b border-slate-100">
                                  <span className="text-xs font-mono font-bold text-emerald-700">
                                    €{(item.caricoValore || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </td>

                                {/* Consumo (-) */}
                                <td className="px-3.5 py-3.5 text-right border-b border-slate-100">
                                  <span className="text-xs font-bold text-slate-500">
                                    -{(item.consumo || 0).toLocaleString('it-IT')}
                                  </span>
                                </td>

                                {/* Giacenza Attuale (=) */}
                                <td className="px-3.5 py-3.5 text-right border-b border-slate-100">
                                  <span className={`text-sm font-black ${item.quantity > 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                                    {(item.quantity || 0).toLocaleString('it-IT')}
                                  </span>
                                </td>

                                {/* Valore Residuo (€) */}
                                <td className="px-3.5 py-3.5 text-right border-b border-slate-100">
                                  <span className="text-xs font-mono font-black text-slate-900">
                                    €{(item.valoreResiduo || item.totalCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </td>

                                {/* Stato Scorta */}
                                <td className="px-3.5 py-3.5 text-center border-b border-slate-100">
                                  {isOutOfStock ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Esaurito
                                    </span>
                                  ) : isLowStock ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      Bassa
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      Disponibile
                                    </span>
                                  )}
                                </td>

                                {/* ULTERIORE COLONNA COLORATA MESSA ALLA FINE PER L'ORDINE */}
                                {isOrdering && (
                                  <td className="px-4 py-3.5 text-center bg-amber-50/90 border-b border-l-2 border-amber-300 min-w-[260px] transition-colors">
                                    <div className="flex flex-col items-center gap-1.5">
                                      <p className="text-[10px] font-bold text-amber-900 uppercase tracking-tight">
                                        Quanto ordinare?
                                      </p>
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextVal = Math.max(0, currentOrderQty - 1);
                                            if (nextVal === 0) {
                                              handleRemoveOrderItem(item.materialeId);
                                            } else {
                                              handleUpdateOrderQuantity(item.materialeId, nextVal);
                                            }
                                          }}
                                          className="w-8 h-8 rounded-xl bg-amber-200 hover:bg-amber-300 active:scale-95 text-amber-950 font-black flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                          title="Diminuisci quantità"
                                        >
                                          -
                                        </button>
                                        <div className="flex items-center bg-white border-2 border-amber-400 rounded-xl px-2.5 py-1 shadow-xs focus-within:ring-2 focus-within:ring-amber-500">
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder="0"
                                            className="w-16 text-center text-xs font-black text-slate-900 outline-none"
                                            value={isSelectedInOrder && currentOrderQty > 0 ? currentOrderQty : ''}
                                            onChange={e => {
                                              const val = parseFloat(e.target.value);
                                              if (isNaN(val) || val <= 0) {
                                                handleRemoveOrderItem(item.materialeId);
                                              } else {
                                                handleUpdateOrderQuantity(item.materialeId, val);
                                              }
                                            }}
                                          />
                                          <span className="text-[10px] font-bold text-slate-500 uppercase ml-1 shrink-0">
                                            {item.unit}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleUpdateOrderQuantity(item.materialeId, currentOrderQty + 1);
                                          }}
                                          className="w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                          title="Aumenta quantità"
                                        >
                                          +
                                        </button>
                                      </div>

                                      {isSelectedInOrder && currentOrderQty > 0 && (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[9px] font-black text-emerald-800 border border-emerald-300">
                                            <Check className="w-2.5 h-2.5 stroke-[3]" /> Selezionato: {currentOrderQty} {item.unit}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveOrderItem(item.materialeId)}
                                            className="text-[9px] font-bold text-rose-600 hover:underline cursor-pointer"
                                          >
                                            Azzera
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {isOrdering && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Non trovi il materiale nell'inventario?</p>
                    <button 
                      onClick={() => {
                        const name = prompt('Inserisci il NOME del materiale da ordinare:');
                        if (name) {
                          const unit = prompt('Inserisci l\'UNITÀ DI MISURA (es. pz, kg, m):', 'pz') || 'pz';
                          const id = `manual-${Date.now()}`;
                          
                          const manualItem: StockItem = {
                            materialeId: id,
                            materialeName: name,
                            quantity: 0,
                            unit: unit,
                            totalCost: 0,
                            carico: 0,
                            consumo: 0
                          };
                          
                          setManualItems(prev => [...prev, manualItem]);
                          setOrderItems(prev => {
                            const next = new Map(prev);
                            next.set(id, 1);
                            return next;
                          });
                        }
                      }}
                      className="text-xs font-black text-amber-600 hover:underline flex items-center justify-center gap-1.5 mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Aggiungi materiale a mano all'ordine
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* 2. Bolle e Forniture del Cantiere (Ordinate dalla più recente in alto - Annullate evidenziate in ROSSO) */}
            {materialFilter === 'bolle' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <ReceiptText className="w-4 h-4 text-blue-500" />
                    Bolle & Forniture Ricevute ({cantiereBolle.length})
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Ordinamento: più recente in alto
                  </span>
                </div>

                {cantiereBolle.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs italic">
                    Nessun documento di trasporto (DDT) o fattura registrato per questo cantiere.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cantiereBolle.map(doc => {
                      const isAnnullata = doc.status === 'annullato';
                      const isPending = doc.status === 'in_attesa_accettazione';
                      
                      // Materiali di questa bolla che appartengono a questo cantiere
                      const cantiereItems = (doc.items || []).filter(item => 
                        item.destinationCantiereId === cantiere.id || 
                        (!item.destinationCantiereId && doc.destinationCantiereId === cantiere.id)
                      );

                      const cantiereDocVal = cantiereItems.reduce((acc, item) => {
                        return acc + (Number(item.totalPrice) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)));
                      }, 0);

                      return (
                        <div
                          key={doc.id}
                          className={`p-5 rounded-3xl border transition-all ${
                            isAnnullata
                              ? 'bg-rose-50/80 border-rose-300 shadow-xs'
                              : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-100">
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl ${
                                isAnnullata
                                  ? 'bg-rose-200 text-rose-900 border border-rose-300'
                                  : doc.type === 'bolla'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {isAnnullata ? 'ANNULLATA' : (doc.type === 'bolla' ? 'DDT / BOLLA' : 'FATTURA')}
                              </span>
                              <div>
                                <h4 className={`text-sm font-black ${isAnnullata ? 'text-rose-950 line-through' : 'text-slate-900'}`}>
                                  N. {doc.number} - {doc.supplier}
                                </h4>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  Data emissione: {formatItalianDate(doc.date)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-base font-black ${isAnnullata ? 'text-rose-600 line-through' : 'text-slate-900'}`}>
                                  €{cantiereDocVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className={`text-[9px] font-black uppercase tracking-wider ${isAnnullata ? 'text-rose-500' : 'text-slate-400'}`}>
                                  {isAnnullata ? 'Costo Stornato' : 'Valore Assegnato'}
                                </p>
                              </div>

                              {isAnnullata ? (
                                <span className="px-3 py-1.5 rounded-full bg-rose-200 text-rose-900 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-rose-300">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                                  Stornata
                                </span>
                              ) : isPending ? (
                                <button
                                  onClick={() => onAcceptDocument(doc.id)}
                                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                  <PackageCheck className="w-4 h-4" />
                                  Accetta e Carica
                                </button>
                              ) : (
                                <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                  Caricata in Cantiere
                                </span>
                              )}
                            </div>
                          </div>

                          {isAnnullata && (
                            <div className="mt-3 p-3 rounded-2xl bg-rose-100/80 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <p className="font-medium leading-relaxed">
                                <strong className="font-black">Bolla annullata dall'amministrazione:</strong> I materiali e i costi sono stati stornati dall'inventario e dalle spese di questo cantiere, mantenendo la traccia storica consultabile.
                              </p>
                            </div>
                          )}

                          {/* Items Breakdown */}
                          <div className="mt-3 space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Materiali destinati a questo cantiere:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {cantiereItems.map((item, idx) => (
                                <div 
                                  key={idx} 
                                  className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                                    isAnnullata ? 'bg-rose-100/50 border-rose-200 text-rose-900/80 line-through' : 'bg-slate-50 border-slate-100 text-slate-700'
                                  }`}
                                >
                                  <span className="font-bold truncate mr-2">{item.materialeName}</span>
                                  <span className="font-black font-mono shrink-0">
                                    {item.quantity} {item.unit || 'pz'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* 3. Consumi Registrati nei Rapportini */}
            {materialFilter === 'usati' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <HardHat className="w-4 h-4 text-amber-500" />
                    Materiali Impiegati nei Rapportini ({cantiereMaterialiUsati.length})
                  </h3>
                </div>

                {cantiereMaterialiUsati.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs italic">
                    Nessun consumo di materiale registrato nei rapportini di questo cantiere.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {cantiereMaterialiUsati.map((m, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-slate-900">{m.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">Registrato in {m.count} rapportini</p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900">{m.quantity.toLocaleString('it-IT')}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">{m.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 4. Richieste Materiali */}
            {(materialFilter === 'tutti' || materialFilter === 'richieste') && (
              <MaterialRequestManager
                cantiere={cantiere}
                currentUser={currentUser}
                materialiArchive={materialiArchive}
                requests={cantiereRequests}
                onSaveRequest={onSaveMaterialRequest}
                onUpdateStatus={onUpdateMaterialRequestStatus}
              />
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
              {onCreateRapportinoForCantiere && canCreateRapportini && (
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
                {onCreateRapportinoForCantiere && canCreateRapportini && (
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
              {canUploadDocs && (
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
                {canUploadDocs && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-2 bg-slate-950 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider"
                  >
                    Carica Ora
                  </button>
                )}
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

        {/* ==================================================== */}
        {/* SCHEDA PRODOTTO / MATERIALE MODAL (Doppio Clic o Clic) */}
        {/* ==================================================== */}
        {selectedMaterialCard && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[250] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden my-auto"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                      Scheda Prodotto
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {selectedMaterialCard.materialeId.slice(-8).toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
                    {selectedMaterialCard.materialeName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Cantiere: <span className="text-slate-200 font-bold">{cantiere.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMaterialCard(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Metrics Grid */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
                    Stato Giacenza & Valore nel Cantiere
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Giacenza Attuale</p>
                      <p className={`text-lg font-black mt-1 ${selectedMaterialCard.quantity > 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                        {selectedMaterialCard.quantity} <span className="text-xs font-bold text-slate-500">{selectedMaterialCard.unit}</span>
                      </p>
                    </div>

                    <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase">Carico (+) Totale</p>
                      <p className="text-lg font-black text-emerald-700 mt-1">
                        +{selectedMaterialCard.carico || 0} <span className="text-xs font-bold text-emerald-600">{selectedMaterialCard.unit}</span>
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Consumo (-) Usato</p>
                      <p className="text-lg font-black text-slate-700 mt-1">
                        -{selectedMaterialCard.consumo || 0} <span className="text-xs font-bold text-slate-500">{selectedMaterialCard.unit}</span>
                      </p>
                    </div>

                    <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200">
                      <p className="text-[10px] font-bold text-amber-900 uppercase">Valore Residuo</p>
                      <p className="text-lg font-black text-amber-800 mt-1">
                        €{(selectedMaterialCard.valoreResiduo || selectedMaterialCard.totalCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between px-2 text-[11px] text-slate-500">
                    <span>Valore Unitario Medio: <strong>€{(selectedMaterialCard.unitPrice || 0).toFixed(2)}/{selectedMaterialCard.unit}</strong></span>
                    <span>Totale Valore Caricato: <strong>€{(selectedMaterialCard.caricoValore || 0).toFixed(2)}</strong></span>
                  </div>
                </div>

                {/* Direct Order / Material Load Box */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 rounded-3xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                      Richiedi / Ordina Materiale
                    </h4>
                  </div>
                  <p className="text-xs text-amber-900/80 mb-4">
                    Imposta la quantità da ordinare o richiedere per questo cantiere.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex items-center justify-center bg-white border-2 border-amber-400 rounded-2xl p-1 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setMaterialCardOrderQty(q => Math.max(1, q - 1))}
                        className="w-9 h-9 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-base flex items-center justify-center transition-all cursor-pointer"
                      >
                        <Minus className="w-4 h-4 stroke-[3]" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={materialCardOrderQty}
                        onChange={(e) => setMaterialCardOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 text-center font-black text-slate-900 text-sm outline-none bg-transparent"
                      />
                      <span className="text-xs font-bold text-slate-500 pr-2 uppercase">
                        {selectedMaterialCard.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMaterialCardOrderQty(q => q + 1)}
                        className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Quick addition buttons */}
                    <div className="flex items-center justify-center gap-1.5">
                      {[5, 10, 25, 50].map(qty => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setMaterialCardOrderQty(q => q + qty)}
                          className="px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 text-[11px] font-black text-amber-900 hover:bg-amber-200/60 transition-colors cursor-pointer"
                        >
                          +{qty}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!isOrdering) {
                          setIsOrdering(true);
                        }
                        handleUpdateOrderQuantity(selectedMaterialCard.materialeId, materialCardOrderQty);
                        setSelectedMaterialCard(null);
                      }}
                      className="flex-1 bg-slate-950 hover:bg-slate-900 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3] text-amber-400" />
                      {isOrdering ? 'Aggiorna Ordine' : 'Inserisci nell\'Ordine'}
                    </button>
                  </div>
                </div>

                {/* Storico Consegne per questo materiale nel cantiere */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <History className="w-4 h-4 text-slate-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Storico Forniture in questo Cantiere
                    </p>
                  </div>
                  {(() => {
                    const deliveryHistory = cantiereBolle.filter(b => 
                      (b.items || []).some(it => it.materialeId === selectedMaterialCard.materialeId || it.materialeName.toLowerCase() === selectedMaterialCard.materialeName.toLowerCase())
                    );

                    if (deliveryHistory.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                          Nessuna fornitura archiviata specificamente per questo materiale in questo cantiere.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {deliveryHistory.map(b => {
                          const matchedItem = (b.items || []).find(it => it.materialeId === selectedMaterialCard.materialeId || it.materialeName.toLowerCase() === selectedMaterialCard.materialeName.toLowerCase());
                          const isAnnullata = b.status === 'annullato';

                          return (
                            <div 
                              key={b.id} 
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                                isAnnullata ? 'bg-rose-50 border-rose-200 text-rose-900 line-through' : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black">Bolla N. {b.number}</span>
                                  <span className="text-[10px] text-slate-400">{formatItalianDate(b.date)}</span>
                                  {isAnnullata && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 uppercase">
                                      Stornata
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">{b.supplier}</p>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-sm text-slate-900">
                                  +{matchedItem?.quantity || 0} {selectedMaterialCard.unit}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Fai doppio clic o tocca qualsiasi materiale per riaprire questa scheda.
                </p>
                <button
                  onClick={() => setSelectedMaterialCard(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
