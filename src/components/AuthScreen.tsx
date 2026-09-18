import React, { useState, useEffect } from 'react';
import { UserAccount, Company } from '../types';
import { 
  Building2, 
  Shield, 
  Lock, 
  User, 
  KeyRound, 
  ArrowRight, 
  ArrowLeft, 
  Timer, 
  Sparkles, 
  Smartphone, 
  ChevronRight, 
  Loader2, 
  Server,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Radio
} from 'lucide-react';
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
  users: _users,
  onRegisterCompany,
  onLogin,
  onRegisterCollaborator: _onRegisterCollaborator,
  setCompany,
  setUsers,
}) => {
  // Intro presentation with advancing logo
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Show intro on first session load
    const shown = sessionStorage.getItem('cantieri_intro_seen');
    if (!shown) {
      sessionStorage.setItem('cantieri_intro_seen', 'true');
      return true;
    }
    return false;
  });

  // Main navigation state: 'menu' | 'personal_code' | 'company_code' | 'new_server'
  const [activeView, setActiveView] = useState<'menu' | 'personal_code' | 'company_code' | 'new_server'>('menu');

  // Company Code flow steps: 'input_company' -> 'select_user' -> 'password'
  const [companyStep, setCompanyStep] = useState<'input_company' | 'select_user' | 'password'>('input_company');

  // Input states
  const [inputCompanyCode, setInputCompanyCode] = useState(() => {
    return localStorage.getItem('last_company_code') || '';
  });
  const [personalCodeInput, setPersonalCodeInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<UserAccount[]>([]);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // First login password reset modal
  const [userToChangePassword, setUserToChangePassword] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Register Admin form state
  const [adminCompanyName, setAdminCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Automatic timer to conclude intro if not tapped
  useEffect(() => {
    if (!showIntro) return;
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, [showIntro]);

  // Mobile Device Pairing State (4 Cifre - 2 Minuti)
  const [mobileCode, setMobileCode] = useState<string>('');
  const [mobileCodeTimeLeft, setMobileCodeTimeLeft] = useState<number>(120);
  const [isPairingApproved, setIsPairingApproved] = useState<boolean>(false);
  const [isGeneratingMobileCode, setIsGeneratingMobileCode] = useState<boolean>(false);
  const [copiedMobileCode, setCopiedMobileCode] = useState<boolean>(false);
  const [showManualCodeInput, setShowManualCodeInput] = useState<boolean>(false);

  // Genera chiave a 4 cifre per accoppiare questo cellulare al server aziendale
  const generateNewMobileCode = async () => {
    setIsGeneratingMobileCode(true);
    setLoginError('');
    setIsPairingApproved(false);
    
    // Codice numerico a 4 cifre
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const deviceId = getLocalDeviceId();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'Mobile Phone';

    try {
      await firestoreService.createMobilePairingRequest(code, deviceId, userAgent);
      setMobileCode(code);
      setMobileCodeTimeLeft(120); // 2 minuti esatti
    } catch (err) {
      console.error('Error creating mobile pairing code:', err);
      setLoginError('Impossibile generare la chiave. Verifica la connessione internet.');
    } finally {
      setIsGeneratingMobileCode(false);
    }
  };

  // Quando si entra nella schermata del Codice Personale, genera automaticamente la chiave a 4 cifre
  useEffect(() => {
    if (activeView === 'personal_code' && !mobileCode && !showManualCodeInput) {
      generateNewMobileCode();
    }
  }, [activeView]);

  // Countdown timer dei 2 minuti (120 secondi, poi scade e scompare)
  useEffect(() => {
    if (activeView !== 'personal_code' || !mobileCode || mobileCodeTimeLeft <= 0 || isPairingApproved) {
      return;
    }
    const interval = setInterval(() => {
      setMobileCodeTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeView, mobileCode, mobileCodeTimeLeft, isPairingApproved]);

  // Ascolto in tempo reale: non appena l'amministratore inserisce la chiave sul server, il cellulare entra automaticamente!
  useEffect(() => {
    if (activeView !== 'personal_code' || !mobileCode || mobileCodeTimeLeft <= 0 || isPairingApproved) {
      return;
    }

    const unsubscribe = firestoreService.listenMobilePairingRequest(mobileCode, async (compDocId, userDocId) => {
      if (compDocId && userDocId) {
        setIsPairingApproved(true);
        setIsLoading(true);
        try {
          const comp = await firestoreService.getCompanyById(compDocId);
          if (comp) {
            const user = await firestoreService.getUserById(compDocId, userDocId);
            const allUsers = await firestoreService.getUsers(compDocId);
            if (user) {
              setCompany(comp);
              setUsers(allUsers.length > 0 ? allUsers : [user]);
              localStorage.setItem('last_company_code', comp.code);
              setTimeout(() => {
                onLogin(user);
              }, 1200);
              return;
            }
          }
          setLoginError('Dispositivo autorizzato dal server, ma errore nel caricamento dati.');
        } catch (err) {
          console.error('Login after pairing error:', err);
          setLoginError('Errore durante l\'accesso automatico.');
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeView, mobileCode, mobileCodeTimeLeft, isPairingApproved]);

  // Reset errors when switching views
  const switchView = (view: 'menu' | 'personal_code' | 'company_code' | 'new_server') => {
    setLoginError('');
    setActiveView(view);
  };

  // --- 1. PERSONAL CODE SUBMISSION (4 CIFRE, DURA 2 MINUTI) ---
  const handlePersonalCodeSubmit = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    setLoginError('');
    const raw = overrideCode !== undefined ? overrideCode : personalCodeInput;
    const codeStr = raw.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    if (!codeStr || codeStr.length < 4) {
      setLoginError('Inserisci il codice a 4 cifre.');
      return;
    }
    
    setIsLoading(true);

    try {
      // 1. Direct resolution in transferCodes
      const res = await firestoreService.resolveTransferCode(codeStr);
      if (res && res.company && res.user) {
        const foundCompany = res.company;
        const foundUser = res.user;
        if (!foundUser.active) {
          setLoginError('Account disattivato dall\'amministratore.');
          setIsLoading(false);
          return;
        }
        const companyUsers = await firestoreService.getUsers(foundCompany.id);
        setCompany(foundCompany);
        setUsers(companyUsers.length > 0 ? companyUsers : [foundUser]);
        localStorage.setItem('last_company_code', foundCompany.code);
        onLogin(foundUser);
        return;
      }

      // 2. Fallback checking company subcollection if company is known
      if (company) {
        const codeData = await firestoreService.getTransferCode(company.id, codeStr);
        if (codeData && !codeData.used) {
          const expTime = new Date(codeData.expiresAt).getTime();
          if (Date.now() <= expTime + 20 * 1000) {
            await firestoreService.markTransferCodeUsed(company.id, codeData.id);
            const foundUser = await firestoreService.getUserById(company.id, codeData.userId);
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

      setLoginError('Codice non valido o scaduto. Ricorda che i codici personali a 4 cifre durano solo 2 minuti per sicurezza. Generane uno nuovo dal cellulare.');
    } catch (err) {
      console.error('Error verifying personal code:', err);
      setLoginError('Errore durante la verifica del codice personale.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. COMPANY SERVER CODE FLOW ---
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
          setLoginError('Nessun utente configurato per questo server aziendale.');
          return;
        }
        setCompany(foundCompany);
        setUsers(companyUsers);
        setFilteredUsers(companyUsers);
        localStorage.setItem('last_company_code', code);
        setCompanyStep('select_user');
      } else {
        setLoginError('Codice azienda non trovato. Verifica il codice CANT-XXXX.');
      }
    } catch (err) {
      setLoginError('Errore durante la ricerca dell\'azienda.');
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
    setCompanyStep('password');
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

    // Mobile device binding
    if (isMobile) {
      if (!selectedUser.deviceId) {
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
        setLoginError('Questo account è già legato ad un altro cellulare. Chiedi all\'amministratore il reset del dispositivo.');
        return;
      }
    }

    if (selectedUser.mustChangePassword || selectedUser.password === '1234') {
      setUserToChangePassword(selectedUser);
    } else {
      onLogin(selectedUser);
    }
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      alert('La password deve contenere almeno 4 caratteri.');
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

  // --- 3. CREATE NEW COMPANY SERVER ---
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-3.5 sm:p-6 relative overflow-x-hidden w-full max-w-full box-border">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 blur-[130px] rounded-full"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-600/10 blur-[140px] rounded-full"></div>
        <div 
          className="absolute inset-0 opacity-[0.025] pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        ></div>
      </div>

      {/* --- INTRO PRESENTAZIONE CON IL LOGO CHE AVANZA --- */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            onClick={() => setShowIntro(false)}
            className="fixed inset-0 z-[500] bg-slate-950 flex flex-col items-center justify-center p-6 cursor-pointer select-none overflow-hidden"
          >
            {/* Pulsing focal glow */}
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.8, 1.3, 1.1], opacity: [0.2, 0.6, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-72 h-72 rounded-full bg-amber-500/20 blur-[90px] pointer-events-none"
            />

            {/* Logo that advances forward */}
            <motion.div
              initial={{ scale: 0.35, opacity: 0, y: 50 }}
              animate={{ scale: [0.35, 1.2, 1.05], opacity: [0, 1, 1], y: [50, -10, 0] }}
              transition={{ duration: 1.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.25)] backdrop-blur-xl mb-4">
                <Logo className="justify-center scale-110 sm:scale-125 origin-center" />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="space-y-1.5 mt-2"
              >
                <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                    Piattaforma Cantieri Cloud
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium max-w-[260px] mx-auto pt-1">
                  Gestione avanzata per cantieri, operai, mezzi e contabilità
                </p>
              </motion.div>
            </motion.div>

            {/* Tap to skip hint */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              className="absolute bottom-8 text-center"
            >
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-900/80 px-3.5 py-1.5 rounded-full border border-slate-800">
                Tocca lo schermo per continuare →
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- CONTENUTO PRINCIPALE AUTH SCREEN --- */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px] relative z-10 box-border overflow-hidden"
      >
        <div className="bg-slate-900/60 backdrop-blur-3xl rounded-3xl p-4 sm:p-7 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)] border border-slate-800/80 text-slate-100 ring-1 ring-white/5 box-border">
          
          {/* Top Brand Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <Logo className="justify-center scale-90 sm:scale-100 origin-center" />
            </div>
            
            <p className="text-xs text-slate-400 font-medium max-w-[300px] mx-auto leading-relaxed">
              Gestione cantieri, personale, mezzi e contabilità in Cloud.
            </p>

            {company && activeView === 'company_code' && companyStep !== 'input_company' && (
              <div className="mt-4 flex items-center justify-center">
                <div className="bg-slate-800/90 px-3.5 py-1.5 rounded-2xl border border-slate-700/60 flex items-center gap-2 max-w-full">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,1)] shrink-0"></div>
                  <span className="text-xs font-semibold text-slate-300 truncate">
                    Azienda: <strong className="text-white">{company.name}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Global Error Banner */}
          {loginError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs font-medium leading-relaxed"
            >
              {loginError}
            </motion.div>
          )}

          {/* FIRST LOGIN PASSWORD CHANGE MODAL */}
          <AnimatePresence mode="wait">
            {userToChangePassword ? (
              <motion.form 
                key="password-change"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handlePasswordChangeSubmit} 
                className="space-y-5"
              >
                <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <Shield className="w-4 h-4" /> Sicurezza Primo Accesso
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Benvenuto! È il tuo primo accesso. Per proteggere i tuoi dati aziendali, imposta la tua password personale.
                  </p>
                </div>
                
                <div className="space-y-1.5 text-left">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Nuova Password Personale
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimo 4 caratteri..."
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 pl-12 text-base sm:text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-slate-700"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Conferma e Accedi</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.form>
            ) : (
              <div>
                {/* ========================================================= */}
                {/* 1. PAGINA INIZIALE CON LE 3 OPZIONI (MENU PRINCIPALE)     */}
                {/* ========================================================= */}
                {activeView === 'menu' && (
                  <motion.div
                    key="view-menu"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-3.5"
                  >
                    <div className="text-center pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60">
                        Scegli come accedere
                      </span>
                    </div>

                    {/* OPZIONE 1 (AL PRIMO POSTO): ENTRA CON CODICE PERSONALE */}
                    <button
                      type="button"
                      onClick={() => switchView('personal_code')}
                      className="w-full bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-slate-900 border-2 border-amber-500/50 hover:border-amber-400 p-4 sm:p-5 rounded-2xl text-left transition-all active:scale-[0.98] group shadow-[0_8px_24px_-8px_rgba(245,158,11,0.25)] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-black text-white tracking-tight uppercase group-hover:text-amber-300 transition-colors">
                              Entra con Codice Personale
                            </h3>
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40">
                              4 Cifre • 2 Minuti
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 font-medium leading-snug">
                            Accesso rapido a 4 cifre generato dal tuo cellulare. Scade dopo soli 2 minuti e scompare.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-amber-400 shrink-0 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* OPZIONE 2: ENTRA CON CODICE AZIENDALE */}
                    <button
                      type="button"
                      onClick={() => switchView('company_code')}
                      className="w-full bg-slate-800/70 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 p-4 sm:p-5 rounded-2xl text-left transition-all active:scale-[0.98] group flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          <Building2 className="w-5 h-5 text-slate-200" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-black text-white tracking-tight uppercase group-hover:text-slate-200 transition-colors">
                              Entra con Codice Aziendale
                            </h3>
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                              CANT-XXXX
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium leading-snug">
                            Accedi selezionando l'azienda e il tuo profilo con la password personale.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-400 shrink-0 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* OPZIONE 3 (ULTIMO): CREA NUOVO SERVER AZIENDALE */}
                    <button
                      type="button"
                      onClick={() => switchView('new_server')}
                      className="w-full bg-slate-900/90 hover:bg-slate-800/90 border border-emerald-500/30 hover:border-emerald-500/60 p-4 sm:p-5 rounded-2xl text-left transition-all active:scale-[0.98] group flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          <Server className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-black text-white tracking-tight uppercase group-hover:text-emerald-300 transition-colors">
                              Crea Nuovo Server Aziendale
                            </h3>
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Nuova Impresa
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium leading-snug">
                            Inizializza una nuova azienda edile e genera il codice server master.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-emerald-400 shrink-0 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 2. OPZIONE 1: CODICE PERSONALE (4 CIFRE - 2 MINUTI)        */}
                {/* ========================================================= */}
                {activeView === 'personal_code' && (
                  <motion.div
                    key="view-personal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* Header with back button */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowManualCodeInput(false);
                          switchView('menu');
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Torna alle opzioni</span>
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {showManualCodeInput ? 'Inserimento Manuale' : 'Chiave Cellulare'}
                      </span>
                    </div>

                    {isPairingApproved ? (
                      /* STATO DI SUCCESSO: CELLULARE AUTORIZZATO DALL'AMMINISTRATORE */
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-gradient-to-b from-emerald-500/20 to-slate-900 border border-emerald-500/40 p-6 rounded-3xl text-center space-y-3"
                      >
                        <div className="w-14 h-14 bg-emerald-500 text-slate-950 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">
                          Cellulare Collegato con Successo!
                        </h3>
                        <p className="text-xs text-emerald-300 font-medium leading-relaxed">
                          L'amministratore ha memorizzato questo dispositivo sul server.
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                          <span>Accesso in corso all'ambiente di lavoro...</span>
                        </div>
                      </motion.div>
                    ) : !showManualCodeInput ? (
                      /* FLUSSO PRINCIPALE: IL CELLULARE GENERA IL CODICE A 4 CIFRE CHE DURA 2 MINUTI */
                      <div className="space-y-4">
                        {/* Box Codice Generato */}
                        <div className="bg-slate-950/80 border border-amber-500/30 rounded-3xl p-5 text-center relative overflow-hidden shadow-2xl shadow-amber-500/5">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/90 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Chiave Mobile Generata
                            </span>
                            
                            {/* Timer 2 minuti */}
                            <div className={`flex items-center gap-1 text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full border ${
                              mobileCodeTimeLeft > 30 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                : mobileCodeTimeLeft > 0 
                                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse'
                                  : 'bg-slate-800 text-slate-500 border-slate-700'
                            }`}>
                              <Timer className="w-3.5 h-3.5" />
                              {mobileCodeTimeLeft > 0 ? (
                                <span>{Math.floor(mobileCodeTimeLeft / 60)}:{(mobileCodeTimeLeft % 60).toString().padStart(2, '0')}</span>
                              ) : (
                                <span>SCADUTO</span>
                              )}
                            </div>
                          </div>

                          {mobileCodeTimeLeft > 0 && mobileCode ? (
                            <div>
                              {/* Display 4 Cifre in tessere grandi */}
                              <div className="flex items-center justify-center gap-2.5 my-4">
                                {mobileCode.split('').map((char, i) => (
                                  <div
                                    key={i}
                                    className="w-13 h-16 sm:w-14 sm:h-18 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-amber-500/50 shadow-inner flex items-center justify-center text-3xl sm:text-4xl font-black font-mono text-amber-300"
                                  >
                                    {char}
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(mobileCode);
                                    setCopiedMobileCode(true);
                                    setTimeout(() => setCopiedMobileCode(false), 2000);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                >
                                  {copiedMobileCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                  <span>{copiedMobileCode ? 'Copiato!' : 'Copia Codice'}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* CODICE SCOMPARSO PERCHÈ SCADUTO */
                            <div className="py-5 space-y-3">
                              <p className="text-xs text-rose-300 font-semibold">
                                La chiave a 4 cifre è scaduta dopo 2 minuti ed è scomparsa per sicurezza.
                              </p>
                              <button
                                type="button"
                                onClick={generateNewMobileCode}
                                disabled={isGeneratingMobileCode}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
                              >
                                <RefreshCw className={`w-4 h-4 ${isGeneratingMobileCode ? 'animate-spin' : ''}`} />
                                <span>Genera Nuova Chiave a 4 Cifre</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Istruzioni pratiche per l'operatore */}
                        {mobileCodeTimeLeft > 0 && (
                          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-2.5 text-left">
                            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-amber-400" /> Come funziona il collegamento:
                            </h4>
                            <ol className="text-[11px] text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                              <li>
                                Comunica questa <strong>chiave a 4 cifre</strong> all'amministratore del server in ufficio.
                              </li>
                              <li>
                                L'amministratore premerà la <strong>CHIAVE</strong> sul tuo profilo nell'elenco account.
                              </li>
                              <li>
                                Il server memorizzerà i dati di questo cellulare e questo schermo si collegherà <strong>automaticamente</strong>!
                              </li>
                            </ol>

                            {/* Radar pulsante in attesa dell'amministratore */}
                            <div className="pt-2 flex items-center justify-center gap-2 text-xs font-semibold text-amber-400/90 bg-amber-500/10 py-2.5 px-3 rounded-xl border border-amber-500/20">
                              <div className="relative flex items-center justify-center w-3 h-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </div>
                              <span className="text-[11px]">In attesa del caricamento dell'amministratore...</span>
                            </div>
                          </div>
                        )}

                        {/* Tasto per passare alla digitazione manuale */}
                        <div className="pt-1 text-center">
                          <button
                            type="button"
                            onClick={() => setShowManualCodeInput(true)}
                            className="text-[11px] font-semibold text-slate-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer transition-colors"
                          >
                            Oppure inserisci manualmente un codice già fornito
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* FLUSSO ALTERNATIVO: DIGITAZIONE MANUALE DEL CODICE A 4 CIFRE */
                      <form onSubmit={handlePersonalCodeSubmit} className="space-y-4">
                        <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl space-y-1.5 text-left">
                          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                            <Timer className="w-4 h-4" /> Inserimento Manuale Chiave
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Se l'amministratore ti ha fornito un codice temporaneo di accesso, inseriscilo qui sotto.
                          </p>
                        </div>

                        <div className="space-y-2 text-center">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            Digita Chiave a 4 Cifre
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={personalCodeInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
                              setPersonalCodeInput(val);
                              if (val.length === 4) {
                                handlePersonalCodeSubmit(undefined, val);
                              }
                            }}
                            placeholder="0000"
                            autoFocus
                            className="w-full bg-slate-950/80 border-2 border-amber-500/40 rounded-3xl p-4 text-center text-3xl sm:text-4xl font-black font-mono tracking-[0.4em] sm:tracking-[0.5em] text-amber-400 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 transition-all placeholder:text-slate-800 uppercase"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading || personalCodeInput.trim().length < 4}
                          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <>
                              <span>Verifica ed Entra</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>

                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => setShowManualCodeInput(false)}
                            className="text-[11px] font-semibold text-slate-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer"
                          >
                            Torna a genera chiave per questo cellulare
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 3. OPZIONE 2: CODICE AZIENDALE                            */}
                {/* ========================================================= */}
                {activeView === 'company_code' && (
                  <motion.div
                    key="view-company"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* Header with back button */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (companyStep === 'password') {
                            setCompanyStep('select_user');
                          } else if (companyStep === 'select_user') {
                            setCompanyStep('input_company');
                          } else {
                            switchView('menu');
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>{companyStep === 'input_company' ? 'Torna alle opzioni' : 'Indietro'}</span>
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {companyStep === 'input_company' ? 'Passo 1/3' : companyStep === 'select_user' ? 'Passo 2/3' : 'Passo 3/3'}
                      </span>
                    </div>

                    {/* Step 1: Inserisci codice azienda */}
                    {companyStep === 'input_company' && (
                      <form onSubmit={handleCompanyCodeSubmit} className="space-y-4 text-left">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Codice Server Aziendale
                          </label>
                          <div className="relative flex items-center">
                            <Building2 className="absolute left-4 z-10 w-4 h-4 text-slate-500" />
                            <div className="absolute left-10 z-10 text-sm font-mono font-bold text-slate-500">
                              CANT-
                            </div>
                            <input
                              type="text"
                              value={inputCompanyCode.replace(/^CANT-?/, '')}
                              onChange={(e) => setInputCompanyCode('CANT-' + e.target.value.replace(/\D/g, ''))}
                              placeholder="XXXX"
                              className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 pl-[88px] text-base sm:text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all font-mono"
                              required
                              autoFocus
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 px-1">
                            Inserisci le cifre del codice server fornito dall'amministratore (es. CANT-1234).
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading || inputCompanyCode.trim().length < 6}
                          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <span>Trova Azienda</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {/* Step 2: Seleziona utente */}
                    {companyStep === 'select_user' && (
                      <form onSubmit={handleUserSelectionSubmit} className="space-y-4 text-left">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Chi sei? Seleziona il tuo Profilo
                          </label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <select
                              value={selectedUser?.id || ''}
                              onChange={(e) => {
                                const u = filteredUsers.find(u => u.id === e.target.value);
                                setSelectedUser(u || null);
                              }}
                              className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 pl-12 text-base sm:text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all appearance-none cursor-pointer"
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

                        <button
                          type="submit"
                          disabled={!selectedUser}
                          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Continua con Password</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    )}

                    {/* Step 3: Inserisci Password */}
                    {companyStep === 'password' && (
                      <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                        <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                            {selectedUser?.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{selectedUser?.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{selectedUser?.role}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Password Account
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                              type="password"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 pl-12 text-base sm:text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder:text-slate-700"
                              required
                              autoFocus
                            />
                          </div>
                          {selectedUser?.password === '1234' && (
                            <p className="text-[10px] text-amber-400/90 px-1 font-bold">
                              Password iniziale di fabbrica: 1234
                            </p>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Accedi al Cantiere'}
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 4. OPZIONE 3 (ULTIMO): CREA NUOVO SERVER AZIENDALE        */}
                {/* ========================================================= */}
                {activeView === 'new_server' && (
                  <motion.div
                    key="view-new-server"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* Header with back button */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <button
                        type="button"
                        onClick={() => switchView('menu')}
                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Torna alle opzioni</span>
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Nuova Impresa
                      </span>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/25 p-3.5 rounded-2xl text-[11px] text-emerald-300 font-medium text-left leading-relaxed">
                      <strong>Nuovo Server Cloud:</strong> Inserisci i dati della tua impresa per attivare il server aziendale dedicato e creare l'amministratore master.
                    </div>

                    <form onSubmit={handleRegisterAdminSubmit} className="space-y-3.5 text-left">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                          Ragione Sociale / Impresa Edile *
                        </label>
                        <input
                          type="text"
                          value={adminCompanyName}
                          onChange={(e) => setAdminCompanyName(e.target.value)}
                          placeholder="Es. Edilizia Pro Srl"
                          className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-base sm:text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                          Amministratore Master (Nome e Cognome) *
                        </label>
                        <input
                          type="text"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="Mario Rossi"
                          className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-base sm:text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Username Admin *
                          </label>
                          <input
                            type="text"
                            value={adminUsername}
                            onChange={(e) => setAdminUsername(e.target.value)}
                            placeholder="admin"
                            className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-base sm:text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Password Master *
                          </label>
                          <input
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-base sm:text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Inizializza Server Cloud</span>
                      </button>
                    </form>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info branding */}
        <div className="mt-6 text-center">
          <FooterBranding />
        </div>
      </motion.div>
    </div>
  );
};
