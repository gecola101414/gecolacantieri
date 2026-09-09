import React, { useState } from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry, UserAccount, Company } from '../types';
import { 
  Building2, HardHat, Wrench, FileText, DollarSign, Users, PieChart, 
  Plus, Search, CheckCircle, Clock, AlertCircle, Phone, Mail, Shield, 
  ExternalLink, Calendar, MapPin, Trash2, Edit3, Image as ImageIcon, MessageSquare, ArrowUpRight, ArrowDownRight, Fuel, Copy, KeyRound
} from 'lucide-react';
import { WhatsAppExportModal } from './WhatsAppExportModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';

interface AdminDashboardProps {
  company: Company | null;
  cantieri: Cantiere[];
  setCantieri: React.Dispatch<React.SetStateAction<Cantiere[]>>;
  personale: Personale[];
  setPersonale: React.Dispatch<React.SetStateAction<Personale[]>>;
  mezzi: Mezzo[];
  setMezzi: React.Dispatch<React.SetStateAction<Mezzo[]>>;
  contabilita: ContabilitaEntry[];
  setContabilita: React.Dispatch<React.SetStateAction<ContabilitaEntry[]>>;
  rapportini: Rapportino[];
  setRapportini: React.Dispatch<React.SetStateAction<Rapportino[]>>;
  users: UserAccount[];
  setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  currentUser: UserAccount;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  company,
  cantieri,
  setCantieri,
  personale,
  setPersonale,
  mezzi,
  setMezzi,
  contabilita,
  setContabilita,
  rapportini,
  setRapportini,
  users,
  setUsers,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'panoramica' | 'cantieri' | 'personale' | 'mezzi' | 'rapportini' | 'utenti' | 'analitica'>('panoramica');
  
  // Modals
  const [showAddCantiereModal, setShowAddCantiereModal] = useState(false);
  const [showAddContabModal, setShowAddContabModal] = useState(false);
  const [showAddPersonaleModal, setShowAddPersonaleModal] = useState(false);
  const [showAddMezzoModal, setShowAddMezzoModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedCantiereForDetails, setSelectedCantiereForDetails] = useState<Cantiere | null>(null);
  const [whatsappModalCantiere, setWhatsappModalCantiere] = useState<Cantiere | null>(null);
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form states
  const [newCantiere, setNewCantiere] = useState<Partial<Cantiere>>({
    code: 'CANT-0' + (cantieri.length + 1),
    name: '',
    client: '',
    address: '',
    budget: 100000,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-12-31',
    status: 'in_corso',
    notes: ''
  });

  const [newContab, setNewContab] = useState<Partial<ContabilitaEntry>>({
    cantiereId: cantieri[0]?.id || '',
    type: 'sal',
    amount: 10000,
    date: new Date().toISOString().split('T')[0],
    description: '',
    supplier: '',
  });

  const [newPersonale, setNewPersonale] = useState<Partial<Personale>>({
    name: '',
    role: 'Muratore Specializzato',
    hourlyRate: 25,
    phone: '',
  });

  const [newMezzo, setNewMezzo] = useState<Partial<Mezzo>>({
    name: '',
    plate: '',
    type: 'Furgone',
    hourlyRate: 20,
    fuelEfficiency: '10 L/h',
  });

