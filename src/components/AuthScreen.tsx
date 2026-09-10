import React, { useState } from 'react';
import { UserAccount, Company, UserRole } from '../types';
import { Building2, Shield, Lock, User, KeyRound, ArrowRight, CheckCircle2, Sparkles, Smartphone, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';

interface AuthScreenProps {
  company: Company | null;
  users: UserAccount[];
  onRegisterCompany: (company: Company, adminUser: UserAccount) => void;
  onLogin: (user: UserAccount) => void;
  onRegisterCollaborator: (user: UserAccount) => void;
  setCompany: (company: Company | null) => void;
  setUsers: (users: UserAccount[]) => void;
}

const getLocalDeviceId = () => {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('cantieri_cloud_device_id');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    localStorage.setItem('cantieri_cloud_device_id', id);
  }
  return id;
};

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
};

export const AuthScreen: React.FC<AuthScreenProps> = ({
  company,
  users,
  onRegisterCompany,
  onLogin,
  onRegisterCollaborator,
  setCompany,
  setUsers,
}) => {
  const [mode, setMode] = useState<'login' | 'register_admin'> (
    !company ? 'register_admin' : 'login'
  );

  // Login steps: 'company_code' -> 'user_selection' -> 'password' | 'transfer_code'
  const [loginStep, setLoginStep] = useState<'company_code' | 'user_selection' | 'password' | 'transfer_code'>('company_code');
  const [inputCompanyCode, setInputCompanyCode] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<UserAccount[]>([]);
  const [loginPassword, setLoginPassword] = useState('');
  const [transferCodeInput, setTransferCodeInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password change modal on first login
  const [userToChangePassword, setUserToChangePassword] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Register Admin form
  const [adminCompanyName, setAdminCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleCompanyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);
    const code = inputCompanyCode.trim().toUpperCase();
    
    try {
      const foundCompany = await firestoreService.getCompanyByCode(code);
      if (foundCompany) {
        const companyUsers = await firestoreService.getUsers(foundCompany.id);
        if (companyUsers.length === 0) {
          setLoginError('Nessun utente trovato per questa azienda.');
          return;
        }
        setCompany(foundCompany);
        setUsers(companyUsers);
        setFilteredUsers(companyUsers);
        setLoginStep('user_selection');
      } else {
        setLoginError('Codice azienda non valido.');
      }
    } catch (err) {
      setLoginError('Errore durante la verifica del codice.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setLoginError('Seleziona il tuo nome dall\'elenco.');
      return;
    }
    setLoginStep('password');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (!selectedUser || !company) return;

    if (selectedUser.password !== loginPassword) {
      setLoginError('Password errata.');
      return;
    }

    if (!selectedUser.active) {
      setLoginError('Account disattivato dall\'amministratore.');
      return;
    }

    const localDeviceId = getLocalDeviceId();
    const isMobile = isMobileDevice();

    // Device Binding Logic
    if (isMobile) {
      if (!selectedUser.deviceId) {
        // Prima volta su mobile: lega il dispositivo
        const updatedUser = { ...selectedUser, deviceId: localDeviceId };
        setIsLoading(true);
        try {
          await firestoreService.saveUser(company.id, updatedUser);
          setSelectedUser(updatedUser);
        } catch (err) {
          setLoginError('Errore durante il collegamento del dispositivo.');
          setIsLoading(false);
          return;
        }
        setIsLoading(false);
      } else if (selectedUser.deviceId !== localDeviceId) {
        setLoginError('Questo account è già legato ad un altro cellulare. Contatta l\'amministratore per resettare il dispositivo.');
        return;
      }
    } else {
      // È un computer (o tablet grande)
      // Se l'utente ha già un dispositivo mobile legato, deve usare il codice di trasferimento
      if (selectedUser.deviceId && selectedUser.deviceId !== localDeviceId) {
        setLoginStep('transfer_code');
        return;
      }
    }

    if (selectedUser.mustChangePassword || selectedUser.password === '1234') {
      setUserToChangePassword(selectedUser);
    } else {
      onLogin(selectedUser);
    }
  };

  const handleTransferCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !company) return;
    setLoginError('');
    setIsLoading(true);

    try {
      const codeData = await firestoreService.getTransferCode(company.id, transferCodeInput.trim().toUpperCase());
      
      if (!codeData) {
        setLoginError('Codice non valido o già utilizzato.');
        setIsLoading(false);
        return;
      }

      if (codeData.userId !== selectedUser.id) {
        setLoginError('Questo codice non appartiene al tuo account.');
        setIsLoading(false);
        return;
      }

      const expiresAt = new Date(codeData.expiresAt).getTime();
      if (Date.now() > expiresAt) {
        setLoginError('Codice scaduto (validità 120 secondi). Generane uno nuovo dal cellulare.');
        setIsLoading(false);
        return;
      }

      // Codice valido: segna come usato e logga
      await firestoreService.markTransferCodeUsed(company.id, codeData.id);
      
      // Opzionale: lega anche questo dispositivo? 
      // L'utente dice "certificato del cellulare", quindi forse il PC non si lega per sempre o sì?
      // "LEGA IL LOGIN AL CELLULARE" -> Computer usa il codice per "entrare con un account certificato".
      // Lo consideriamo un login autorizzato una tantum o permanente? 
      // Di solito questi codici autorizzano la sessione.
      
      onLogin(selectedUser);
    } catch (err) {
      setLoginError('Errore durante la verifica del codice di trasferimento.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      alert('La password deve essere di almeno 4 caratteri.');
      return;
    }
    if (userToChangePassword) {
      const updatedUser: UserAccount = {
        ...userToChangePassword,
        password: newPassword,
        mustChangePassword: false,
      };
      onLogin(updatedUser);
    }
  };

  const handleRegisterAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCompanyName || !adminName || !adminUsername || !adminPassword) {
      alert('Compila tutti i campi obbligatori.');
      return;
    }

    const generatedCode = 'CANT-' + Math.floor(1000 + Math.random() * 9000);
    const newCompany: Company = {
      id: 'comp-' + Date.now(),
      name: adminCompanyName,
      code: generatedCode,
      adminName: adminName,
      createdAt: new Date().toISOString(),
    };

    const adminUser: UserAccount = {
      id: 'usr-' + Date.now(),
      companyCode: generatedCode,
      name: adminName,
      username: adminUsername,
      password: adminPassword,
      role: 'admin',
      mustChangePassword: false,
      phone: '',
      active: true,
    };

    onRegisterCompany(newCompany, adminUser);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-amber-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-slate-800/20 blur-[120px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-[440px] w-full relative"
      >
        <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[32px] p-8 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-slate-800/50 text-slate-100 ring-1 ring-white/5">
          
          {/* Brand Header */}
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-[1px] rounded-3xl mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)]"
            >
              <div className="w-full h-full bg-slate-950 rounded-[23px] flex items-center justify-center">
                <Building2 className="w-9 h-9 text-amber-500 stroke-[1.5]" />
              </div>
            </motion.div>
            
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2 font-display">CantieriCloud <span className="text-amber-500">Pro</span></h1>
            <p className="text-sm text-slate-400 font-medium max-w-[280px] mx-auto leading-relaxed">
              Gestione contabile avanzata per l'impresa edile moderna.
            </p>
            
            {company && mode === 'login' && loginStep !== 'company_code' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 flex items-center justify-center gap-2"
              >
                <div className="bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700/50 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,1)]"></div>
                  <span className="text-xs font-semibold text-slate-300">Azienda: <span className="text-white">{company.name}</span></span>
                </div>
              </motion.div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {userToChangePassword ? (
              <motion.form 
                key="password-change"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handlePasswordChangeSubmit} 
                className="space-y-6"
              >
                <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-[24px] space-y-2">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                    <Shield className="w-4 h-4" /> Sicurezza Account
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Benvenuto! È il tuo primo accesso. Per proteggere i tuoi dati, imposta una password personale definitiva.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Nuova Password Personale</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimo 4 caratteri..."
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pl-12 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-slate-700"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Configurazione Completata <ChevronRight className="w-4 h-4" />
                </button>
              </motion.form>
            ) : (
              <div key="auth-tabs">
                {/* Mode Selector Tabs */}
                {!company && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-[11px] text-emerald-400 font-medium mb-8 text-center">
                    Nessun server aziendale rilevato. Crea il tuo workspace per iniziare.
                  </div>
                )}
                
                {loginStep === 'company_code' && (
                  <div className="flex bg-slate-950/50 p-1 rounded-[20px] mb-8 border border-slate-800/50 ring-1 ring-white/5">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className={`flex-1 py-3 rounded-[16px] text-xs font-bold transition-all duration-300 ${
                        mode === 'login' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Login Aziendale
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('register_admin')}
                      className={`flex-1 py-3 rounded-[16px] text-xs font-bold transition-all duration-300 ${
                        mode === 'register_admin' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Crea Nuovo Server
                    </button>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {mode === 'login' && (
                    <div className="space-y-5">
                      {loginError && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-[11px] font-medium leading-relaxed"
                        >
                          {loginError}
                        </motion.div>
                      )}

                      {/* STEP 1: COMPANY CODE */}
                      {loginStep === 'company_code' && (
                        <motion.form 
                          key="step-code"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onSubmit={handleCompanyCodeSubmit}
                          className="space-y-5"
                        >
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Codice Server Aziendale</label>
                            <div className="relative group">
                              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                              <input
                                type="text"
                                value={inputCompanyCode}
                                onChange={(e) => setInputCompanyCode(e.target.value)}
                                placeholder="CANT-XXXX"
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pl-12 text-sm text-white uppercase outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-slate-700 font-mono"
                                required
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 px-1 leading-relaxed">
                              Inserisci il codice fornito dal tuo amministratore per accedere al listino utenti.
                            </p>
                          </div>
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verifica Codice <ArrowRight className="w-4 h-4" /></>}
                          </button>
                        </motion.form>
                      )}

                      {/* STEP 2: USER SELECTION */}
                      {loginStep === 'user_selection' && (
                        <motion.form 
                          key="step-user"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onSubmit={handleUserSelectionSubmit}
                          className="space-y-5"
                        >
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Chi sei?</label>
                            <div className="relative group">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                              <select
                                value={selectedUser?.id || ''}
                                onChange={(e) => {
                                  const u = filteredUsers.find(u => u.id === e.target.value);
                                  setSelectedUser(u || null);
                                }}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pl-12 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all appearance-none"
                                required
                              >
                                <option value="" disabled className="bg-slate-900">Seleziona il tuo nome...</option>
                                {filteredUsers.map(u => (
                                  <option key={u.id} value={u.id} className="bg-slate-900">
                                    {u.name} ({u.role === 'admin' ? 'Admin' : u.role === 'dirigente' ? 'Tecnico' : 'Operativo'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setLoginStep('company_code')}
                              className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all hover:bg-slate-700"
                            >
                              Indietro
                            </button>
                            <button
                              type="submit"
                              className="flex-[2] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98]"
                            >
                              Continua
                            </button>
                          </div>
                        </motion.form>
                      )}

                      {/* STEP 3: PASSWORD */}
                      {loginStep === 'password' && (
                        <motion.form 
                          key="step-password"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onSubmit={handleLoginSubmit}
                          className="space-y-5"
                        >
                          <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                              {selectedUser?.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{selectedUser?.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{selectedUser?.role}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Inserisci Password</label>
                            <div className="relative group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                              <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pl-12 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-slate-700"
                                required
                                autoFocus
                              />
                            </div>
                            {selectedUser?.password === '1234' && (
                              <p className="text-[10px] text-amber-500/80 mt-2 px-1 font-bold">
                                Password iniziale rilevata: 1234
                              </p>
                            )}
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setLoginStep('user_selection')}
                              className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all hover:bg-slate-700"
                            >
                              Cambia Utente
                            </button>
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="flex-[2] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Accedi'}
                            </button>
                          </div>
                        </motion.form>
                      )}

                      {/* STEP 4: TRANSFER CODE */}
                      {loginStep === 'transfer_code' && (
                        <motion.form 
                          key="step-transfer"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onSubmit={handleTransferCodeSubmit}
                          className="space-y-5"
                        >
                          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex items-center gap-4">
                            <Smartphone className="w-8 h-8 text-amber-500" />
                            <div>
                              <p className="text-[11px] font-bold text-white uppercase tracking-wider">Autorizzazione PC</p>
                              <p className="text-[10px] text-slate-400">Apri l'app sul cellulare e genera un <span className="text-amber-500 font-bold">Codice di Trasferimento</span>.</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Codice di 6 cifre</label>
                            <div className="relative group">
                              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                              <input
                                type="text"
                                value={transferCodeInput}
                                onChange={(e) => setTransferCodeInput(e.target.value.toUpperCase())}
                                placeholder="ES: AB12CD"
                                maxLength={6}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pl-12 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-slate-700 tracking-[0.2em] font-mono"
                                required
                                autoFocus
                              />
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setLoginStep('password')}
                              className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all hover:bg-slate-700"
                            >
                              Indietro
                            </button>
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="flex-[2] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Autorizza PC'}
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </div>
                  )}

                  {mode === 'register_admin' && (
                    <motion.form 
                      key="register-admin"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      onSubmit={handleRegisterAdminSubmit} 
                      className="space-y-4"
                    >
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl text-[11px] text-emerald-400 font-medium mb-2 leading-relaxed">
                        <span className="text-emerald-300 font-bold">Configurazione Server:</span> Inserisci i dati della tua impresa per generare il codice univoco aziendale.
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome Impresa / Società</label>
                          <input
                            type="text"
                            value={adminCompanyName}
                            onChange={(e) => setAdminCompanyName(e.target.value)}
                            placeholder="Es. Edilizia Pro Srl"
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                            required
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Amministratore Master</label>
                          <input
                            type="text"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="Nome e Cognome"
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Username Admin</label>
                            <input
                              type="text"
                              value={adminUsername}
                              onChange={(e) => setAdminUsername(e.target.value)}
                              placeholder="admin"
                              className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Password Sicura</label>
                            <input
                              type="password"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-3.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98]"
                      >
                        Inizializza Infrastruttura Cloud
                      </button>
                      
                      {company && (
                        <button
                          type="button"
                          onClick={() => setMode('login')}
                          className="w-full mt-2 text-slate-500 text-xs font-bold hover:text-slate-300 transition-all"
                        >
                          Annulla e torna al Login
                        </button>
                      )}
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
        </div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Secure Cloud Infrastructure • v2.0 Pro</p>
        </motion.div>
      </motion.div>
    </div>
  );
};
