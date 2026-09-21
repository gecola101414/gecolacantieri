import React, { useState } from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry, UserAccount, Company, Materiale, StockMovement, MaterialDocument, CantiereChatMessage, CantiereDocumentoTecnico, Fornitore, UserRole, UserPermissions, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS, ROLE_DESCRIPTIONS, TimbraturaBadge, MaterialRequest, MaterialRequestStatus } from '../types';
import { 
  Building2, HardHat, Wrench, FileText, DollarSign, Users, PieChart as PieChartIcon, 
  Plus, Search, CheckCircle, CheckCircle2, Clock, AlertCircle, Phone, Mail, Shield, Check,
  ExternalLink, Calendar, MapPin, Trash2, Edit3, Image as ImageIcon, MessageSquare, ArrowUpRight, ArrowDownRight, Fuel, Copy, KeyRound, Filter, Download, MoreHorizontal, ChevronRight, LayoutGrid, List, Cloud, Box, Smartphone, X, Camera, RotateCcw, ReceiptText, Timer, Loader2
} from 'lucide-react';
import { WhatsAppExportModal } from './WhatsAppExportModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend, AreaChart, Area, CartesianGrid } from 'recharts';
import { seedSimulationData } from '../lib/seeder';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';
import { PhotoLightbox } from './PhotoLightbox';
import { BolleManager } from './BolleManager';
import { CantiereHub } from './CantiereHub';
import { BadgeManager } from './BadgeManager';
import { CentraleEventi } from './CentraleEventi';
import { VersionBadge } from './VersionBadge';

const formatItalianDate = (isoString?: string) => {
  if (!isoString) return '';
  const parts = isoString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoString;
};