  const [newUser, setNewUser] = useState<Partial<UserAccount>>({
    name: '',
    username: '',
    role: 'operativo',
    phone: '',
    cantiereId: cantieri[0]?.id || '',
  });

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
      code: newCantiere.code || 'CANT-' + Math.floor(100 + Math.random() * 900),
      name: newCantiere.name,
      client: newCantiere.client,
      address: newCantiere.address || '',
      budget: Number(newCantiere.budget) || 100000,
      startDate: newCantiere.startDate || new Date().toISOString().split('T')[0],
      endDate: newCantiere.endDate || '2026-12-31',
      status: newCantiere.status as any || 'in_corso',
      notes: newCantiere.notes || '',
    };
    setCantieri([...cantieri, created]);
    setShowAddCantiereModal(false);
    setNewCantiere({ code: 'CANT-0' + (cantieri.length + 2), name: '', client: '', address: '', budget: 100000, status: 'in_corso' });
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
      description: newContab.description || 'Registrazione contabile',
      supplier: newContab.supplier || '',
      invoiceNumber: newContab.invoiceNumber || '',
      mezzoId: newContab.mezzoId || undefined,
    };
    setContabilita([...contabilita, entry]);
    setShowAddContabModal(false);
  };

  const handleCreatePersonale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonale.name) return;
    const p: Personale = {
      id: 'p-' + Date.now(),
      name: newPersonale.name,
      role: newPersonale.role as any || 'Operaio Generico',
      hourlyRate: Number(newPersonale.hourlyRate) || 22,
      phone: newPersonale.phone || '',
    };
    setPersonale([...personale, p]);
    setShowAddPersonaleModal(false);
    setNewPersonale({ name: '', role: 'Muratore Specializzato', hourlyRate: 25, phone: '' });
  };

  const handleCreateMezzo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMezzo.name) return;
    const m: Mezzo = {
      id: 'm-' + Date.now(),
      name: newMezzo.name,
      plate: newMezzo.plate || 'AA000BB',
      type: newMezzo.type as any || 'Furgone',
      hourlyRate: Number(newMezzo.hourlyRate) || 20,
      fuelEfficiency: newMezzo.fuelEfficiency || '10 L/h',
    };
    setMezzi([...mezzi, m]);
    setShowAddMezzoModal(false);
    setNewMezzo({ name: '', plate: '', type: 'Furgone', hourlyRate: 20 });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.username) return;
    const u: UserAccount = {
      id: 'usr-' + Date.now(),
      companyCode: company ? company.code : 'CANT-0000',
      name: newUser.name,
      username: newUser.username,
      password: '1234', // Password iniziale richiesta dall'utente
      role: newUser.role as any || 'operativo',
      mustChangePassword: true, // Al primo accesso deve cambiarla
      cantiereId: newUser.cantiereId || undefined,
      phone: newUser.phone || '',
      active: true,
    };
    setUsers([...users, u]);
    setShowAddUserModal(false);
    setNewUser({ name: '', username: '', role: 'operativo', phone: '' });
    alert(`Utente ${newUser.name} creato con successo!\nUsername: ${newUser.username}\nPassword iniziale: 1234`);
  };

  const handleResetPassword = (userId: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, password: '1234', mustChangePassword: true } : u));
    alert('Password ripristinata a 1234 con successo.');
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Vuoi eliminare questo utente?')) {
      setUsers(users.filter(u => u.id !== userId));
    }
  };

  const handleCopyCompanyCode = () => {
    if (company) {
      navigator.clipboard.writeText(company.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  // Chart data
  const chartData = cantieri.map((c) => {
    const cContab = contabilita.filter((cb) => cb.cantiereId === c.id);
    const entrate = cContab.filter((cb) => cb.type === 'sal' || cb.type === 'acconto').reduce((acc, curr) => acc + curr.amount, 0);
    const uscite = cContab.filter((cb) => cb.type !== 'sal' && cb.type !== 'acconto').reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
    return {
      name: c.name.length > 18 ? c.name.substring(0, 18) + '...' : c.name,
      Entrate: entrate,
      Costi: uscite,
      Margine: entrate - uscite,
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner with Company Code */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-700">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-amber-500/20 text-amber-400 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30">
              Amministratore: {currentUser.name}
            </span>
            {company && (
              <button
                onClick={handleCopyCompanyCode}
                className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-mono border border-emerald-500/30 flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors"
                title="Clicca per copiare il codice aziendale"
              >
                <span>Codice Aziendale: <strong>{company.code}</strong></span>
                <Copy className="w-3.5 h-3.5" />
                {copiedCode && <span className="text-emerald-400 font-bold ml-1">Copiato!</span>}
              </button>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {company ? company.name : 'Gestione Contabilità Cantieri'}
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Crea gli account per i tuoi collaboratori e capicantieri. Condividi il codice aziendale per consentire loro la registrazione con password iniziale <code className="text-amber-400 font-bold">1234</code>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowAddContabModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Registra SAL / Spesa
          </button>
          <button
            onClick={() => setShowAddCantiereModal(true)}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-3 rounded-xl shadow flex items-center gap-2 text-sm transition-colors"
          >
            <Building2 className="w-4 h-4" /> Nuovo Cantiere
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fatturato & Entrate (SAL)</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">€{totalEntrate.toLocaleString()}</h3>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Acconti & SAL registrati
            </span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Costi Totali Cantieri</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">€{totalUscite.toLocaleString()}</h3>
            <span className="text-xs font-semibold text-rose-600 flex items-center gap-0.5 mt-1">
              <ArrowDownRight className="w-3.5 h-3.5" /> Materiali, mezzi e carburante
            </span>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl">
            <PieChart className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Margine Operativo</p>
            <h3 className={`text-2xl font-black mt-1 ${margineComplessivo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              €{margineComplessivo.toLocaleString()}
            </h3>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">Utile netto gestionale</span>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl">
            <Building2 className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rapportini Ricevuti</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{rapportini.length}</h3>
            <span className="text-xs font-semibold text-blue-600 flex items-center gap-0.5 mt-1">
              <Clock className="w-3.5 h-3.5" /> Sincronizzati da cellulare
            </span>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
            <FileText className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
        {[
          { id: 'panoramica', label: 'Panoramica & Dashboard', icon: PieChart },
          { id: 'cantieri', label: `Cantieri (${cantieri.length})`, icon: Building2 },
          { id: 'personale', label: `Personale (${personale.length})`, icon: HardHat },
          { id: 'mezzi', label: `Mezzi & Carburante (${mezzi.length})`, icon: Wrench },
          { id: 'rapportini', label: `Rapportini Campale (${rapportini.length})`, icon: FileText },
          { id: 'utenti', label: `Gestione Utenti (${users.length})`, icon: Users },
          { id: 'analitica', label: 'Grafici & Export', icon: ExternalLink },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: PANORAMICA */}
      {activeTab === 'panoramica' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <h3 className="font-bold text-lg text-slate-900">Andamento Contabile per Cantiere</h3>
            {cantieri.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nessun cantiere inserito. Clicca su "Nuovo Cantiere" per iniziare.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" fontSize={12} stroke="#64748b" />
                    <YAxis fontSize={12} stroke="#64748b" />
                    <Tooltip formatter={(value: any) => [`€${Number(value).toLocaleString()}`, '']} />
                    <Legend />
                    <Bar dataKey="Entrate" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Costi" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Margine" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-lg text-slate-900">Accesso Collaboratori</h3>
            <p className="text-xs text-slate-600">
              Per far accedere i capicantieri e la direzione, comunica loro il tuo **Codice Aziendale**:
            </p>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
              <span className="text-xs text-amber-800 font-bold block mb-1">CODICE AZIENDA</span>
              <span className="font-mono text-xl font-black text-amber-900 tracking-wider">{company?.code}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              I collaboratori potranno registrarsi inserendo questo codice. La password iniziale al primo accesso sarà sempre <code className="font-bold text-slate-800">1234</code>.
            </p>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CANTIERI */}
      {activeTab === 'cantieri' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Elenco Cantieri</h3>
              <p className="text-xs text-slate-500">Gestione e monitoraggio stato finanziario per cantiere</p>
            </div>
            <button
              onClick={() => setShowAddCantiereModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" /> Nuovo Cantiere
            </button>
          </div>

          {cantieri.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
              <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h4 className="font-bold text-lg text-slate-900 mb-1">Nessun cantiere presente</h4>
              <p className="text-sm text-slate-500 mb-6">Inizia aggiungendo il tuo primo cantiere per registrare SAL e spese.</p>
              <button
                onClick={() => setShowAddCantiereModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-6 py-3 rounded-xl text-sm shadow"
              >
                Crea il Primo Cantiere
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cantieri.map((c) => {
                const cContab = contabilita.filter((cb) => cb.cantiereId === c.id);
                const entrate = cContab.filter((cb) => cb.type === 'sal' || cb.type === 'acconto').reduce((a, b) => a + b.amount, 0);
                const uscite = cContab.filter((cb) => cb.type !== 'sal' && cb.type !== 'acconto').reduce((a, b) => a + Math.abs(b.amount), 0);
                const percentBudget = c.budget > 0 ? Math.min(100, Math.round((entrate / c.budget) * 100)) : 0;

                return (
                  <div key={c.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            {c.code}
                          </span>
                          <h4 className="font-bold text-lg text-slate-900 mt-2">{c.name}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {c.address}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-emerald-100 text-emerald-800">
                          {c.status}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Cliente:</span>
                          <span className="font-semibold text-slate-900">{c.client}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Budget:</span>
                          <span className="font-bold text-slate-900">€{c.budget.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">SAL / Acconti:</span>
                          <span className="font-bold text-emerald-600">€{entrate.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Uscite:</span>
                          <span className="font-bold text-rose-600">€{uscite.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedCantiereForDetails(c)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        Contabilità Dettaglio
                      </button>
                      <button
                        onClick={() => setWhatsappModalCantiere(c)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold p-2.5 rounded-xl text-xs border border-emerald-200"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PERSONALE */}
      {activeTab === 'personale' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Anagrafica Personale</h3>
              <p className="text-xs text-slate-500">Gestione operai e capicantieri</p>
            </div>
            <button
              onClick={() => setShowAddPersonaleModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" /> Aggiungi Personale
            </button>
          </div>

          {personale.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <HardHat className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-sm text-slate-500 mb-4">Nessun dipendente inserito.</p>
              <button
                onClick={() => setShowAddPersonaleModal(true)}
                className="bg-amber-500 text-slate-900 font-bold px-6 py-2.5 rounded-xl text-sm"
              >
                Aggiungi Primo Dipendente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {personale.map((p) => (
                <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                      <p className="text-xs text-slate-500">{p.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900">€{p.hourlyRate}/h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MEZZI */}
      {activeTab === 'mezzi' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Parco Mezzi</h3>
              <p className="text-xs text-slate-500">Gestione mezzi e costi carburante</p>
            </div>
            <button
              onClick={() => setShowAddMezzoModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" /> Aggiungi Mezzo
            </button>
          </div>

          {mezzi.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Wrench className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-sm text-slate-500 mb-4">Nessun mezzo inserito.</p>
              <button
                onClick={() => setShowAddMezzoModal(true)}
                className="bg-amber-500 text-slate-900 font-bold px-6 py-2.5 rounded-xl text-sm"
              >
                Aggiungi Primo Mezzo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mezzi.map((m) => (
                <div key={m.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {m.plate}
                      </span>
                      <h4 className="font-bold text-slate-900 text-base mt-1.5">{m.name}</h4>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900 block">€{m.hourlyRate}/h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RAPPORTINI */}
      {activeTab === 'rapportini' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Rapportini Giornalieri da Cantiere (Mobile)</h3>
            <p className="text-xs text-slate-500">Inviati dai capicantieri e operai</p>
          </div>

          {rapportini.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-sm text-slate-500">Nessun rapportino ricevuto dai collaboratori.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rapportini.map((r) => {
                const cantiere = cantieri.find((c) => c.id === r.cantiereId);
                return (
                  <div key={r.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{cantiere ? cantiere.name : 'Cantiere'}</h4>
                        <p className="text-xs text-slate-500">Data: {r.date} • Operatore: {r.userName}</p>
                      </div>
                      <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 rounded-full border border-emerald-200">
                        Verificato
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 bg-slate-50 p-4 rounded-2xl border border-slate-100">"{r.descrizione}"</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: UTENTI */}
      {activeTab === 'utenti' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Gestione Utenti Collaboratori</h3>
              <p className="text-xs text-slate-500">Crea i nomi per i tuoi collaboratori. Al primo accesso la password sarà 1234.</p>
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" /> Crea Nuovo Utente
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <div key={u.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{u.name}</h4>
                      <p className="text-xs font-mono text-slate-500">Username: {u.username}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    u.role === 'admin' ? 'bg-amber-100 text-amber-800' :
                    u.role === 'dirigente' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {u.role}
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleResetPassword(u.id)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Ripristina Password (1234)
                  </button>
                  {u.id !== currentUser.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-xs text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ANALITICA */}
      {activeTab === 'analitica' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 text-center max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-slate-900">Reportistica e WhatsApp</h3>
          <p className="text-sm text-slate-600">Condividi rapidamente i report dei cantieri.</p>
          {cantieri.length > 0 && (
            <button
              onClick={() => setWhatsappModalCantiere(cantieri[0])}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow flex items-center justify-center gap-2 text-sm mx-auto"
            >
              <MessageSquare className="w-4 h-4" /> Condividi Report su WhatsApp
            </button>
          )}
        </div>
      )}

      {/* MODALS */}
      {/* 1. Add Cantiere */}
      {showAddCantiereModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Nuovo Cantiere</h3>
            <form onSubmit={handleCreateCantiere} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Cantiere *</label>
                <input
                  type="text"
                  value={newCantiere.name}
                  onChange={(e) => setNewCantiere({ ...newCantiere, name: e.target.value })}
                  placeholder="Es. Ristrutturazione..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Codice</label>
                  <input
                    type="text"
                    value={newCantiere.code}
                    onChange={(e) => setNewCantiere({ ...newCantiere, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cliente *</label>
                  <input
                    type="text"
                    value={newCantiere.client}
                    onChange={(e) => setNewCantiere({ ...newCantiere, client: e.target.value })}
                    placeholder="Nome cliente..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Indirizzo</label>
                <input
                  type="text"
                  value={newCantiere.address}
                  onChange={(e) => setNewCantiere({ ...newCantiere, address: e.target.value })}
                  placeholder="Via, Città..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Budget (€) *</label>
                <input
                  type="number"
                  value={newCantiere.budget}
                  onChange={(e) => setNewCantiere({ ...newCantiere, budget: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCantiereModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-3 rounded-xl text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 rounded-xl text-sm shadow"
                >
                  Crea Cantiere
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Contabilità */}
      {showAddContabModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Registra SAL, Acconto o Spesa</h3>
            <form onSubmit={handleCreateContab} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cantiere *</label>
                <select
                  value={newContab.cantiereId}
                  onChange={(e) => setNewContab({ ...newContab, cantiereId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                >
                  {cantieri.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo *</label>
                  <select
                    value={newContab.type}
                    onChange={(e) => setNewContab({ ...newContab, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  >
                    <option value="sal">SAL (Entrata)</option>
                    <option value="acconto">Acconto (Entrata)</option>
                    <option value="spesa_materiale">Spesa Materiale (Uscita)</option>
                    <option value="carburante">Carburante Mezzo (Uscita)</option>
                    <option value="manutenzione">Manutenzione (Uscita)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Importo (€) *</label>
                  <input
                    type="number"
                    value={newContab.amount}
                    onChange={(e) => setNewContab({ ...newContab, amount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none font-bold"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Descrizione *</label>
                <input
                  type="text"
                  value={newContab.description}
                  onChange={(e) => setNewContab({ ...newContab, description: e.target.value })}
                  placeholder="Es. Fornitura cemento..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddContabModal(false)}
                  className="flex-1 bg-slate-100 text-slate-800 font-semibold py-3 rounded-xl text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 text-slate-900 font-bold py-3 rounded-xl text-sm shadow"
                >
                  Registra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Personale */}
      {showAddPersonaleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Aggiungi Personale</h3>
            <form onSubmit={handleCreatePersonale} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  value={newPersonale.name}
                  onChange={(e) => setNewPersonale({ ...newPersonale, name: e.target.value })}
                  placeholder="Nome..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ruolo</label>
                  <select
                    value={newPersonale.role}
                    onChange={(e) => setNewPersonale({ ...newPersonale, role: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  >
                    <option value="Capocantiere">Capocantiere</option>
                    <option value="Muratore Specializzato">Muratore Specializzato</option>
                    <option value="Operaio Generico">Operaio Generico</option>
                    <option value="Gruista">Gruista</option>
                    <option value="Tecnico">Tecnico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Costo Orario (€/h)</label>
                  <input
                    type="number"
                    value={newPersonale.hourlyRate}
                    onChange={(e) => setNewPersonale({ ...newPersonale, hourlyRate: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPersonaleModal(false)}
                  className="flex-1 bg-slate-100 text-slate-800 font-semibold py-3 rounded-xl text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 text-slate-900 font-bold py-3 rounded-xl text-sm shadow"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Mezzo */}
      {showAddMezzoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Aggiungi Mezzo</h3>
            <form onSubmit={handleCreateMezzo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Mezzo *</label>
                <input
                  type="text"
                  value={newMezzo.name}
                  onChange={(e) => setNewMezzo({ ...newMezzo, name: e.target.value })}
                  placeholder="Nome mezzo..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Targa</label>
                  <input
                    type="text"
                    value={newMezzo.plate}
                    onChange={(e) => setNewMezzo({ ...newMezzo, plate: e.target.value })}
                    placeholder="AB123CD"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tariffa (€/h)</label>
                  <input
                    type="number"
                    value={newMezzo.hourlyRate}
                    onChange={(e) => setNewMezzo({ ...newMezzo, hourlyRate: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMezzoModal(false)}
                  className="flex-1 bg-slate-100 text-slate-800 font-semibold py-3 rounded-xl text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 text-slate-900 font-bold py-3 rounded-xl text-sm shadow"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add User Account */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Crea Account Collaboratore</h3>
            <p className="text-xs text-slate-500 mb-4">
              Al primo accesso la password assegnata dal sistema sarà <code className="font-bold text-slate-800">1234</code>.
            </p>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Nome collaboratore..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username per Accesso *</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="username..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ruolo *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  >
                    <option value="operativo">Capocantiere (Cellulare)</option>
                    <option value="dirigente">Dirigente (PC Vista)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cantiere Assegnato</label>
                  <select
                    value={newUser.cantiereId}
                    onChange={(e) => setNewUser({ ...newUser, cantiereId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none"
                  >
                    {cantieri.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 bg-slate-100 text-slate-800 font-semibold py-3 rounded-xl text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 text-slate-900 font-bold py-3 rounded-xl text-sm shadow"
                >
                  Crea Utente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
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
