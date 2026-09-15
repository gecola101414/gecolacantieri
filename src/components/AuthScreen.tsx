import React, { useState } from 'react';
import { UserAccount, Company, UserRole } from '../types';
import { Building2, Shield, Lock, User, KeyRound, ArrowRight, CheckCircle2, Sparkles, Smartphone, ChevronRight, Loader2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';
import { Logo, FooterBranding } from './Branding';

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

  // Login steps: 'company_code' -> 'user_selection' -> 'password' | 'transfer_code' | 'pairing_code'
  const [loginStep, setLoginStep] = useState<'company_code' | 'user_selection' | 'password' | 'transfer_code' | 'pairing_code'>(() => {
    if (typeof window !== 'undefined') {
      const pref = sessionStorage.getItem('preferred_auth_step');
      if (pref === 'transfer_code') {
        sessionStorage.removeItem('preferred_auth_step');
        return 'transfer_code';
      }
    }
    return 'company_code';
  });
  const [inputCompanyCode, setInputCompanyCode] = useState(() => {
    return localStorage.getItem('last_company_code') || '';
  });
  const [pairingCodeInput, setPairingCodeInput] = useState('');
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
        localStorage.setItem('last_company_code', code);
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
    setLoginError('');
    const codeStr = transferCodeInput.trim().toUpperCase();
    if (!codeStr || codeStr.length < 4) {
      setLoginError('Inserisci il codice di 6 caratteri generato dal tuo cellulare.');
      return;
    }
    setIsLoading(true);

    try {
      // 1. Risoluzione globale del codice PC (accesso diretto istantaneo)
      const res = await firestoreService.resolveTransferCode(codeStr);
      if (res) {
        const foundCompany = await firestoreService.getCompanyById(res.companyId);
        const foundUser = await firestoreService.getUserById(res.companyId, res.userId);
        if (foundCompany && foundUser) {
          if (!foundUser.active) {
            setLoginError('Account disattivato dall\'amministratore.');
            setIsLoading(false);
            return;
          }
          const companyUsers = await firestoreService.getUsers(foundCompany.id);
          setCompany(foundCompany);
          setUsers(companyUsers);
          localStorage.setItem('last_company_code', foundCompany.code);
          onLogin(foundUser);
          return;
        }
      }

      // 2. Fallback con ricerca specifica dell'azienda se già selezionata
      if (company) {
        const codeData = await firestoreService.getTransferCode(company.id, codeStr);
        if (codeData && !codeData.used) {
          const expiresAt = new Date(codeData.expiresAt).getTime();
          if (Date.now() <= expiresAt) {
            if (selectedUser && codeData.userId !== selectedUser.id) {
              setLoginError('Questo codice non appartiene all\'utente selezionato.');
              setIsLoading(false);
              return;
            }
            await firestoreService.markTransferCodeUsed(company.id, codeData.id);
            const foundUser = selectedUser || (await firestoreService.getUserById(company.id, codeData.userId));
            if (foundUser) {
              if (!foundUser.active) {
                setLoginError('Account disattivato dall\'amministratore.');
                setIsLoading(false);
                return;
              }
              onLogin(foundUser);
              return;
            }
          }
        }
      }

      setLoginError('Codice non valido, scaduto (validità 120s) o già utilizzato. Rigeneralo dal tuo cellulare.');
    } catch (err) {
      console.error('Error verifying transfer code:', err);
      setLoginError('Errore durante la verifica del codice di trasferimento.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePairingCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);
    const code = pairingCodeInput.trim();
    
    try {
      const pairingData = await firestoreService.resolvePairingCode(code);
      if (pairingData) {
        const foundCompany = await firestoreService.getCompanyById(pairingData.companyId);
        const foundUser = await firestoreService.getUserById(pairingData.companyId, pairingData.userId);
        
        if (foundCompany && foundUser) {
          const companyUsers = await firestoreService.getUsers(foundCompany.id);
          setCompany(foundCompany);
          setUsers(companyUsers);
          setSelectedUser(foundUser);
          
          const localDeviceId = getLocalDeviceId();
          const isMobile = isMobileDevice();
          
          if (isMobile) {
            // Lega il dispositivo mobile
            const updatedUser = { ...foundUser, deviceId: localDeviceId };
            await firestoreService.saveUser(foundCompany.id, updatedUser);
            onLogin(updatedUser);
          } else {
            // Su PC, il pairing code funge da login una tantum o autorizzazione
            onLogin(foundUser);
          }
        } else {
          setLoginError('Dati account non più validi.');
        }
      } else {
        setLoginError('Chiave non valida o scaduta (validità 30 min). Chiedi una nuova chiave all\'amministratore.');
      }
    } catch (err) {
      setLoginError('Errore durante la verifica della chiave.');
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-3.5 sm:p-6 relative overflow-x-hidden w-full max-w-full">
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
        <div className="bg-slate-900/40 backdrop-blur-3xl rounded-2xl sm:rounded-[32px] p-5 sm:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-slate-800/50 text-slate-100 ring-1 ring-white/5">
          
          {/* Brand Header */}
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-6"
            >
              <Logo className="justify-center" />
            </motion.div>
            
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
                      {/* Access method selector: Codice PC dal cellulare vs Codice Azienda */}
                      {(loginStep === 'company_code' || loginStep === 'transfer_code') && (
                        <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-1.5 rounded-2xl mb-2 border border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => {
                              setLoginError('');
                              setLoginStep('transfer_code');
                            }}
                            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                              loginStep === 'transfer_code'
                                ? 'bg-amber-500 text-slate-950 shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Codice da Cellulare</span>
                            </div>
                            <span className={`text-[9px] uppercase tracking-wider font-black ${loginStep === 'transfer_code' ? 'text-slate-950/80' : 'text-emerald-400'}`}>
                              ⚡ Accesso PC Rapido
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setLoginError('');
                              setLoginStep('company_code');
                            }}
                            className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                              loginStep === 'company_code'
                                ? 'bg-amber-500 text-slate-950 shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5" />
                              <span>Codice Azienda</span>
                            </div>
                            <span className={`text-[9px] uppercase tracking-wider font-extrabold ${loginStep === 'company_code' ? 'text-slate-950/80' : 'text-slate-500'}`}>
                              Password Classica
                            </span>
                          </button>
                        </div>
                      )}

                      {loginError && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-[11px] font-medium leading-relaxed text-left"
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
                          <div className="space-y-2 text-left">
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
                          <div className="flex flex-col gap-3">
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verifica Codice <ArrowRight className="w-4 h-4" /></>}
                            </button>
                            <div className="relative py-2">
                              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                              <div className="relative flex justify-center text-[10px] uppercase font-bold"><span className="bg-slate-900 px-2 text-slate-500 tracking-widest">oppure</span></div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginError('');
                                setLoginStep('transfer_code');
                              }}
                              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
                            >
                              <KeyRound className="w-4 h-4 text-emerald-400" /> Inserisci Codice dal Cellulare (6 caratteri)
                            </button>
                            <button
                              type="button"
                              onClick={() => setLoginStep('pairing_code')}
                              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
                            >
                              <Smartphone className="w-4 h-4 text-amber-500" /> Usa Chiave Mobile (4 cifre)
                            </button>
                          </div>
                        </motion.form>
                      )}

                      {/* STEP: PAIRING CODE */}
                      {loginStep === 'pairing_code' && (
                        <motion.form 
                          key="step-pairing"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onSubmit={handlePairingCodeSubmit}
                          className="space-y-5"
                        >
                          <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                              <KeyRound className="w-4 h-4" /> Configurazione Rapida
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Inserisci la chiave a 4 cifre generata dall'amministratore per autorizzare istantaneamente questo cellulare.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Chiave Mobile (4 cifre)</label>
                            <input
                              type="text"
                              value={pairingCodeInput}
                              onChange={(e) => setPairingCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="0 0 0 0"
                              className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl p-6 text-center text-4xl font-black tracking-[0.5em] text-amber-500 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                              required
                              autoFocus
                            />
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setLoginStep('company_code')}
                              className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all hover:bg-slate-700"
                            >
                              Annulla
                            </button>
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="flex-[2] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Autorizza Dispositivo'}
                            </button>
                          </div>
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
                          <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl space-y-2 text-left">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                              <Smartphone className="w-4 h-4" /> Come usare il codice sul PC
                            </div>
                            <ol className="text-[11px] text-slate-300 leading-relaxed list-decimal list-inside space-y-1">
                              <li>Apri l'app sul cellulare dove sei già autenticato.</li>
                              <li>Tocca il pulsante <span className="text-amber-400 font-bold">"Codice PC"</span> in alto nella barra.</li>
                              <li>Digita qui sotto il codice di 6 caratteri (es. <span className="font-mono font-bold text-emerald-300">AB12CD</span>).</li>
                            </ol>
                          </div>

                          <div className="space-y-2 text-left">
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                              Codice Temporaneo da Cellulare (6 caratteri)
                            </label>
                            <div className="relative group">
                              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 group-focus-within:text-amber-400 transition-colors" />
                              <input
                                type="text"
                                value={transferCodeInput}
                                onChange={(e) => setTransferCodeInput(e.target.value.toUpperCase())}
                                placeholder="ES: AB12CD"
                                maxLength={6}
                                className="w-full bg-slate-950/70 border-2 border-emerald-500/40 rounded-2xl p-4 pl-12 text-center text-xl sm:text-2xl font-black text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 transition-all placeholder:text-slate-700 tracking-[0.25em] font-mono uppercase"
                                required
                                autoFocus
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 text-center">
                              Accesso istantaneo senza dover reinserire password o codice server.
                            </p>
                          </div>

                          <div className="flex flex-col gap-2.5">
                            <button
                              type="submit"
                              disabled={isLoading || transferCodeInput.trim().length < 4}
                              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                            >
                              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entra nel PC <ArrowRight className="w-4 h-4" /></>}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLoginError('');
                                if (selectedUser) {
                                  setLoginStep('password');
                                } else {
                                  setLoginStep('company_code');
                                }
                              }}
                              className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white font-medium py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
                            >
                              Torna al Login con Codice Azienda
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
          <FooterBranding />
        </motion.div>
      </motion.div>
    </div>
  );
};