interface AdminDashboardProps {
  company: Company | null;
  cantieri: Cantiere[];
  onAddCantiere: (c: Cantiere) => void;
  personale: Personale[];
  onAddPersonale: (p: Personale) => void;
  mezzi: Mezzo[];
  onAddMezzo: (m: Mezzo) => void;
  contabilita: ContabilitaEntry[];
  onAddContabilita: (e: ContabilitaEntry) => void;
  rapportini: Rapportino[];
  onAddRapportino: (r: Rapportino) => void;
  onCancelRapportino?: (rapportinoId: string, motivo: string) => Promise<void>;
  users: UserAccount[];
  onSaveUser: (u: UserAccount) => void;
  onDeleteUser: (uid: string) => void;
  materiali: Materiale[];
  onAddMateriale: (m: Materiale) => void;
  movements: StockMovement[];
  onAddMovement: (m: StockMovement) => void;
  documents: MaterialDocument[];
  onAddDocument: (d: MaterialDocument) => void;
  onDeleteDocument?: (docId: string) => Promise<void>;
  onAnnullaDocument?: (docId: string, motivo?: string) => Promise<void>;
  onRipristinaDocument?: (docId: string) => Promise<void>;
  onAcceptDocument?: (docId: string) => Promise<void>;
  onAcceptTransfer?: (moveId: string) => Promise<void>;
  currentUser: UserAccount;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  materialRequests?: MaterialRequest[];
  onSaveMaterialRequest?: (req: MaterialRequest) => Promise<void>;
  onUpdateMaterialRequestStatus?: (rid: string, status: MaterialRequestStatus) => Promise<void>;
  chatMessages?: CantiereChatMessage[];
  technicalDocs?: CantiereDocumentoTecnico[];
  onSendMessage?: (msg: CantiereChatMessage) => Promise<void>;
  onSaveTechnicalDoc?: (doc: CantiereDocumentoTecnico) => Promise<void>;
  onDeleteTechnicalDoc?: (docId: string) => Promise<void>;
  fornitori?: Fornitore[];
  onSaveFornitore?: (f: Fornitore) => Promise<void>;
  onDeleteFornitore?: (fid: string) => Promise<void>;
  timbrature?: TimbraturaBadge[];
  onSaveTimbratura?: (t: TimbraturaBadge) => Promise<void>;
  onDeleteTimbratura?: (tid: string) => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  company,
  cantieri,
  onAddCantiere,
  personale,
  onAddPersonale,
  mezzi,
  onAddMezzo,
  contabilita,
  onAddContabilita,
  rapportini,
  onAddRapportino,
  onCancelRapportino,
  users,
  onSaveUser,
  onDeleteUser,
  materiali,
  onAddMateriale,
  movements,
  onAddMovement,
  documents,
  onAddDocument,
  onDeleteDocument,
  onAnnullaDocument,
  onRipristinaDocument,
  onAcceptDocument,
  onAcceptTransfer,
  currentUser,
  activeTab,
  setActiveTab,
  materialRequests = [],
  onSaveMaterialRequest = async () => {},
  onUpdateMaterialRequestStatus = async () => {},
  chatMessages = [],
  technicalDocs = [],
  onSendMessage = async () => {},
  onSaveTechnicalDoc = async () => {},
  onDeleteTechnicalDoc = async () => {},
  fornitori = [],
  onSaveFornitore = async () => {},
  onDeleteFornitore = async () => {},
  timbrature = [],
  onSaveTimbratura = async () => {},
  onDeleteTimbratura = async () => {},
}) => {
  // Modals
  const [showAddCantiereModal, setShowAddCantiereModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddPersonaleModal, setShowAddPersonaleModal] = useState(false);
  const [showAddMezzoModal, setShowAddMezzoModal] = useState(false);
  const [showAddMovementModal, setShowAddMovementModal] = useState(false);
  const [showAddMaterialeModal, setShowAddMaterialeModal] = useState(false);
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [selectedRapportino, setSelectedRapportino] = useState<Rapportino | null>(null);
  const [adminLightboxPhoto, setAdminLightboxPhoto] = useState<string | null>(null);
  const [selectedCantiere, setSelectedCantiere] = useState<Cantiere | null>(null);
  const [selectedPersonale, setSelectedPersonale] = useState<Personale | null>(null);
  const [userToAccredit, setUserToAccredit] = useState<UserAccount | null>(null);
  const [whatsappModalCantiere, setWhatsappModalCantiere] = useState<Cantiere | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Finestra Inserimento Chiave 4 Cifre per Collegare Cellulare (Admin)
  const [pairingModalUser, setPairingModalUser] = useState<UserAccount | null>(null);
  const [pairingInputCode, setPairingInputCode] = useState<string>('');
  const [pairingLoading, setPairingLoading] = useState<boolean>(false);
  const [pairingError, setPairingError] = useState<string>('');
  const [pairingSuccess, setPairingSuccess] = useState<string>('');

  // Rapportini filters & cancellation state
  const [rapportiniFilterCantiere, setRapportiniFilterCantiere] = useState<string>('all');
  const [rapportiniFilterStatus, setRapportiniFilterStatus] = useState<'all' | 'valido' | 'annullato'>('all');
  const [rapportiniSearch, setRapportiniSearch] = useState<string>('');
  const [showAdminCancelDialog, setShowAdminCancelDialog] = useState<boolean>(false);
  const [adminCancelReason, setAdminCancelReason] = useState<string>('');
  const [isAdminCancelling, setIsAdminCancelling] = useState<boolean>(false);

  const handleAdminCancelRapportino = async () => {
    if (!selectedRapportino || !onCancelRapportino) return;
    if (!adminCancelReason.trim()) {
      alert('Inserisci la motivazione dell\'annullamento (obbligatoria).');
      return;
    }
    setIsAdminCancelling(true);
    try {
      await onCancelRapportino(selectedRapportino.id, adminCancelReason.trim());
      setSelectedRapportino(prev => prev ? {
        ...prev,
        status: 'annullato',
        annullatoIl: new Date().toLocaleString('it-IT'),
        annullatoDa: currentUser.name,
        motivoAnnullamento: adminCancelReason.trim()
      } : null);
      setShowAdminCancelDialog(false);
      setAdminCancelReason('');
      alert('Rapportino annullato con successo. Le ore e i costi associati al cantiere sono stati stornati.');
    } catch (err) {
      console.error('Error cancelling rapportino:', err);
      alert('Errore durante l\'annullamento del rapportino.');
    } finally {
      setIsAdminCancelling(false);
    }
  };
  
  // ... rest of state
  const [newCantiere, setNewCantiere] = useState<Partial<Cantiere>>({
    code: '',
    name: '',
    client: '',
    address: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'in_corso',
  });

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [newUser, setNewUser] = useState<{
    id?: string;
    name: string;
    username: string;
    role: UserRole;
    phone: string;
    cantiereId: string;
    permissions: UserPermissions;
  }>({
    name: '',
    username: '',
    role: 'capo_cantiere',
    phone: '',
    cantiereId: '',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.capo_cantiere }
  });

  const [newPers, setNewPers] = useState<Partial<Personale>>({
    name: '',
    role: 'Operaio Generico',
    phone: '',
    hourlyRate: 22,
  });

  const [newMenz, setNewMenz] = useState<Partial<Mezzo>>({
    name: '',
    plate: '',
    type: 'Autocarro',
  });

  // Calculate totals
  const activeCantieriCount = cantieri.filter(c => c.status === 'in_corso').length;
  const todayRapportiniCount = rapportini.filter(r => r.date === new Date().toISOString().split('T')[0]).length;

  // Handlers
  const handleCreateCantiere = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCantiere.name || !newCantiere.client) return;
    const created: Cantiere = {
      id: 'c-' + Date.now(),
      code: newCantiere.code || 'CANT-' + Math.floor(1000 + Math.random() * 9000),
      name: newCantiere.name,
      client: newCantiere.client,
      address: newCantiere.address || '',
      budget: 0,
      startDate: newCantiere.startDate || new Date().toISOString().split('T')[0],
      endDate: newCantiere.endDate || '',
      status: newCantiere.status as any || 'in_corso',
    };
    onAddCantiere(created);
    setShowAddCantiereModal(false);
    setNewCantiere({ name: '', client: '', address: '', status: 'in_corso' });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.username) return;
    const targetRole: UserRole = newUser.role || 'capo_cantiere';
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[targetRole] || DEFAULT_ROLE_PERMISSIONS.capo_cantiere;

    const u: UserAccount = {
      id: editingUser ? editingUser.id : ('usr-' + Date.now()),
      companyCode: company ? company.code : 'CANT-0000',
      name: newUser.name,
      username: newUser.username,
      password: editingUser ? editingUser.password : '1234',
      role: targetRole,
      permissions: newUser.permissions || defaultPerms,
      mustChangePassword: editingUser ? editingUser.mustChangePassword : true,
      cantiereId: newUser.cantiereId || editingUser?.cantiereId || '',
      phone: newUser.phone || '',
      active: editingUser ? editingUser.active : true,
      deviceId: editingUser?.deviceId,
      pairingCode: editingUser?.pairingCode,
      pairingCodeExpiresAt: editingUser?.pairingCodeExpiresAt,
      cantieriAccreditati: editingUser?.cantieriAccreditati || [],
    };
    onSaveUser(u);
    setShowAddUserModal(false);
    setEditingUser(null);
    setNewUser({
      name: '',
      username: '',
      role: 'capo_cantiere',
      phone: '',
      cantiereId: '',
      permissions: { ...DEFAULT_ROLE_PERMISSIONS.capo_cantiere }
    });
  };

  const handleStartEditUser = (u: UserAccount) => {
    setEditingUser(u);
    const userRole = u.role || 'capo_cantiere';
    const userPerms = u.permissions || DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.operativo;
    setNewUser({
      id: u.id,
      name: u.name,
      username: u.username,
      role: userRole,
      phone: u.phone || '',
      cantiereId: u.cantiereId || '',
      permissions: { ...userPerms }
    });
    setShowAddUserModal(true);
  };

  const handleCreatePersonale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPers.name) return;
    const personnelId = 'p-' + Date.now();
    const p: Personale = {
      id: personnelId,
      name: newPers.name,
      role: newPers.role as any || 'Operaio Generico',
      hourlyRate: 0,
      phone: newPers.phone || '',
    };
    onAddPersonale(p);

    // Auto-create User Account for the employee
    const username = newPers.name.toLowerCase().replace(/\s/g, '.') + '.' + Math.floor(Math.random() * 100);
    const u: UserAccount = {
      id: 'usr-' + Date.now(),
      companyCode: company ? company.code : 'CANT-0000',
      name: newPers.name,
      username: username,
      password: '1234',
      role: 'operativo',
      mustChangePassword: true,
      phone: newPers.phone || '',
      active: true,
    };
    onSaveUser(u);

    setShowAddPersonaleModal(false);
    setNewPers({ name: '', role: 'Operaio Generico', hourlyRate: 20, phone: '' });
  };

  const handleCreateMezzo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenz.name) return;
    const m: Mezzo = {
      id: 'm-' + Date.now(),
      name: newMenz.name,
      plate: newMenz.plate || '',
      type: newMenz.type as any || 'Autocarro',
      hourlyRate: 0,
    };
    onAddMezzo(m);
    setShowAddMezzoModal(false);
    setNewMenz({ name: '', plate: '', type: 'Autocarro' });
  };

  const [newMateriale, setNewMateriale] = useState<Partial<Materiale>>({
    name: '',
    unit: 'mc',
    category: 'Edili',
  });

  const handleCreateMateriale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMateriale.name) return;
    const m: Materiale = {
      id: 'mat-' + Date.now(),
      name: newMateriale.name,
      unit: newMateriale.unit || 'mc',
      category: newMateriale.category || 'Edili',
      defaultPrice: 0,
    };
    onAddMateriale(m);
    setShowAddMaterialeModal(false);
    setNewMateriale({ name: '', unit: 'mc', category: 'Edili' });
  };

  const handleCreateMovement = (move: Omit<StockMovement, 'id' | 'materialeName'>) => {
    const mat = materiali.find(m => m.id === move.materialeId);
    if (!mat) return;

    const newMove: StockMovement = {
      ...move,
      id: 'mov-' + Date.now(),
      materialeName: mat.name
    };
    onAddMovement(newMove);
    setShowAddMovementModal(false);
  };

  const [newDocument, setNewDocument] = useState<{
    number: string;
    date: string;
    supplier: string;
    type: 'bolla' | 'fattura';
    items: {
      materialeId: string;
      quantity: number;
      unitPrice: number;
    }[];
  }>({
    number: '',
    date: new Date().toISOString().split('T')[0],
    supplier: '',
    type: 'bolla',
    items: [{ materialeId: '', quantity: 0, unitPrice: 0 }]
  });

  const handleAddDocumentItem = () => {
    setNewDocument({
      ...newDocument,
      items: [...newDocument.items, { materialeId: '', quantity: 0, unitPrice: 0 }]
    });
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocument.number || !newDocument.supplier) return;
    
    const items = newDocument.items.map(item => {
      const mat = materiali.find(m => m.id === item.materialeId);
      return {
        materialeId: item.materialeId,
        materialeName: mat?.name || 'Sconosciuto',
        quantity: item.quantity,
        unit: mat?.unit || 'u',
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice
      };
    });

    const docData: MaterialDocument = {
      id: 'doc-' + Date.now(),
      number: newDocument.number,
      date: newDocument.date,
      supplier: newDocument.supplier,
      type: newDocument.type,
      items,
      totalAmount: items.reduce((acc, i) => acc + i.totalPrice, 0),
      status: 'registrato'
    };

    onAddDocument(docData);
    setShowAddDocumentModal(false);
    setNewDocument({
      number: '',
      date: new Date().toISOString().split('T')[0],
      supplier: '',
      type: 'bolla',
      items: [{ materialeId: '', quantity: 0, unitPrice: 0 }]
    });
  };

  const [isSeeding, setIsSeeding] = useState(false);
  const handleSeedSimulation = async () => {
    if (!company) return;
    if (!window.confirm('Vuoi caricare 20 materiali di simulazione e aggiornare le tariffe orarie?')) return;
    
    setIsSeeding(true);
    try {
      await seedSimulationData(company.id);
      alert('Dati di simulazione caricati con successo!');
    } catch (e) {
      alert('Errore durante il caricamento dei dati.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleResetPassword = (userId: string) => {
    if (!window.confirm('Sei sicuro di voler ripristinare la password a "1234"?')) return;
    const user = users.find(u => u.id === userId);
    if (user) {
      onSaveUser({ ...user, password: '1234', mustChangePassword: true });
    }
  };

  const handleResetDevice = (userId: string) => {
    if (!window.confirm('Sei sicuro di voler scollegare il cellulare da questo account? L\'utente potrà legarne uno nuovo al prossimo login.')) return;
    const user = users.find(u => u.id === userId);
    if (user) {
      const updatedUser = { ...user };
      delete updatedUser.deviceId;
      onSaveUser(updatedUser);
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser.id) return;
    if (!window.confirm('Eliminare definitivamente questo utente?')) return;
    onDeleteUser(userId);
  };

  const handleDeleteMateriale = (matId: string) => {
    if (!window.confirm('Eliminare questo materiale dal listino?')) return;
    // Logic for deleteMateriale not in props but could be added or just use a generic update
    // For now I'll assume it's part of onAddMateriale or just ignore if not critical
  };

  const handleCopyCode = () => {
    if (company) {
      navigator.clipboard.writeText(company.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Conferma inserimento chiave a 4 cifre da parte dell'Amministratore
  const handleConfirmPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingModalUser || !company?.id) return;
    
    const cleanCode = pairingInputCode.trim().replace(/\D/g, '');
    if (cleanCode.length !== 4) {
      setPairingError('Inserisci la chiave a 4 cifre comunicata dall\'operatore.');
      return;
    }

    setPairingLoading(true);
    setPairingError('');
    setPairingSuccess('');

    try {
      const res = await firestoreService.approveMobilePairing(cleanCode, company.id, pairingModalUser.id);
      if (!res || !res.deviceId) {
        setPairingError('Codice non trovato o scaduto. Ricorda che la chiave a 4 cifre dura solo 2 minuti. Fai premere "Genera Nuova Chiave" sul cellulare del collaboratore.');
        setPairingLoading(false);
        return;
      }

      // Memorizza il deviceId sul profilo utente
      const updatedUser: UserAccount = {
        ...pairingModalUser,
        deviceId: res.deviceId
      };
      await onSaveUser(updatedUser);
      setPairingSuccess(`✓ Cellulare collegato con successo a ${pairingModalUser.name}! I dati del dispositivo sono stati memorizzati sul server e il cellulare è stato autorizzato all'accesso.`);

      setTimeout(() => {
        setPairingModalUser(null);
        setPairingInputCode('');
        setPairingSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Errore collegamento cellulare:', err);
      setPairingError('Errore durante il collegamento del cellulare.');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleUnlinkDevice = async (user: UserAccount) => {
    if (!window.confirm(`Vuoi scollegare il cellulare associato a ${user.name}? L'operatore non potrà più accedere da quel dispositivo senza una nuova autorizzazione.`)) {
      return;
    }
    try {
      const updated = { ...user, deviceId: undefined };
      await onSaveUser(updated);
      setPairingModalUser(updated);
      setPairingSuccess('Cellulare scollegato con successo.');
      setTimeout(() => setPairingSuccess(''), 2000);
    } catch (err) {
      console.error('Errore scollegamento cellulare:', err);
      setPairingError('Errore durante lo scollegamento.');
    }
  };

  const handleGeneratePairingCode = async (user: UserAccount) => {
    // Apri la finestra di inserimento dati per l'amministratore
    setPairingModalUser(user);
    setPairingInputCode('');
    setPairingError('');
    setPairingSuccess('');
  };

  const handleToggleAccredit = async (userId: string, cantiereId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const current = user.cantieriAccreditati || [];
    const updated = current.includes(cantiereId)
      ? current.filter(id => id !== cantiereId)
      : [...current, cantiereId];
      
    await onSaveUser({ ...user, cantieriAccreditati: updated });
    // Update local state for modal if open
    setUserToAccredit({ ...user, cantieriAccreditati: updated });
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-3.5 sm:px-8 pb-6 lg:pb-12 space-y-4 lg:space-y-8 overflow-x-hidden">
      
      {/* Mobile Responsive Admin Navigation Bar */}
      <div className="lg:hidden w-full bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-md overflow-x-auto flex items-center gap-1.5 scroll-smooth z-10 no-x-overflow">
        {[
          { id: 'panoramica', label: 'Panoramica', icon: PieChartIcon },
          { id: 'cantieri', label: 'Cantieri', icon: Building2 },
          { id: 'badge', label: 'Badge GPS', icon: Clock },
          { id: 'personale', label: 'Personale', icon: HardHat },
          { id: 'mezzi', label: 'Mezzi', icon: Wrench },
          { id: 'bolle', label: 'Bolle & DDT', icon: ReceiptText },
          { id: 'rapportini', label: 'Rapportini', icon: FileText },
          { id: 'utenti', label: 'Utenti', icon: Users },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isActive 
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        {/* Tab Content Display */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            
            {/* PANORAMICA */}
            {activeTab === 'panoramica' && (
              <motion.div 
                key="panoramica"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Header & Company Card */}
                <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
                  <div className="space-y-4">
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-500/20">
                        Admin Console
                      </div>
                      <VersionBadge variant="pill" />
                      <div className="h-1 w-8 bg-slate-800 rounded-full hidden sm:block"></div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">BENVENUTO, {currentUser.name.toUpperCase()}</span>
                    </motion.div>
                    <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.1]">
                      Il controllo della tua impresa <br /> 
                      <span className="text-slate-400">in tempo reale.</span>
                    </h2>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full lg:w-auto bg-slate-950 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl ring-1 ring-white/10"
                  >
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full"></div>
                    <div className="relative z-10 flex flex-col gap-6">
                      <div className="flex items-center justify-between gap-12">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Società Registrata</p>
                          <h3 className="text-xl font-bold text-white tracking-tight">{company?.name}</h3>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-2xl border border-white/5 shadow-inner">
                          <Building2 className="w-6 h-6 text-amber-500" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Codice Accesso Team</p>
                        <button 
                          onClick={handleCopyCode}
                          className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 border border-white/5 p-4 rounded-2xl group transition-all"
                        >
                          <span className="text-lg font-mono font-bold tracking-[0.2em] text-amber-500">{company?.code}</span>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 group-hover:text-white uppercase transition-colors">
                            {copiedCode ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedCode ? 'Copiato' : 'Copia'}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* KPI Command Center */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {[
                    { label: 'Cantieri Totali', value: cantieri.length, sub: 'In Corso & Sospesi', icon: Building2, color: 'text-amber-500', bg: 'bg-amber-500/5', border: 'border-amber-500/10' },
                    { label: 'Organico Team', value: personale.length, sub: 'Operativi Registrati', icon: HardHat, color: 'text-slate-500', bg: 'bg-slate-500/5', border: 'border-slate-500/10' },
                    { label: 'Mezzi Aziendali', value: mezzi.length, sub: 'Parco Macchine', icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-500/5', border: 'border-blue-500/10' },
                    { label: 'Rapportini Cloud', value: rapportini.length, sub: 'Inviati in Tempo Reale', icon: Cloud, color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/10' },
                  ].map((kpi, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`bg-white p-8 rounded-[32px] border ${kpi.border} shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className={`${kpi.bg} ${kpi.color} p-3 rounded-2xl`}>
                          <kpi.icon className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <MoreHorizontal className="w-5 h-5 text-slate-300" />
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                      <h4 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">{kpi.value}</h4>
                      <p className="text-xs font-medium text-slate-500">{kpi.sub}</p>
                    </motion.div>
                  ))}
                </div>

                {/* CENTRALE EVENTI OPERATIVI & RITMO DELLA MANOVRA */}
                <CentraleEventi
                  company={company}
                  cantieri={cantieri}
                  rapportini={rapportini}
                  documents={documents}
                  timbrature={timbrature}
                  materialRequests={materialRequests}
                  technicalDocs={technicalDocs}
                  contabilita={contabilita}
                  users={users}
                  onSelectCantiere={(c) => setSelectedCantiere(c)}
                  onOpenRapportino={(r) => setSelectedRapportino(r)}
                  onOpenDocument={() => setActiveTab('bolle')}
                  onOpenMaterialRequests={() => setActiveTab('bolle')}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold text-slate-900">Ultimi Rapportini</h3>
                      <button onClick={() => setActiveTab('rapportini')} className="text-[10px] font-bold text-amber-600 uppercase hover:underline">Vedi Tutti</button>
                    </div>
                    <div className="space-y-4">
                      {rapportini.length === 0 ? (
                        <div className="text-center py-12">
                          <Cloud className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                          <p className="text-xs font-bold text-slate-400">In attesa di dati dai cantieri...</p>
                        </div>
                      ) : (
                        rapportini.slice(0, 4).map(r => (
                          <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-amber-500/30 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-bold">
                                {r.userName.charAt(0)}
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-slate-900">{r.userName}</h5>
                                <p className="text-[10px] text-slate-500 font-medium">{formatItalianDate(r.date)}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rotate-45 translate-x-16 -translate-y-16 pointer-events-none"></div>
                    <div className="relative z-10">
                      <h3 className="text-lg font-bold text-slate-900 mb-8">Azioni Rapide</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button 
                          onClick={() => setShowAddCantiereModal(true)}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-amber-500 hover:text-slate-950 rounded-3xl border border-slate-100 transition-all group"
                        >
                          <Building2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Nuovo Cantiere</span>
                        </button>
                        <button 
                          onClick={() => setShowAddUserModal(true)}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-amber-500 hover:text-slate-950 rounded-3xl border border-slate-100 transition-all group"
                        >
                          <Users className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Nuovo Utente</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CANTIERI TAB */}
            {activeTab === 'cantieri' && (
              <motion.div 
                key="cantieri"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Controllo Progetti</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Gestione avanzamento lavori e squadre.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Cerca..." className="bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-1 focus:ring-amber-500/50 transition-all" />
                    </div>
                    <button onClick={() => setShowAddCantiereModal(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2">
                      <Plus className="w-4 h-4 stroke-[3]" /> Aggiungi
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cantieri Attivi</p>
                    <p className="text-2xl font-bold text-slate-900">{cantieri.filter(c => c.status === 'in_corso').length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Squadre in Campo</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {new Set(rapportini.filter(r => {
                        const today = new Date().toISOString().split('T')[0];
                        return r.date === today;
                      }).map(r => r.userId)).size} Operativi Oggi
                    </p>
                  </div>
                </div>

                {cantieri.length === 0 ? (
                  <div className="bg-white rounded-[40px] p-20 text-center border border-slate-200 shadow-sm">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Building2 className="w-12 h-12 text-slate-200" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Piattaforma Pronta.</h4>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">Crea il tuo primo cantiere per iniziare a monitorare costi, entrate e rapportini dal campo.</p>
                    <button onClick={() => setShowAddCantiereModal(true)} className="bg-slate-950 text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-900 transition-all">Inizia Ora</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {cantieri.map(c => {
                      const statusColor = c.status === 'in_corso' ? 'bg-emerald-500' : c.status === 'sospeso' ? 'bg-amber-500' : 'bg-slate-400';

                      // Calcolo esatto del valore dei materiali assegnati dall'amministrazione a questo cantiere
                      const cantiereAssignedMaterialsCost = (documents || [])
                        .filter(d => d.status !== 'annullato')
                        .reduce((acc, doc) => {
                          const docItemsCost = (doc.items || []).reduce((itemAcc, item) => {
                            const isAssigned = item.destinationCantiereId === c.id || (!item.destinationCantiereId && doc.destinationCantiereId === c.id);
                            if (isAssigned) {
                              const itemTot = Number(item.totalPrice) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
                              return itemAcc + itemTot;
                            }
                            return itemAcc;
                          }, 0);
                          return acc + docItemsCost;
                        }, 0) + (movements || [])
                        .filter(m => m.toId === c.id && !m.documentId && (m.type === 'trasferimento_cantiere' || m.type === 'carico_cantiere'))
                        .reduce((acc, m) => acc + ((Number(m.quantity) || 0) * (Number(m.costoUnitario) || 0)), 0);

                      const effectiveMaterialCost = cantiereAssignedMaterialsCost > 0 ? cantiereAssignedMaterialsCost : (Number(c.totalMaterialCost) || 0);

                      // Calcolo ore e costi personale dai rapportini
                      const cantiereRapportini = (rapportini || []).filter(r => r.cantiereId === c.id && r.status !== 'annullato');
                      const cantiereHoursFromRap = cantiereRapportini.reduce((sum, r) => {
                        const rapHours = (r.personnelHours || []).reduce((hSum, ph) => hSum + (Number(ph.hours) || 0), 0);
                        return sum + rapHours;
                      }, 0);
                      const effectiveHours = cantiereHoursFromRap > 0 ? cantiereHoursFromRap : (c.totalWorkHours || 0);

                      const cantiereLaborCostFromRap = cantiereRapportini.reduce((sum, r) => {
                        const rapLabor = (r.personnelHours || []).reduce((lSum, ph) => {
                          const pers = personale.find(p => p.id === ph.personnelId);
                          const rate = pers?.hourlyRate || 25;
                          return lSum + ((Number(ph.hours) || 0) * rate);
                        }, 0);
                        return sum + rapLabor;
                      }, 0);
                      const effectivePersonnelCost = cantiereLaborCostFromRap > 0 ? cantiereLaborCostFromRap : (Number(c.totalPersonnelCost) || 0);

                      const totalCost = effectiveMaterialCost + effectivePersonnelCost;

                      return (
                        <div key={c.id} className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-xl hover:border-amber-500/20 transition-all duration-300">
                          <div>
                            <div className="flex items-start justify-between mb-6">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`}></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{c.status.replace('_', ' ')}</span>
                              </div>
                              <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                <MoreHorizontal className="w-5 h-5 text-slate-400" />
                              </button>
                            </div>
                            
                            <h4 className="text-xl font-bold text-slate-900 mb-1">{c.name}</h4>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-6">
                              <MapPin className="w-3.5 h-3.5" /> {c.address}
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Ore Lavoro</p>
                                <p className="text-sm font-black text-slate-900">{effectiveHours}h</p>
                                <p className="text-[9px] font-medium text-slate-400">€{effectivePersonnelCost.toLocaleString('it-IT', { maximumFractionDigits: 0 })} m.o.</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Mat. Assegnati</p>
                                <p className="text-sm font-black text-amber-600">€{effectiveMaterialCost.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="text-[9px] font-medium text-slate-400">da bolle/ddt</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Costo Totale</p>
                                <p className="text-sm font-black text-emerald-700">€{totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="text-[9px] font-medium text-slate-400">materiali + ore</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Ultimo Rapportino</p>
                              <p className="text-sm font-bold text-slate-900">
                                {rapportini.filter(r => r.cantiereId === c.id).sort((a,b) => b.date.localeCompare(a.date))[0]?.date || 'Nessun invio'}
                              </p>
                            </div>
                            <button 
                              onClick={() => setSelectedCantiere(c)}
                              className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg group"
                            >
                              Dettagli <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* BADGE PRESENZE GPS TAB */}
            {activeTab === 'badge' && (
              <motion.div 
                key="badge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <BadgeManager
                  currentUser={currentUser}
                  cantieri={cantieri}
                  users={users}
                  timbrature={timbrature}
                  onSaveTimbratura={onSaveTimbratura}
                  onDeleteTimbratura={onDeleteTimbratura}
                />
              </motion.div>
            )}

            {/* PERSONALE TAB */}
            {activeTab === 'personale' && (
              <motion.div 
                key="personale"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Organico & Team</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Gestione dei collaboratori e disponibilità.</p>
                  </div>
                  <button onClick={() => setShowAddPersonaleModal(true)} className="bg-slate-950 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus className="w-4 h-4" /> Aggiungi Personale
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Forza Lavoro</p>
                    <p className="text-2xl font-bold text-slate-900">{personale.length} Operativi</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ore Totali (Mese)</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {rapportini.reduce((acc, r) => acc + r.personale.reduce((pAcc, p) => pAcc + p.ore, 0), 0)} h
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {personale.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[40px] p-20 text-center border border-slate-200 shadow-sm">
                      <HardHat className="w-12 h-12 text-slate-200 mx-auto mb-6" />
                      <h4 className="text-xl font-bold text-slate-900 mb-2">Nessun membro del team.</h4>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">Carica l'organico per visualizzare i collaboratori nei rapportini.</p>
                    </div>
                  ) : (
                    personale.map(p => (
                      <div key={p.id} className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm group hover:shadow-xl transition-all">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 font-black border border-slate-100">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900">{p.name}</h4>
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{p.role}</p>
                          </div>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-slate-50">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Telefono:</span>
                            <span className="font-bold text-slate-900">{p.phone || '-'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Costo Orario:</span>
                            <span className="font-bold text-emerald-600">€{p.hourlyRate || 0}/h</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Ultima Attività:</span>
                            <span className="font-bold text-amber-600">
                              {rapportini.filter(r => r.personale.some(pp => pp.personaleId === p.id)).sort((a,b) => b.date.localeCompare(a.date))[0]?.date || 'Mai'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* MEZZI TAB */}
            {activeTab === 'mezzi' && (
              <motion.div 
                key="mezzi"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Flotta Mezzi</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Monitoraggio parco macchine e operatività.</p>
                  </div>
                  <button onClick={() => setShowAddMezzoModal(true)} className="bg-slate-950 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus className="w-4 h-4" /> Aggiungi Mezzo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Parco Mezzi</p>
                    <p className="text-2xl font-bold text-slate-900">{mezzi.length} Unità</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ore Motore Totali</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {rapportini.reduce((acc, r) => acc + r.mezzi.reduce((mAcc, m) => mAcc + m.ore, 0), 0)} h
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {mezzi.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[40px] p-20 text-center border border-slate-200 shadow-sm">
                      <Wrench className="w-12 h-12 text-slate-200 mx-auto mb-6" />
                      <h4 className="text-xl font-bold text-slate-900 mb-2">Parco mezzi vuoto.</h4>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">Inserisci i mezzi aziendali per monitorarne l'utilizzo nei cantieri.</p>
                    </div>
                  ) : (
                    mezzi.map(m => (
                      <div key={m.id} className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm group hover:shadow-xl transition-all">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-500/10">
                            <Wrench className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900">{m.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.plate || 'SENZA TARGA'}</p>
                          </div>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-slate-50">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Tipologia:</span>
                            <span className="font-bold text-slate-900">{m.type}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Ultimo Utilizzo:</span>
                            <span className="font-bold text-amber-600">
                               {rapportini.filter(r => r.mezzi.some(mm => mm.mezzoId === m.id)).sort((a,b) => b.date.localeCompare(a.date))[0]?.date || 'Mai'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* MAGAZZINO TAB */}
            {activeTab === 'magazzino' && (
              <motion.div 
                key="magazzino"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Magazzino & Logistica</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Carico bolle, giacenze centrali e trasferimenti a cantiere.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleSeedSimulation}
                      disabled={isSeeding}
                      className="bg-amber-50 text-amber-600 px-5 py-3 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-2 hover:bg-amber-100 transition-all disabled:opacity-50"
                    >
                      <Cloud className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} /> Simula Dati
                    </button>
                    <button 
                      onClick={() => setShowAddMovementModal(true)} 
                      className="bg-amber-500 text-slate-950 px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-amber-600 transition-all"
                    >
                      <Box className="w-4 h-4" /> Nuovo Movimento
                    </button>
                    <button 
                      onClick={() => setActiveTab('bolle')} 
                      className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all"
                    >
                      <ReceiptText className="w-4 h-4 text-amber-500" /> Carica Bolla / DDT (PDF)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* GIACENZA CENTRALE */}
                  <div className="xl:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[32px] p-8 text-white">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                          <Box className="w-5 h-5 text-slate-950" />
                        </div>
                        <h4 className="font-bold">Magazzino Centrale</h4>
                      </div>
                      
                      <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {!company?.magazzinoCentrale || company.magazzinoCentrale.length === 0 ? (
                          <p className="text-slate-500 text-xs italic">Magazzino vuoto. Carica una bolla per iniziare.</p>
                        ) : (
                          company.magazzinoCentrale.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                              <div>
                                <p className="text-sm font-bold">{item.materialeName}</p>
                                <p className="text-[10px] text-slate-400">Valore: €{item.totalCost?.toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-amber-500">{item.quantity} {item.unit}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* DOCUMENTI REGISTRATI */}
                    <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500" /> Ultime Bolle/Fatture
                      </h4>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {documents.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Nessun documento registrato.</p>
                        ) : (
                          documents.map(d => (
                            <div key={d.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${d.type === 'bolla' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {d.type}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">{formatItalianDate(d.date)}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-900">{d.supplier}</p>
                              <div className="flex justify-between items-center mt-2">
                                <p className="text-[10px] text-slate-500">N. {d.number}</p>
                                <p className="text-xs font-black text-slate-900">€{d.totalAmount.toLocaleString()}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <button
                        onClick={() => setActiveTab('bolle')}
                        className="w-full mt-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <ReceiptText className="w-3.5 h-3.5 text-amber-600" />
                        Registro Bolle, Carica PDF & Spacchetta →
                      </button>
                    </div>
                  </div>

                  {/* ULTIMI MOVIMENTI */}
                  <div className="xl:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="font-bold text-slate-900">Registro Movimenti</h4>
                      <div className="bg-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-500">
                        {movements.length} Operazioni
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiale</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Quantità</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Stato</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {movements.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-4 text-xs font-medium text-slate-500">{formatItalianDate(m.date)}</td>
                              <td className="px-8 py-4">
                                <p className="text-sm font-bold text-slate-900">{m.materialeName}</p>
                                <p className="text-[10px] text-slate-400 italic">
                                  {m.fromId && `Da: ${m.fromId === 'centrale' ? 'Magazzino' : cantieri.find(c => c.id === m.fromId)?.name || m.fromId}`} 
                                  {m.toId && ` → A: ${m.toId === 'centrale' ? 'Magazzino' : cantieri.find(c => c.id === m.toId)?.name || m.toId}`}
                                </p>
                              </td>
                              <td className="px-8 py-4">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  m.type === 'carico_magazzino' ? 'bg-emerald-100 text-emerald-700' : 
                                  m.type === 'trasferimento_cantiere' ? 'bg-blue-100 text-blue-700' : 
                                  m.type === 'scarico_rapportino' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {m.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-8 py-4 text-sm font-black text-right text-slate-900">
                                {m.quantity}
                              </td>
                              <td className="px-8 py-4 text-center">
                                {m.type === 'trasferimento_cantiere' && m.status === 'pending' ? (
                                  <span className="text-[9px] font-bold text-amber-500 flex items-center justify-center gap-1">
                                    <Clock className="w-3 h-3" /> In Transito
                                  </span>
                                ) : m.type === 'trasferimento_cantiere' && m.status === 'accepted' ? (
                                  <span className="text-[9px] font-bold text-emerald-500 flex items-center justify-center gap-1">
                                    <Check className="w-3 h-3" /> Arrivato
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* BOLLE & DDT (PDF) TAB */}
            {activeTab === 'bolle' && (
              <motion.div 
                key="bolle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <BolleManager
                  documents={documents}
                  cantieri={cantieri}
                  materiali={materiali}
                  movements={movements}
                  currentUser={currentUser}
                  fornitori={fornitori}
                  onSaveFornitore={onSaveFornitore}
                  onDeleteFornitore={onDeleteFornitore}
                  onSaveDocument={async (d) => onAddDocument(d)}
                  onDeleteDocument={onDeleteDocument || (async () => {})}
                  onAnnullaDocument={onAnnullaDocument}
                  onRipristinaDocument={onRipristinaDocument}
                  onAcceptDocument={onAcceptDocument || (async () => {})}
                  onAcceptTransfer={onAcceptTransfer || (async () => {})}
                  onAddMateriale={async (m) => onAddMateriale(m)}
                  materialRequests={materialRequests}
                  onUpdateMaterialRequestStatus={onUpdateMaterialRequestStatus}
                />
              </motion.div>
            )}

            {/* MATERIALI TAB */}
            {activeTab === 'materiali' && (
              <motion.div 
                key="materiali"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Anagrafica Materiali</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Definisci i materiali che possono essere caricati in magazzino.</p>
                  </div>
                  <button onClick={() => setShowAddMaterialeModal(true)} className="bg-slate-950 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus className="w-4 h-4" /> Nuovo Materiale
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {materiali.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[40px] p-20 text-center border border-slate-200 shadow-sm">
                      <Box className="w-12 h-12 text-slate-200 mx-auto mb-6" />
                      <p className="text-sm text-slate-500">Nessun materiale in anagrafica.</p>
                    </div>
                  ) : (
                    materiali.map(m => (
                      <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{m.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{m.category}</p>
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-600">
                          {m.unit}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* RAPPORTINI TAB */}
            {activeTab === 'rapportini' && (() => {
              const filteredAdminRapportini = rapportini
                .filter(r => {
                  if (rapportiniFilterCantiere !== 'all' && r.cantiereId !== rapportiniFilterCantiere) return false;
                  if (rapportiniFilterStatus === 'valido' && r.status === 'annullato') return false;
                  if (rapportiniFilterStatus === 'annullato' && r.status !== 'annullato') return false;
                  if (rapportiniSearch.trim()) {
                    const q = rapportiniSearch.toLowerCase();
                    const cName = (cantieri.find(c => c.id === r.cantiereId)?.name || '').toLowerCase();
                    const uName = (users.find(u => u.id === r.userId)?.name || r.userName || '').toLowerCase();
                    const note = (r.note || '').toLowerCase();
                    const num = (r.numeroProgressivo ? `n° ${r.numeroProgressivo}` : '').toLowerCase();
                    if (!cName.includes(q) && !uName.includes(q) && !note.includes(q) && !num.includes(q)) return false;
                  }
                  return true;
                })
                .sort((a, b) => {
                  const dateA = `${a.date}T${a.ora || '00:00:00'}`;
                  const dateB = `${b.date}T${b.ora || '00:00:00'}`;
                  return dateB.localeCompare(dateA);
                });

              const adminValidiCount = rapportini.filter(r => r.status !== 'annullato').length;
              const adminAnnullatiCount = rapportini.filter(r => r.status === 'annullato').length;

              return (
                <motion.div 
                  key="rapportini"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="sticky top-0 z-20 bg-slate-50 pb-4 pt-4 shadow-sm border-b border-slate-200/50 mb-6 -mx-4 px-4 sm:-mx-8 sm:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">Rapportini Cloud & Tracciabilità</h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">
                          Archivio completo numerato progressivamente per cantiere, con orario di emissione e storico annullamenti.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRapportiniFilterStatus('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            rapportiniFilterStatus === 'all'
                              ? 'bg-slate-950 text-white'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Tutti ({rapportini.length})
                        </button>
                        <button
                          onClick={() => setRapportiniFilterStatus('valido')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            rapportiniFilterStatus === 'valido'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Validi ({adminValidiCount})
                        </button>
                        <button
                          onClick={() => setRapportiniFilterStatus('annullato')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            rapportiniFilterStatus === 'annullato'
                              ? 'bg-rose-600 text-white'
                              : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> Annullati ({adminAnnullatiCount})
                        </button>
                      </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="relative sm:col-span-2">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Cerca per cantiere, operatore, note o N° progressivo..."
                          value={rapportiniSearch}
                          onChange={(e) => setRapportiniSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 shadow-sm"
                        />
                      </div>

                      <select
                        value={rapportiniFilterCantiere}
                        onChange={(e) => setRapportiniFilterCantiere(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white rounded-2xl border border-slate-200 text-xs text-slate-700 focus:outline-hidden focus:border-amber-500 shadow-sm"
                      >
                        <option value="all">Tutti i Cantieri ({cantieri.length})</option>
                        {cantieri.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {filteredAdminRapportini.length === 0 ? (
                      <div className="bg-white rounded-[32px] p-16 text-center border border-slate-200 shadow-xs">
                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-slate-900 mb-1">Nessun rapportino trovato.</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">Nessun documento corrisponde ai criteri di filtro impostati.</p>
                      </div>
                    ) : (
                      filteredAdminRapportini.map(r => {
                        const isAnnullato = r.status === 'annullato';
                        const cantiereObj = cantieri.find(c => c.id === r.cantiereId);
                        const userObj = users.find(u => u.id === r.userId);

                        return (
                          <div 
                            key={r.id} 
                            className={`bg-white p-5 rounded-[24px] border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all ${
                              isAnnullato 
                                ? 'border-rose-200 bg-rose-50/15' 
                                : 'border-slate-200 hover:border-amber-500/40'
                            }`}
                          >
                            <div className="flex items-start sm:items-center gap-4">
                              {/* Progressive Number Badge */}
                              <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-mono font-black shrink-0 ${
                                isAnnullato
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-slate-950 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors'
                              }`}>
                                <span className="text-[8px] tracking-tighter uppercase leading-none opacity-80">PROG</span>
                                <span className="text-sm font-black leading-none mt-0.5">{r.numeroProgressivo ? `N°${r.numeroProgressivo}` : '—'}</span>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={`text-sm font-bold ${isAnnullato ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                    {cantiereObj?.name || 'Cantiere'}
                                  </h4>
                                  {isAnnullato ? (
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                      Annullato
                                    </span>
                                  ) : r.isNonLavorato ? (
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                                      Non Lavorato
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Valido
                                    </span>
                                  )}
                                  {r.sostituisceNumero && (
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Rifacimento N° {r.sostituisceNumero}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                  <span>Data: <strong className="text-slate-700">{formatItalianDate(r.date)}</strong></span>
                                  <span>Ora emissione: <strong className="text-amber-600 font-mono">{r.ora || 'N/D'}</strong></span>
                                  <span>Emesso da: <strong className="text-slate-700">{userObj?.name || r.userName}</strong></span>
                                </div>

                                {isAnnullato && r.motivoAnnullamento && (
                                  <p className="text-xs text-rose-700 bg-rose-100/60 px-2.5 py-1 rounded-lg italic">
                                    Annullato da {r.annullatoDa || 'Operatore'} ({r.annullatoIl || 'Data non disp.'}): "{r.motivoAnnullamento}"
                                  </p>
                                )}

                                {!isAnnullato && r.note && (
                                  <p className="text-xs text-slate-500 line-clamp-1 italic">
                                    "{r.note}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                              {r.foto && r.foto.length > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
                                  <Camera className="w-3.5 h-3.5" /> {r.foto.length}
                                </span>
                              )}
                              <button 
                                onClick={() => setSelectedRapportino(r)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-950 hover:text-white rounded-xl text-xs font-bold transition-all"
                              >
                                Esamina Dettagli
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              );
            })()}

            {/* UTENTI TAB */}
            {activeTab === 'utenti' && (
              <motion.div 
                key="utenti"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 w-full max-w-full overflow-x-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900">Sicurezza & Permessi Server</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Gestisci ruoli, autorizzazioni per cantiere e dispositivi collegati.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingUser(null);
                      setNewUser({
                        name: '',
                        username: '',
                        role: 'capo_cantiere',
                        phone: '',
                        cantiereId: '',
                        permissions: { ...DEFAULT_ROLE_PERMISSIONS.capo_cantiere }
                      });
                      setShowAddUserModal(true);
                    }} 
                    className="bg-slate-950 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-xl flex items-center justify-center gap-2 hover:bg-slate-900 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4 text-amber-400 stroke-[3]" /> Nuovo Account
                  </button>
                </div>

                {/* DESKTOP TABLE VIEW */}
                <div className="hidden lg:block bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utente</th>
                          <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ruolo & Permessi</th>
                          <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accesso Cantieri</th>
                          <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cellulare</th>
                          <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stato</th>
                          <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {users.map(u => {
                          const userRoleLabel = ROLE_LABELS[u.role] || u.role;
                          const perms = u.permissions || DEFAULT_ROLE_PERMISSIONS[u.role] || DEFAULT_ROLE_PERMISSIONS.operativo;

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3.5">
                                  <div className={`w-10 h-10 rounded-xl font-black flex items-center justify-center transition-all shrink-0 ${
                                    u.active ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {u.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-bold ${u.active ? 'text-slate-900' : 'text-slate-400 italic'}`}>{u.name}</p>
                                    <p className="text-[10px] font-mono text-slate-500">{u.username}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-5">
                                <div className="space-y-1">
                                  <span className={`inline-block text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-tight ${
                                    u.role === 'admin' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                                    u.role === 'dirigente' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                                    u.role === 'capo_cantiere' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {userRoleLabel}
                                  </span>

                                  <div className="flex flex-wrap gap-1 max-w-[240px] pt-0.5">
                                    {perms.rapportini && <span className="text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.2 rounded">📋 Rapportini</span>}
                                    {perms.documentale && <span className="text-[8px] font-bold bg-blue-50 text-blue-800 border border-blue-200/60 px-1.5 py-0.2 rounded">📦 Doc & Bolle</span>}
                                    {perms.chatta && <span className="text-[8px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-1.5 py-0.2 rounded">💬 Chat</span>}
                                    {perms.amministrativo && <span className="text-[8px] font-bold bg-purple-50 text-purple-800 border border-purple-200/60 px-1.5 py-0.2 rounded">💶 Amministr.</span>}
                                    {perms.tecnico && <span className="text-[8px] font-bold bg-slate-100 text-slate-800 border border-slate-200 px-1.5 py-0.2 rounded">🛠️ Tecnico</span>}
                                    {!perms.canEdit && <span className="text-[8px] font-black bg-amber-500/20 text-amber-900 border border-amber-500/40 px-1.5 py-0.2 rounded">👁️ Sola Lettura</span>}
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-5">
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {u.role === 'admin' || u.role === 'dirigente' ? (
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider italic">Tutti i cantieri</span>
                                  ) : (
                                    <>
                                      {(u.cantieriAccreditati || []).length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {(u.cantieriAccreditati || []).map(cid => {
                                            const c = cantieri.find(ct => ct.id === cid);
                                            return (
                                              <span key={cid} className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                                {c?.name.split(' ')[0] || 'N/A'}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Nessuno</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-5">
                                {u.deviceId ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Collegato
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                                    <Smartphone className="w-3.5 h-3.5 text-slate-300" /> Non associato
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => onSaveUser({ ...u, active: !u.active })}
                                    className={`w-9 h-5 rounded-full transition-all relative ${u.active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                  >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${u.active ? 'left-4.5' : 'left-0.5'}`}></div>
                                  </button>
                                  <span className={`text-[10px] font-bold uppercase ${u.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {u.active ? 'Attivo' : 'Spento'}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleStartEditUser(u)}
                                    className="p-2 hover:bg-amber-50 border border-transparent hover:border-amber-200 rounded-xl transition-all group"
                                    title="Modifica Ruolo & Permessi"
                                  >
                                    <Edit3 className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                                  </button>

                                  <button 
                                    onClick={() => handleGeneratePairingCode(u)}
                                    className="p-2 hover:bg-amber-50 border border-transparent hover:border-amber-200 rounded-xl transition-all group" 
                                    title="Collega Cellulare con Chiave a 4 Cifre"
                                  >
                                    <KeyRound className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                                  </button>

                                  {u.role !== 'admin' && (
                                    <button 
                                      onClick={() => setUserToAccredit(u)}
                                      className="p-2 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl transition-all group" 
                                      title="Gestisci Accesso Cantieri"
                                    >
                                      <Building2 className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                                    </button>
                                  )}

                                  <button 
                                    onClick={() => handleResetDevice(u.id)}
                                    className="p-2 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl transition-all group" 
                                    title="Reset Dispositivo (Scollega Cellulare)"
                                  >
                                    <Smartphone className="w-4 h-4 text-slate-400 group-hover:text-sky-500" />
                                  </button>

                                  <button 
                                    onClick={() => handleResetPassword(u.id)}
                                    className="p-2 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl transition-all group" 
                                    title="Reset Password (1234)"
                                  >
                                    <Shield className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                  </button>

                                  {u.id !== currentUser.id && (
                                    <button 
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="p-2 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-all group"
                                      title="Elimina Utente"
                                    >
                                      <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MOBILE VIEW FOR UTENTI (VERTICAL STACKED CARDS - 0 HORIZONTAL SCROLL) */}
                <div className="block lg:hidden space-y-4 w-full max-w-full">
                  {users.map(u => {
                    const userRoleLabel = ROLE_LABELS[u.role] || u.role;
                    const perms = u.permissions || DEFAULT_ROLE_PERMISSIONS[u.role] || DEFAULT_ROLE_PERMISSIONS.operativo;

                    return (
                      <div key={u.id} className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 ${
                              u.active ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${u.active ? 'text-slate-900' : 'text-slate-400 italic'}`}>{u.name}</p>
                              <p className="text-[10px] font-mono text-slate-500">{u.username}</p>
                              <span className={`inline-block mt-1 text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-tight ${
                                u.role === 'admin' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                                u.role === 'dirigente' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                                u.role === 'capo_cantiere' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {userRoleLabel}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onSaveUser({ ...u, active: !u.active })}
                              className={`w-9 h-5 rounded-full transition-all relative ${u.active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${u.active ? 'left-4.5' : 'left-0.5'}`}></div>
                            </button>
                          </div>
                        </div>

                        {/* Permessi Assegnati */}
                        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Permessi & Moduli Server</p>
                          <div className="flex flex-wrap gap-1">
                            {perms.rapportini && <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">📋 Rapportini</span>}
                            {perms.documentale && <span className="text-[9px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">📦 Doc & Bolle</span>}
                            {perms.chatta && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md">💬 Chat</span>}
                            {perms.amministrativo && <span className="text-[9px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md">💶 Amministrazione</span>}
                            {perms.tecnico && <span className="text-[9px] font-bold bg-slate-200 text-slate-900 px-2 py-0.5 rounded-md">🛠️ Tecnico</span>}
                            {!perms.canEdit && <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">👁️ Sola Lettura</span>}
                          </div>
                        </div>

                        {/* Status Cellulare */}
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          {u.deviceId ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-emerald-600" /> Cellulare Collegato
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200 inline-flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-slate-300" /> Cellulare Non Associato
                            </span>
                          )}
                        </div>

                        {/* Pulsanti Azione */}
                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleStartEditUser(u)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Modifica Permessi</span>
                          </button>
                          <button
                            onClick={() => handleGeneratePairingCode(u)}
                            className="p-2 bg-slate-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors"
                            title="Collega Cellulare"
                          >
                            <KeyRound className="w-4 h-4 text-amber-600" />
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => setUserToAccredit(u)}
                              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                              title="Accesso Cantieri"
                            >
                              <Building2 className="w-4 h-4 text-slate-600" />
                            </button>
                          )}
                          <button
                            onClick={() => handleResetDevice(u.id)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            title="Reset Device"
                          >
                            <Smartphone className="w-4 h-4 text-sky-600" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(u.id)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            title="Reset Password"
                          >
                            <Shield className="w-4 h-4 text-amber-600" />
                          </button>
                          {u.id !== currentUser.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors"
                              title="Elimina Utente"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Modals are kept simple for functionality but could be themed similarly */}
      {showAddCantiereModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Nuovo Cantiere Pro</h3>
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <Building2 className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreateCantiere} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Ragione / Nome del Cantiere *</label>
                <input 
                  type="text" 
                  value={newCantiere.name}
                  onChange={e => setNewCantiere({...newCantiere, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                  required 
                />
              </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Cliente *</label>
          <input 
            type="text" 
            value={newCantiere.client}
            onChange={e => setNewCantiere({...newCantiere, client: e.target.value})}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
            required 
          />
        </div>
      </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddCantiereModal(false)}
                  className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs hover:bg-slate-200 transition-colors"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all"
                >
                  Crea Cantiere
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Personale Modal */}
      {showAddPersonaleModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Nuovo Membro Team</h3>
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <HardHat className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreatePersonale} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome e Cognome *</label>
                <input 
                  type="text" 
                  value={newPers.name}
                  onChange={e => setNewPers({...newPers, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                  required 
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Ruolo Operativo *</label>
                  <select 
                    value={newPers.role}
                    onChange={e => setNewPers({...newPers, role: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  >
                    <option value="Capocantiere">Capocantiere</option>
                    <option value="Muratore Specializzato">Muratore Specializzato</option>
                    <option value="Operaio Generico">Operaio Generico</option>
                    <option value="Gruista">Gruista</option>
                    <option value="Tecnico">Tecnico</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Contatto Telefonico</label>
                  <input 
                    type="text" 
                    value={newPers.phone}
                    onChange={e => setNewPers({...newPers, phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Costo Orario (€/h) *</label>
                  <input 
                    type="number" 
                    value={newPers.hourlyRate}
                    onChange={e => setNewPers({...newPers, hourlyRate: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddPersonaleModal(false)}
                  className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all"
                >
                  Registra Membro
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Mezzo Modal */}
      {showAddMezzoModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Nuovo Mezzo Aziendale</h3>
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <Wrench className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreateMezzo} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome / Modello Mezzo *</label>
                  <input 
                    type="text" 
                    value={newMenz.name}
                    onChange={e => setNewMenz({...newMenz, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Targa / ID *</label>
                  <input 
                    type="text" 
                    value={newMenz.plate}
                    onChange={e => setNewMenz({...newMenz, plate: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Tipologia *</label>
                  <select 
                    value={newMenz.type}
                    onChange={e => setNewMenz({...newMenz, type: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  >
                    <option value="Escavatore">Escavatore</option>
                    <option value="Furgone">Furgone</option>
                    <option value="Autocarro">Autocarro</option>
                    <option value="Piattaforma">Piattaforma</option>
                    <option value="Bettoniera">Bettoniera</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddMezzoModal(false)}
                  className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all"
                >
                  Registra Mezzo
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Gestione Utenze Server
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  {editingUser ? 'Modifica Account & Permessi' : 'Nuovo Membro Cloud'}
                </h3>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <Users className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome Completo *</label>
                <input 
                  type="text" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:border-amber-500 font-medium"
                  required 
                  placeholder="es. Geom. Marco Bianchi"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Username (per Login) *</label>
                  <input 
                    type="text" 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:border-amber-500 font-mono"
                    required 
                    placeholder="es. marco.bianchi"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Ruolo Piattaforma *</label>
                  <select 
                    value={newUser.role}
                    onChange={e => {
                      const selectedRole = e.target.value as UserRole;
                      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[selectedRole] || DEFAULT_ROLE_PERMISSIONS.capo_cantiere;
                      setNewUser({
                        ...newUser,
                        role: selectedRole,
                        permissions: { ...defaultPerms }
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="capo_cantiere">Capo Cantiere</option>
                    <option value="lavoratore">Lavoratore (Badge & Presenze)</option>
                    <option value="geometra_contabile">Geometra Contabile</option>
                    <option value="amministrativo_contabile">Amministrativo Contabile</option>
                    <option value="dirigente">Dirigente (Supervisione Sola Lettura)</option>
                    <option value="admin">Amministratore Server</option>
                    <option value="operativo">Operatore / Operaio</option>
                  </select>
                </div>
              </div>

              {/* DESCRIZIONE AUTORIZZAZIONI E CAPACITÀ ASSEGNATE IN AUTOMATICO DAL RUOLO */}
              <div className="space-y-3 bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-800 text-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Permessi & Funzionalità Assegnati in Automatico
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-700">
                    {ROLE_LABELS[newUser.role] || newUser.role}
                  </span>
                </div>

                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  {ROLE_DESCRIPTIONS[newUser.role] || 'Permessi automatici impostati.'}
                </p>

                {/* Synthesis Pills of Role Abilities */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${newUser.permissions?.rapportini ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 line-through'}`}>
                    📋 Rapportini {newUser.permissions?.rapportini ? 'Abilitati' : 'Disabilitati'}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${newUser.permissions?.documentale ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 line-through'}`}>
                    📦 Bolle & Documenti {newUser.permissions?.documentale ? 'Abilitati' : 'Disabilitati'}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${newUser.permissions?.chatta ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 line-through'}`}>
                    💬 Chat Cantiere {newUser.permissions?.chatta ? 'Abilitata' : 'Disabilitata'}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${newUser.permissions?.amministrativo ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 line-through'}`}>
                    💶 Contabilità {newUser.permissions?.amministrativo ? 'Abilitata' : 'Esclusa'}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${newUser.permissions?.canEdit ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                    {newUser.permissions?.canEdit ? '✏️ Gestione & Modifica' : '👁️ Vista Consultativa'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Telefono Cellulare (facoltativo)</label>
                <input 
                  type="text" 
                  value={newUser.phone}
                  onChange={e => setNewUser({...newUser, phone: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:border-amber-500 font-medium"
                  placeholder="es. +39 333 1234567"
                />
              </div>

              {!editingUser && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-700 uppercase mb-0.5">Nota Sicurezza</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    La password iniziale per l'accesso sarà <span className="font-bold">1234</span>. L'utente dovrà cambiarla al primo login.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddUserModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3.5 rounded-2xl text-xs transition-colors"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-slate-950 text-white font-bold py-3.5 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>{editingUser ? 'Salva Permessi & Ruolo' : 'Crea Account'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Cantiere Detail & Hub Modal */}
      {selectedCantiere && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
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
              onOpenRapportinoDetail={(r) => setSelectedRapportino(r)}
              onClose={() => setSelectedCantiere(null)}
              onOpenPhotoLightbox={(url) => setAdminLightboxPhoto(url)}
              materialRequests={materialRequests}
              onSaveMaterialRequest={onSaveMaterialRequest}
              onUpdateMaterialRequestStatus={onUpdateMaterialRequestStatus}
              materialiArchive={materiali}
              onAcceptDocument={onAcceptDocument}
              onSaveDocument={onAddDocument}
              onAddMateriale={onAddMateriale}
            />
          </div>
        </div>
      )}

      {/* Personale Detail Modal */}
      {selectedPersonale && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full p-10 border border-slate-200 overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-black">
                  {selectedPersonale.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{selectedPersonale.name}</h3>
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-widest">{selectedPersonale.role}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPersonale(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ore Totali (Cloud)</p>
                  <p className="text-2xl font-black text-slate-900">
                    {rapportini.reduce((acc, r) => acc + (r.personnelHours.find(ph => ph.personnelId === selectedPersonale.id)?.hours || 0), 0)} h
                  </p>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Aziendale</p>
                  <p className="text-2xl font-black text-emerald-600">
                    €{(rapportini.reduce((acc, r) => acc + (r.personnelHours.find(ph => ph.personnelId === selectedPersonale.id)?.hours || 0), 0) * (selectedPersonale.hourlyRate || 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" /> Storico Presenze & Cantieri
                </h4>
                <div className="space-y-2">
                  {rapportini
                    .filter(r => r.personnelHours.some(ph => ph.personnelId === selectedPersonale.id))
                    .sort((a,b) => b.date.localeCompare(a.date))
                    .map(r => (
                      <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{formatItalianDate(r.date)}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-medium">
                            {cantieri.find(c => c.id === r.cantiereId)?.name || 'Cantiere Sconosciuto'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-black text-amber-600">
                            {r.personnelHours.find(ph => ph.personnelId === selectedPersonale.id)?.hours} ore
                          </span>
                          <button 
                            onClick={() => {
                              setSelectedRapportino(r);
                              setSelectedPersonale(null);
                            }}
                            className="p-2 bg-white rounded-xl shadow-sm text-slate-400 hover:text-amber-500 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-10">
              <button 
                onClick={() => setSelectedPersonale(null)}
                className="w-full bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl"
              >
                Chiudi Scheda
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Rapportino Detail Modal */}
      {selectedRapportino && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full p-10 border border-slate-200 overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg font-mono font-black text-xs bg-slate-950 text-amber-400">
                    Prog. Cantiere N° {selectedRapportino.numeroProgressivo || '—'}
                  </span>
                  {selectedRapportino.status === 'annullato' ? (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                      Annullato
                    </span>
                  ) : selectedRapportino.isNonLavorato ? (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                      Non Lavorato
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Valido
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  {cantieri.find(c => c.id === selectedRapportino.cantiereId)?.name || 'Cantiere'}
                </h3>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                  <span>Data: <strong className="text-slate-700">{formatItalianDate(selectedRapportino.date)}</strong></span>
                  <span>Ora emissione: <strong className="text-amber-600 font-mono">{selectedRapportino.ora || 'N/D'}</strong></span>
                  <span>Emesso da: <strong className="text-slate-700">{users.find(u => u.id === selectedRapportino.userId)?.name || selectedRapportino.userName}</strong></span>
                </div>
              </div>
              <button onClick={() => setSelectedRapportino(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Status & Replacement Notice */}
            <div className="mb-6 space-y-3">
              {selectedRapportino.status === 'annullato' ? (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-3xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Rapportino Annullato Ufficialmente</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 uppercase bg-rose-200/70 px-2 py-0.5 rounded-md">
                      Stornato
                    </span>
                  </div>
                  <p className="text-xs text-rose-800">
                    Annullato da <strong>{selectedRapportino.annullatoDa || 'Amministratore'}</strong> il {selectedRapportino.annullatoIl || 'Data non disponibile'}
                  </p>
                  <div className="bg-white/90 p-3 rounded-2xl border border-rose-200 text-xs text-rose-900 font-mono">
                    <span className="font-bold">Motivo dell'annullamento:</span> {selectedRapportino.motivoAnnullamento || 'Nessuna motivazione specificata'}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Rapportino Valido e Contabilizzato a Cantiere</span>
                  </div>
                  {onCancelRapportino && (
                    <button
                      onClick={() => setShowAdminCancelDialog(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> Annulla Rapportino
                    </button>
                  )}
                </div>
              )}

              {selectedRapportino.sostituisceNumero && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Rifacimento a sostituzione del <strong>Rapportino N° {selectedRapportino.sostituisceNumero}</strong> precedentemente annullato.</span>
                </div>
              )}
            </div>

            <div className="space-y-8">
              {/* Cantiere Info */}
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3 mb-4 text-amber-500">
                  <Building2 className="w-5 h-5" />
                  <span className="font-bold text-sm uppercase tracking-widest">Cantiere</span>
                </div>
                <p className="text-lg font-black text-slate-900">{cantieri.find(c => c.id === selectedRapportino.cantiereId)?.name}</p>
                <p className="text-xs text-slate-500">{cantieri.find(c => c.id === selectedRapportino.cantiereId)?.address}</p>
              </div>

              {/* Ore Lavorate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <HardHat className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Personale</span>
                  </div>
                  <div className="space-y-2">
                    {(selectedRapportino.personale || []).map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                        <span className="text-xs font-bold text-slate-700">{p.nome}</span>
                        <span className="text-xs font-black text-amber-600">{p.ore}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Wrench className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Mezzi</span>
                  </div>
                  <div className="space-y-2">
                    {(selectedRapportino.mezzi || []).map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                        <span className="text-xs font-bold text-slate-700">{m.nome}</span>
                        <span className="text-xs font-black text-blue-600">{m.ore}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Materiali Usati */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Box className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Materiali Impiegati</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(selectedRapportino.materiali || []).map((mu, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                      <span className="text-xs font-bold text-slate-700">{mu.materialeName}</span>
                      <span className="text-xs font-black text-emerald-600">{mu.quantity} {mu.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Foto Documentation */}
              {selectedRapportino.foto && selectedRapportino.foto.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Camera className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Foto Cantiere</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedRapportino.foto.map((f, i) => (
                      <div 
                        key={i} 
                        className="aspect-square rounded-2xl overflow-hidden border border-slate-200 cursor-pointer relative group shadow-xs hover:border-amber-500/50 transition-colors"
                        onClick={() => setAdminLightboxPhoto(f)}
                      >
                        <img src={f} alt={`Foto Cantiere ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white bg-slate-950/80 px-2.5 py-1 rounded-lg backdrop-blur-xs">
                            Ingrandisci
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Note */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Note di Cantiere</span>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl text-sm text-slate-600 leading-relaxed italic">
                  "{selectedRapportino.note}"
                </div>
              </div>
            </div>

            <div className="pt-10 flex gap-4">
              <button 
                onClick={() => setSelectedRapportino(null)}
                className="w-full bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl"
              >
                Chiudi
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Admin Cancel Confirmation Dialog */}
      {showAdminCancelDialog && selectedRapportino && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[300] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full p-8 border border-rose-200 space-y-6"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Annulla Rapportino Ufficiale</h4>
                <p className="text-xs text-slate-500">
                  Prog. N° {selectedRapportino.numeroProgressivo || '—'} • {cantieri.find(c => c.id === selectedRapportino.cantiereId)?.name}
                </p>
              </div>
            </div>

            <div className="p-4 bg-rose-50 rounded-2xl text-xs text-rose-900 space-y-1">
              <p className="font-bold">Tracciabilità e Storno Automatico:</p>
              <p>
                Questo rapportino verrà marcato come <strong>ANNULLATO</strong>. 
                Tutte le ore del personale e dei mezzi verranno stornate dal computo del cantiere.
                L'operazione è tracciata in modo permanente e non eliminabile.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Motivazione obbligatoria dell'annullamento <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={adminCancelReason}
                onChange={(e) => setAdminCancelReason(e.target.value)}
                placeholder="Es: Errore ore operaio Rossi, inserito cantiere errato..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-rose-500 focus:bg-white resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isAdminCancelling}
                onClick={() => {
                  setShowAdminCancelDialog(false);
                  setAdminCancelReason('');
                }}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Indietro
              </button>
              <button
                type="button"
                disabled={isAdminCancelling || !adminCancelReason.trim()}
                onClick={handleAdminCancelRapportino}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isAdminCancelling ? 'Annullando...' : 'Conferma Annulla'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Document Modal (Bolla/Fattura) */}
      {showAddDocumentModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-4xl w-full p-10 border border-slate-200 overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Registrazione Acquisto</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Carica bolle o fatture per aggiornare il magazzino e i costi fornitori.</p>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <FileText className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreateDocument} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Tipo Documento</label>
                  <select 
                    value={newDocument.type}
                    onChange={e => setNewDocument({...newDocument, type: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none font-bold"
                  >
                    <option value="bolla">Bolla (DDT)</option>
                    <option value="fattura">Fattura</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">N. Documento *</label>
                  <input 
                    type="text" 
                    value={newDocument.number}
                    onChange={e => setNewDocument({...newDocument, number: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                    placeholder="es. 123/A"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Data *</label>
                  <input 
                    type="date" 
                    value={newDocument.date}
                    onChange={e => setNewDocument({...newDocument, date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none font-bold"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Fornitore *</label>
                  <input 
                    type="text" 
                    value={newDocument.supplier}
                    onChange={e => setNewDocument({...newDocument, supplier: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                    placeholder="Nome fornitore"
                    required 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">Righe Materiale</h4>
                  <button 
                    type="button" 
                    onClick={handleAddDocumentItem}
                    className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1 hover:text-amber-700"
                  >
                    <Plus className="w-3 h-3" /> Aggiungi Riga
                  </button>
                </div>

                <div className="space-y-3">
                  {newDocument.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Materiale</label>
                        <select 
                          value={item.materialeId}
                          onChange={e => {
                            if (e.target.value === 'new') {
                              const name = prompt('Inserisci nome nuovo materiale:');
                              const unit = prompt('Unità di misura (es. mc, kg):', 'mc');
                              if (name && unit) {
                                const mId = 'mat-' + Date.now();
                                onAddMateriale({ id: mId, name, unit, category: 'Edili', defaultPrice: 0 });
                                const updatedItems = [...newDocument.items];
                                updatedItems[idx].materialeId = mId;
                                setNewDocument({...newDocument, items: updatedItems});
                              }
                              return;
                            }
                            const updatedItems = [...newDocument.items];
                            updatedItems[idx].materialeId = e.target.value;
                            setNewDocument({...newDocument, items: updatedItems});
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none"
                          required
                        >
                          <option value="">Seleziona...</option>
                          <option value="new" className="text-amber-600 font-bold">+ AGGIUNGI NUOVO MATERIALE...</option>
                          {materiali.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Quantità</label>
                        <input 
                          type="number" 
                          step="any"
                          value={item.quantity}
                          onChange={e => {
                            const updatedItems = [...newDocument.items];
                            updatedItems[idx].quantity = Number(e.target.value);
                            setNewDocument({...newDocument, items: updatedItems});
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none font-bold"
                          required
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Prezzo Unit. (€)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={item.unitPrice}
                          onChange={e => {
                            const updatedItems = [...newDocument.items];
                            updatedItems[idx].unitPrice = Number(e.target.value);
                            setNewDocument({...newDocument, items: updatedItems});
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none font-bold"
                          required
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-center pb-2">
                        <button 
                          type="button" 
                          onClick={() => {
                            if (newDocument.items.length === 1) return;
                            const updatedItems = newDocument.items.filter((_, i) => i !== idx);
                            setNewDocument({...newDocument, items: updatedItems});
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-[32px] p-8 flex items-center justify-between text-white">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Totale Documento</p>
                  <p className="text-3xl font-black text-amber-500">
                    €{newDocument.items.reduce((acc, i) => acc + (typeof i.totalPrice === 'number' ? i.totalPrice : (i.quantity * (i.unitPrice || 0))), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowAddDocumentModal(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-2xl text-xs transition-all">Annulla</button>
                  <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-12 py-4 rounded-2xl text-xs shadow-xl transition-all">Registra Documento</button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Materiale Modal */}
      {showAddMaterialeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Configurazione Materiale</h3>
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <List className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreateMateriale} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome Materiale *</label>
                <input 
                  type="text" 
                  value={newMateriale.name}
                  onChange={e => setNewMateriale({...newMateriale, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  placeholder="es. Cemento RCK 30"
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Unità di Misura *</label>
                  <input 
                    type="text" 
                    value={newMateriale.unit}
                    onChange={e => setNewMateriale({...newMateriale, unit: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                    placeholder="es. mc, kg, mt"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Categoria</label>
                  <select 
                    value={newMateriale.category}
                    onChange={e => setNewMateriale({...newMateriale, category: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  >
                    <option value="Edili">Edili</option>
                    <option value="Idraulici">Idraulici</option>
                    <option value="Elettrici">Elettrici</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddMaterialeModal(false)} className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs">Annulla</button>
                <button type="submit" className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl">Salva Materiale</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Movement Modal */}
      {showAddMovementModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Movimento Magazzino</h3>
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <Box className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleCreateMovement({
                materialeId: formData.get('materialeId') as string,
                quantity: Number(formData.get('quantity')),
                costoUnitario: Number(formData.get('costoUnitario')),
                type: formData.get('type') as any,
                toId: formData.get('toId') as string,
                fromId: formData.get('type') === 'trasferimento_cantiere' ? 'centrale' : undefined,
                date: new Date().toISOString().split('T')[0]
              });
            }} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Tipologia Operazione *</label>
                <select name="type" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none" required>
                  <option value="carico_magazzino">Carico Bolla (In Magazzino Centrale)</option>
                  <option value="trasferimento_cantiere">Dirotta a Cantiere (Carico Cantiere)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Materiale *</label>
                <select name="materialeId" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none" required>
                  <option value="">Seleziona materiale...</option>
                  {materiali.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Quantità *</label>
                  <input name="quantity" type="number" step="any" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Costo Unitario (€) *</label>
                  <input name="costoUnitario" type="number" step="any" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Destinazione (solo per trasferimento)</label>
                <select name="toId" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none">
                  <option value="">Nessuna (Resta in Magazzino)</option>
                  {cantieri.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddMovementModal(false)} className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs">Annulla</button>
                <button type="submit" className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl">Registra</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Accreditation Modal */}
      {userToAccredit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Accesso Cantieri</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Seleziona i cantieri visibili a {userToAccredit.name}</p>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-2xl">
                <Building2 className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {cantieri.length === 0 ? (
                <p className="text-center py-10 text-slate-400 font-bold text-xs">Nessun cantiere disponibile.</p>
              ) : (
                cantieri.map(c => {
                  const isAccredited = (userToAccredit.cantieriAccreditati || []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleToggleAccredit(userToAccredit.id, c.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isAccredited 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                          : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${c.status === 'in_corso' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <div className="text-left">
                          <p className="text-sm font-bold">{c.name}</p>
                          <p className="text-[10px] uppercase tracking-wider font-bold opacity-60">{c.code}</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                        isAccredited ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200'
                      }`}>
                        {isAccredited && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-8">
              <button 
                onClick={() => setUserToAccredit(null)}
                className="w-full bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all"
              >
                Chiudi e Salva
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Finestra Inserimento Chiave 4 Cifre - Collegamento Cellulare Aziendale */}
      {pairingModalUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-8 sm:p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-5">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  Collegamento Cellulare Aziendale
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                  {pairingModalUser.name}
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Account: <strong className="text-slate-800">{pairingModalUser.username}</strong>
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>
            </div>

            {pairingSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-emerald-900">
                  {pairingSuccess}
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmPairing} className="space-y-6">
                {/* Status cellulare corrente */}
                {pairingModalUser.deviceId ? (
                  <div className="bg-emerald-50/80 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-emerald-950">Cellulare attualmente registrato</p>
                        <p className="text-[10px] font-mono text-emerald-700 truncate" title={pairingModalUser.deviceId}>
                          ID: {pairingModalUser.deviceId}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlinkDevice(pairingModalUser)}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer"
                    >
                      Scollega
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800">Nessun cellulare associato</p>
                      <p className="text-[10px] text-slate-500">
                        Inserisci la chiave generata dall'operatore per autorizzarlo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Istruzioni operative */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                    <Timer className="w-4 h-4 text-amber-600" /> Istruzioni Operative
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    L'operatore preme <strong className="text-slate-900">"Entra con Codice Personale"</strong> sul suo cellulare.
                    Il cellulare mostrerà una chiave a <strong>4 cifre</strong> (valida 2 minuti). Fatti comunicare il codice e inseriscilo qui sotto.
                  </p>
                </div>

                {pairingError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed">
                    {pairingError}
                  </div>
                )}

                {/* Input 4 cifre */}
                <div className="space-y-2 text-center">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    Chiave a 4 Cifre dall'Operatore
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={pairingInputCode}
                    onChange={(e) => setPairingInputCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000"
                    autoFocus
                    className="w-full bg-slate-50 border-2 border-amber-500/40 focus:border-amber-500 rounded-3xl p-4 text-center text-4xl font-black font-mono tracking-[0.5em] text-slate-900 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all placeholder:text-slate-300"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPairingModalUser(null);
                      setPairingInputCode('');
                      setPairingError('');
                      setPairingSuccess('');
                    }}
                    className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl text-xs transition-all cursor-pointer"
                  >
                    Annulla
                  </button>

                  <button
                    type="submit"
                    disabled={pairingLoading || pairingInputCode.trim().length !== 4}
                    className="w-2/3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-4 rounded-2xl text-xs shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {pairingLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" />
                        <span>Collega e Memorizza Cellulare</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* WhatsApp Modal placeholder */}
      {whatsappModalCantiere && (
        <WhatsAppExportModal
          cantiere={whatsappModalCantiere}
          rapportini={rapportini}
          onClose={() => setWhatsappModalCantiere(null)}
        />
      )}

      {/* Photo Lightbox */}
      <PhotoLightbox
        photoUrl={adminLightboxPhoto}
        onClose={() => setAdminLightboxPhoto(null)}
        title={`Foto Rapportino - ${cantieri.find(c => c.id === selectedRapportino?.cantiereId)?.name || 'Cantiere'}`}
        subtitle={`Data: ${formatItalianDate(selectedRapportino?.date)} • Inviato da ${users.find(u => u.id === selectedRapportino?.userId)?.name || 'Operatore'}`}
      />
    </div>
  );
};
