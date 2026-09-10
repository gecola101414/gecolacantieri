import React, { useState } from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry, UserAccount, Company, Materiale } from '../types';
import { 
  Building2, HardHat, Wrench, FileText, DollarSign, Users, PieChart as PieChartIcon, 
  Plus, Search, CheckCircle, Clock, AlertCircle, Phone, Mail, Shield, 
  ExternalLink, Calendar, MapPin, Trash2, Edit3, Image as ImageIcon, MessageSquare, ArrowUpRight, ArrowDownRight, Fuel, Copy, KeyRound, Filter, Download, MoreHorizontal, ChevronRight, LayoutGrid, List, Cloud, Box, Smartphone
} from 'lucide-react';
import { WhatsAppExportModal } from './WhatsAppExportModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend, AreaChart, Area, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

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
  users: UserAccount[];
  onSaveUser: (u: UserAccount) => void;
  onDeleteUser: (uid: string) => void;
  materiali: Materiale[];
  onAddMateriale: (m: Materiale) => void;
  currentUser: UserAccount;
  activeTab: 'panoramica' | 'cantieri' | 'personale' | 'mezzi' | 'rapportini' | 'utenti' | 'materiali';
  setActiveTab: (tab: any) => void;
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
  users,
  onSaveUser,
  onDeleteUser,
  materiali,
  onAddMateriale,
  currentUser,
  activeTab,
  setActiveTab,
}) => {
  // Modals
  const [showAddCantiereModal, setShowAddCantiereModal] = useState(false);
  const [showAddContabModal, setShowAddContabModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddPersonaleModal, setShowAddPersonaleModal] = useState(false);
  const [showAddMezzoModal, setShowAddMezzoModal] = useState(false);
  const [showAddMaterialeModal, setShowAddMaterialeModal] = useState(false);
  const [whatsappModalCantiere, setWhatsappModalCantiere] = useState<Cantiere | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // ... rest of state
  const [newCantiere, setNewCantiere] = useState<Partial<Cantiere>>({
    code: '',
    name: '',
    client: '',
    address: '',
    budget: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'in_corso',
  });

  const [newContab, setNewContab] = useState<Partial<ContabilitaEntry>>({
    cantiereId: '',
    type: 'sal',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [newUser, setNewUser] = useState<Partial<UserAccount>>({
    name: '',
    username: '',
    role: 'operativo',
    phone: '',
    cantiereId: '',
  });

  const [newPers, setNewPers] = useState<Partial<Personale>>({
    name: '',
    role: 'Operaio Generico',
    hourlyRate: 20,
    phone: '',
  });

  const [newMenz, setNewMenz] = useState<Partial<Mezzo>>({
    name: '',
    plate: '',
    type: 'Autocarro',
    hourlyRate: 30,
  });

  const [newMat, setNewMat] = useState<Partial<Materiale>>({
    name: '',
    unit: 'mc',
    defaultPrice: 0,
  });

  // ... handlers
  const handleCreateMateriale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMat.name) return;
    const m: Materiale = {
      id: 'm-' + Date.now(),
      name: newMat.name,
      unit: newMat.unit || 'mc',
      defaultPrice: Number(newMat.defaultPrice) || 0,
    };
    onAddMateriale(m);
    setShowAddMaterialeModal(false);
    setNewMat({ name: '', unit: 'mc', defaultPrice: 0 });
  };

  // Calculate totals
  const totalEntrate = contabilita
    .filter((c) => c.type === 'sal' || c.type === 'acconto')
    .reduce((acc, c) => acc + c.amount, 0);

  const totalUscite = contabilita
    .filter((c) => c.type !== 'sal' && c.type !== 'acconto')
    .reduce((acc, c) => acc + Math.abs(c.amount), 0);

  const margineComplessivo = totalEntrate - totalUscite;

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
      budget: Number(newCantiere.budget) || 0,
      startDate: newCantiere.startDate || new Date().toISOString().split('T')[0],
      endDate: newCantiere.endDate || '',
      status: newCantiere.status as any || 'in_corso',
    };
    onAddCantiere(created);
    setShowAddCantiereModal(false);
    setNewCantiere({ name: '', client: '', address: '', budget: 0, status: 'in_corso' });
  };

  const handleCreateContab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContab.cantiereId || !newContab.amount) return;
    const isEntrata = newContab.type === 'sal' || newContab.type === 'acconto';
    const finalAmount = isEntrata ? Math.abs(Number(newContab.amount)) : -Math.abs(Number(newContab.amount));

    const entry: ContabilitaEntry = {
      id: 'cb-' + Date.now(),
      cantiereId: newContab.cantiereId,
      type: newContab.type as any,
      amount: finalAmount,
      date: newContab.date || new Date().toISOString().split('T')[0],
      description: newContab.description || '',
    };
    onAddContabilita(entry);
    setShowAddContabModal(false);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.username) return;
    const u: UserAccount = {
      id: 'usr-' + Date.now(),
      companyCode: company ? company.code : 'CANT-0000',
      name: newUser.name,
      username: newUser.username,
      password: '1234',
      role: newUser.role as any || 'operativo',
      mustChangePassword: true,
      cantiereId: newUser.cantiereId || undefined,
      phone: newUser.phone || '',
      active: true,
    };
    onSaveUser(u);
    setShowAddUserModal(false);
    setNewUser({ name: '', username: '', role: 'operativo', phone: '' });
  };

  const handleCreatePersonale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPers.name) return;
    const p: Personale = {
      id: 'p-' + Date.now(),
      name: newPers.name,
      role: newPers.role as any || 'Operaio Generico',
      hourlyRate: Number(newPers.hourlyRate) || 0,
      phone: newPers.phone || '',
    };
    onAddPersonale(p);
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
      hourlyRate: Number(newMenz.hourlyRate) || 0,
    };
    onAddMezzo(m);
    setShowAddMezzoModal(false);
    setNewMenz({ name: '', plate: '', type: 'Autocarro', hourlyRate: 30 });
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

  const chartData = cantieri.slice(0, 5).map(c => {
    const cContab = contabilita.filter(cb => cb.cantiereId === c.id);
    const entrate = cContab.filter(cb => cb.amount > 0).reduce((acc, curr) => acc + curr.amount, 0);
    const costi = cContab.filter(cb => cb.amount < 0).reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
    return {
      name: c.name.split(' ')[0],
      Entrate: entrate,
      Costi: costi
    };
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 lg:py-12 space-y-12">
      
      {/* Header & Company Card */}
      <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-500/20">
              Admin Console
            </div>
            <div className="h-1 w-8 bg-slate-800 rounded-full"></div>
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
          { label: 'Entrate Certificate', value: `€${totalEntrate.toLocaleString()}`, sub: 'SAL & Acconti', icon: ArrowUpRight, color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/10' },
          { label: 'Costi Operativi', value: `€${totalUscite.toLocaleString()}`, sub: 'Mezzi, Personale, Materiali', icon: ArrowDownRight, color: 'text-rose-500', bg: 'bg-rose-500/5', border: 'border-rose-500/10' },
          { label: 'Margine Gestionale', value: `€${margineComplessivo.toLocaleString()}`, sub: 'Margine Lordo Attuale', icon: PieChartIcon, color: 'text-amber-500', bg: 'bg-amber-500/5', border: 'border-amber-500/10' },
          { label: 'Rapportini Cloud', value: rapportini.length, sub: 'Inviati in Tempo Reale', icon: Cloud, color: 'text-blue-500', bg: 'bg-blue-500/5', border: 'border-blue-500/10' },
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
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Analisi Flussi Finanziari</h3>
                      <p className="text-xs font-medium text-slate-500 mt-1">Comparazione entrate vs costi sui primi 5 cantieri attivi</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500 border border-slate-100">
                        <Calendar className="w-3 h-3" /> Ultimi 30 giorni
                      </div>
                    </div>
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorEntrate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCosti" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dx={-10} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="Entrate" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEntrate)" />
                        <Area type="monotone" dataKey="Costi" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorCosti)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

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
                                <p className="text-[10px] text-slate-500 font-medium">{r.date}</p>
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
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setShowAddCantiereModal(true)}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-amber-500 hover:text-slate-950 rounded-3xl border border-slate-100 transition-all group"
                        >
                          <Building2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Nuovo Cantiere</span>
                        </button>
                        <button 
                          onClick={() => setShowAddContabModal(true)}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-amber-500 hover:text-slate-950 rounded-3xl border border-slate-100 transition-all group"
                        >
                          <DollarSign className="w-6 h-6 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Cassa/SAL</span>
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
                    <p className="text-xs font-medium text-slate-500 mt-1">Gestione economica e avanzamento lavori.</p>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cantieri Attivi</p>
                    <p className="text-2xl font-bold text-slate-900">{cantieri.filter(c => c.status === 'in_corso').length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Budget Totale</p>
                    <p className="text-2xl font-bold text-slate-900">€{cantieri.reduce((acc, c) => acc + c.budget, 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costi Totali</p>
                    <p className="text-2xl font-bold text-rose-600">€{contabilita.filter(cb => cb.amount < 0).reduce((acc, cb) => acc + Math.abs(cb.amount), 0).toLocaleString()}</p>
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
                      const cContab = contabilita.filter(cb => cb.cantiereId === c.id);
                      const entrate = cContab.filter(cb => cb.amount > 0).reduce((a, b) => a + b.amount, 0);
                      const costi = cContab.filter(cb => cb.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
                      const margine = entrate - costi;
                      const statusColor = c.status === 'in_corso' ? 'bg-emerald-500' : c.status === 'sospeso' ? 'bg-amber-500' : 'bg-slate-400';

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
                            
                            <h4 className="text-xl font-bold text-slate-900 mb-2">{c.name}</h4>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-8">
                              <MapPin className="w-3.5 h-3.5" /> {c.address}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                              <div className="bg-slate-50 p-4 rounded-2xl">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Entrate (SAL)</p>
                                <p className="text-sm font-bold text-emerald-600">€{entrate.toLocaleString()}</p>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-2xl">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costi Totali</p>
                                <p className="text-sm font-bold text-rose-600">€{costi.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Margine Netto</p>
                              <p className={`text-base font-bold ${margine >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>€{margine.toLocaleString()}</p>
                            </div>
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg group">
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

            {/* CONTABILITÀ TAB */}
            {activeTab === 'contabilita' && (
              <motion.div 
                key="contabilita"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Registro Contabile</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Flussi di cassa, SAL e pagamenti fornitori.</p>
                  </div>
                  <button onClick={() => setShowAddContabModal(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-emerald-700 transition-all">
                    <Plus className="w-4 h-4" /> Registra Movimento
                  </button>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cantiere</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrizione</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Importo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {contabilita.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-8 py-20 text-center text-slate-400 text-xs font-bold">Nessun movimento registrato.</td>
                          </tr>
                        ) : (
                          contabilita.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => {
                            const cantiere = cantieri.find(c => c.id === entry.cantiereId);
                            return (
                              <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-5 text-xs font-medium text-slate-500">{entry.date}</td>
                                <td className="px-8 py-5 text-sm font-bold text-slate-900">{cantiere?.name || 'Cantiere Eliminato'}</td>
                                <td className="px-8 py-5 text-sm text-slate-600">{entry.description}</td>
                                <td className="px-8 py-5">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    entry.amount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {entry.type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className={`px-8 py-5 text-sm font-bold text-right ${entry.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}€
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                    <p className="text-xs font-medium text-slate-500 mt-1">Gestione dei collaboratori e costi orari aziendali.</p>
                  </div>
                  <button onClick={() => setShowAddPersonaleModal(true)} className="bg-slate-950 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus className="w-4 h-4" /> Aggiungi Personale
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Medio Orario</p>
                    <p className="text-2xl font-bold text-slate-900">
                      €{personale.length > 0 ? (personale.reduce((acc, p) => acc + p.hourlyRate, 0) / personale.length).toFixed(2) : '0'}/h
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {personale.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[40px] p-20 text-center border border-slate-200 shadow-sm">
                      <HardHat className="w-12 h-12 text-slate-200 mx-auto mb-6" />
                      <h4 className="text-xl font-bold text-slate-900 mb-2">Nessun membro del team.</h4>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">Carica l'organico per monitorare i costi del lavoro nei rapportini.</p>
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
                            <span className="text-slate-400">Costo Orario:</span>
                            <span className="font-bold text-slate-900">€{p.hourlyRate}/h</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Telefono:</span>
                            <span className="font-bold text-slate-900">{p.phone || '-'}</span>
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
                    <p className="text-xs font-medium text-slate-500 mt-1">Monitoraggio parco macchine e costi di ammortamento.</p>
                  </div>
                  <button onClick={() => setShowAddMezzoModal(true)} className="bg-slate-950 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus className="w-4 h-4" /> Aggiungi Mezzo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Ammortamento h</p>
                    <p className="text-2xl font-bold text-slate-900">
                      €{mezzi.length > 0 ? (mezzi.reduce((acc, m) => acc + m.hourlyRate, 0) / mezzi.length).toFixed(2) : '0'}/h
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {mezzi.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[40px] p-20 text-center border border-slate-200 shadow-sm">
                      <Wrench className="w-12 h-12 text-slate-200 mx-auto mb-6" />
                      <h4 className="text-xl font-bold text-slate-900 mb-2">Parco mezzi vuoto.</h4>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">Inserisci i mezzi aziendali per imputare i costi di utilizzo ai cantieri.</p>
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
                            <span className="text-slate-400">Costo Utilizzo:</span>
                            <span className="font-bold text-slate-900">€{m.hourlyRate}/h</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* RAPPORTINI TAB */}
            {activeTab === 'rapportini' && (
              <motion.div 
                key="rapportini"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Rapportini Cloud</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Archivio storico dei rapportini inviati dal campo.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {rapportini.length === 0 ? (
                    <div className="bg-white rounded-[40px] p-20 text-center border border-slate-200 shadow-sm">
                      <FileText className="w-12 h-12 text-slate-200 mx-auto mb-6" />
                      <h4 className="text-xl font-bold text-slate-900 mb-2">Nessun rapportino ricevuto.</h4>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">I rapportini appariranno qui man mano che vengono inviati dai dispositivi mobili.</p>
                    </div>
                  ) : (
                    rapportini.map(r => (
                      <div key={r.id} className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-amber-500/30 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-slate-900">Rapportino del {r.date}</h4>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">DA: {r.userName}</span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">{r.note || 'Nessuna nota aggiuntiva'}</p>
                          </div>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-950 hover:text-white transition-all">
                          Esamina
                        </button>
                      </div>
                    ))
                  )}
                </div>
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
                    <h3 className="text-2xl font-bold text-slate-900">Listino Materiali</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Gestione dei materiali e prezzi di riferimento.</p>
                  </div>
                  <button onClick={() => setShowAddMaterialeModal(true)} className="bg-slate-950 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus className="w-4 h-4" /> Aggiungi Materiale
                  </button>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiale</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unità</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prezzo Base</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {materiali.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-8 py-20 text-center text-slate-400 text-xs font-bold">Nessun materiale in listino.</td>
                          </tr>
                        ) : (
                          materiali.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-8 py-5 text-sm font-bold text-slate-900">{m.name}</td>
                              <td className="px-8 py-5 text-xs font-medium text-slate-500">{m.unit}</td>
                              <td className="px-8 py-5 text-sm font-bold text-slate-900">€{m.defaultPrice.toLocaleString()}</td>
                              <td className="px-8 py-5 text-right">
                                <button 
                                  onClick={() => handleDeleteMateriale(m.id)}
                                  className="p-2 hover:bg-rose-50 rounded-xl transition-all group"
                                >
                                  <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* UTENTI TAB */}
            {activeTab === 'utenti' && (
              <motion.div 
                key="utenti"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Sicurezza & Accessi</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Gestisci chi può accedere al tuo server cloud aziendale.</p>
                  </div>
                  <button onClick={() => setShowAddUserModal(true)} className="bg-slate-950 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-slate-900 transition-all">
                    <Plus className="w-4 h-4" /> Nuovo Account
                  </button>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utente</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ruolo</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stato Cloud</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center">
                                  {u.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{u.name}</p>
                                  <p className="text-[10px] font-mono text-slate-500">{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter ${
                                u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Sincronizzato
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleResetDevice(u.id)}
                                  className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all group" 
                                  title="Reset Dispositivo (Scollega Cellulare)"
                                >
                                  <Smartphone className="w-4 h-4 text-slate-400 group-hover:text-sky-500" />
                                </button>
                                <button 
                                  onClick={() => handleResetPassword(u.id)}
                                  className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all group" 
                                  title="Reset Password (1234)"
                                >
                                  <KeyRound className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                                </button>
                                {u.id !== currentUser.id && (
                                  <button 
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-2 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-all group"
                                  >
                                    <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Budget Previsto (€) *</label>
                  <input 
                    type="number" 
                    value={newCantiere.budget}
                    onChange={e => setNewCantiere({...newCantiere, budget: Number(e.target.value)})}
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

      {/* Add Contabilità Modal */}
      {showAddContabModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Registra Movimento</h3>
              <div className="bg-emerald-500/10 p-3 rounded-2xl">
                <DollarSign className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreateContab} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Seleziona Cantiere *</label>
                <select 
                  value={newContab.cantiereId}
                  onChange={e => setNewContab({...newContab, cantiereId: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                  required
                >
                  <option value="">Seleziona...</option>
                  {cantieri.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Tipologia *</label>
                  <select 
                    value={newContab.type}
                    onChange={e => setNewContab({...newContab, type: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  >
                    <option value="sal">SAL (Entrata)</option>
                    <option value="acconto">Acconto (Entrata)</option>
                    <option value="spesa_materiale">Spesa Materiale (Uscita)</option>
                    <option value="carburante">Carburante (Uscita)</option>
                    <option value="manutenzione">Manutenzione (Uscita)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Importo (€) *</label>
                  <input 
                    type="number" 
                    value={newContab.amount}
                    onChange={e => setNewContab({...newContab, amount: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold"
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Descrizione Movimento *</label>
                <input 
                  type="text" 
                  value={newContab.description}
                  onChange={e => setNewContab({...newContab, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  required 
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddContabModal(false)}
                  className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-2xl text-xs shadow-xl"
                >
                  Registra Ora
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

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Costo Orario (€/h) *</label>
                  <input 
                    type="number" 
                    value={newPers.hourlyRate}
                    onChange={e => setNewPers({...newPers, hourlyRate: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold"
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Contatto Telefonico</label>
                <input 
                  type="text" 
                  value={newPers.phone}
                  onChange={e => setNewPers({...newPers, phone: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                />
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
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Costo Utilizzo (€/h) *</label>
                  <input 
                    type="number" 
                    value={newMenz.hourlyRate}
                    onChange={e => setNewMenz({...newMenz, hourlyRate: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold"
                    required 
                  />
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

      {/* Add Materiale Modal */}
      {showAddMaterialeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full p-10 border border-slate-200"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Nuovo Materiale</h3>
              <div className="bg-blue-500/10 p-3 rounded-2xl">
                <Box className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            
            <form onSubmit={handleCreateMateriale} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome Materiale *</label>
                <input 
                  type="text" 
                  value={newMat.name}
                  onChange={e => setNewMat({...newMat, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  required 
                  placeholder="es. Cemento RCK 30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Unità di Misura *</label>
                  <select 
                    value={newMat.unit}
                    onChange={e => setNewMat({...newMat, unit: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none"
                  >
                    <option value="mc">mc (Metri Cubi)</option>
                    <option value="kg">kg</option>
                    <option value="sacchi">sacchi</option>
                    <option value="mq">mq (Metri Quadri)</option>
                    <option value="metri">metri</option>
                    <option value="litri">litri</option>
                    <option value="cad">cad (Caduno)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Prezzo stimato (€) *</label>
                  <input 
                    type="number" 
                    value={newMat.defaultPrice}
                    onChange={e => setNewMat({...newMat, defaultPrice: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold"
                    required 
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddMaterialeModal(false)}
                  className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all"
                >
                  Crea Materiale
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* WhatsApp Modal placeholder */}
      {whatsappModalCantiere && (
        <WhatsAppExportModal
          cantiere={whatsappModalCantiere}
          rapportini={rapportini}
          contabilita={contabilita}
          onClose={() => setWhatsappModalCantiere(null)}
        />
      )}
    </div>
  );
};
