import React, { useState, useEffect } from 'react';
import { 
  saveCurrentUser as saveLocalUser, 
  loadAppData,
  saveCompany as saveLocalCompany
} from './utils/storage';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { MobileRapportinoView } from './components/MobileRapportinoView';
import { AuthScreen } from './components/AuthScreen';
import { AccountDeactivatedScreen } from './components/AccountDeactivatedScreen';
import { PWAInstallButton } from './components/PWAInstallButton';
import { UserAccount, Company, Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry, Materiale, StockMovement, MaterialDocument, TransferCode } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Loader2, Globe } from 'lucide-react';
import { firestoreService } from './lib/firestoreService';
import { db } from './lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { Logo } from './components/Branding';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  
  const initialLocalData = loadAppData();

  const [company, setCompany] = useState<Company | null>(initialLocalData.company);
  const [users, setUsers] = useState<UserAccount[]>(initialLocalData.users);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(initialLocalData.currentUser);
  
  const [cantieri, setCantieri] = useState<Cantiere[]>(initialLocalData.cantieri);
  const [personale, setPersonale] = useState<Personale[]>(initialLocalData.personale);
  const [mezzi, setMezzi] = useState<Mezzo[]>(initialLocalData.mezzi);
  const [contabilita, setContabilita] = useState<ContabilitaEntry[]>(initialLocalData.contabilita);
  const [rapportini, setRapportini] = useState<Rapportino[]>(initialLocalData.rapportini);
  const [materiali, setMateriali] = useState<Materiale[]>(initialLocalData.materiali || []);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [documents, setDocuments] = useState<MaterialDocument[]>([]);

  const [isMobileView, setIsMobileView] = useState<boolean>(initialLocalData.currentUser?.role === 'operativo');
  const [activeTab, setActiveTab] = useState<'panoramica' | 'cantieri' | 'personale' | 'mezzi' | 'rapportini' | 'utenti' | 'materiali' | 'contabilita'>('panoramica');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Transfer Code Logic (accessible from mobile top bar)
  const [activeTransferCode, setActiveTransferCode] = useState<TransferCode | null>(null);
  const [transferTimeLeft, setTransferTimeLeft] = useState(0);
  const [isGeneratingTransferCode, setIsGeneratingTransferCode] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (transferTimeLeft > 0) {
      timer = setInterval(() => {
        setTransferTimeLeft(prev => prev - 1);
      }, 1000);
    } else {
      setActiveTransferCode(null);
    }
    return () => clearInterval(timer);
  }, [transferTimeLeft]);

  const handleGenerateTransferCode = async () => {
    if (!currentUser?.active) {
      alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore.');
      return;
    }
    if (!company) return;
    setIsGeneratingTransferCode(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCode: TransferCode = {
      id: 'tc-' + Date.now(),
      code,
      userId: currentUser.id,
      expiresAt: new Date(Date.now() + 600 * 1000).toISOString(),
      used: false
    };
    try {
      await firestoreService.saveTransferCode(company, currentUser, newCode);
      setActiveTransferCode(newCode);
      setTransferTimeLeft(600);
    } catch (err) {
      console.error('Transfer code error:', err);
      alert('Errore nella generazione del codice di trasferimento.');
    } finally {
      setIsGeneratingTransferCode(false);
    }
  };

  // Persistence to localStorage for "Device Binding"
  useEffect(() => { 
    saveLocalCompany(company); 
  }, [company]);

  useEffect(() => { 
    saveLocalUser(currentUser); 
    if (currentUser) {
      setIsMobileView(currentUser.role === 'operativo');
    }
  }, [currentUser]);

  // Real-time Cloud Sync
  useEffect(() => {
    if (!company) return;

    setIsCloudLoading(true);

    const unsubCompany = onSnapshot(doc(db, 'companies', company.id), (snap) => {
      if (snap.exists()) {
        setCompany(snap.data() as Company);
      }
    });

    const unsubUsers = onSnapshot(collection(db, 'companies', company.id, 'users'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as UserAccount);
      setUsers(data);
      // Synchronize currentUser if updated or deactivated in cloud
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        const updated = data.find(u => u.id === prevUser.id);
        if (!updated) {
          // Account was deleted on server
          return null;
        }
        return updated;
      });
    });

    const unsubCantieri = onSnapshot(collection(db, 'companies', company.id, 'cantieri'), (snap) => {
      setCantieri(snap.docs.map(doc => doc.data() as Cantiere));
    });

    const unsubPersonale = onSnapshot(collection(db, 'companies', company.id, 'personale'), (snap) => {
      setPersonale(snap.docs.map(doc => doc.data() as Personale));
    });

    const unsubMezzi = onSnapshot(collection(db, 'companies', company.id, 'mezzi'), (snap) => {
      setMezzi(snap.docs.map(doc => doc.data() as Mezzo));
    });

    const unsubRapportini = onSnapshot(collection(db, 'companies', company.id, 'rapportini'), (snap) => {
      setRapportini(snap.docs.map(doc => doc.data() as Rapportino));
    });

    const unsubContabilita = onSnapshot(collection(db, 'companies', company.id, 'contabilita'), (snap) => {
      setContabilita(snap.docs.map(doc => doc.data() as ContabilitaEntry));
    });

    const unsubMateriali = onSnapshot(collection(db, 'companies', company.id, 'materiali'), (snap) => {
      setMateriali(snap.docs.map(doc => doc.data() as Materiale));
    });

    const unsubMovements = onSnapshot(collection(db, 'companies', company.id, 'movements'), (snap) => {
      setMovements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement)));
    });

    const unsubDocuments = onSnapshot(collection(db, 'companies', company.id, 'documents'), (snap) => {
      setDocuments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialDocument)));
    });

    setIsCloudLoading(false);

    return () => {
      unsubCompany();
      unsubUsers();
      unsubCantieri();
      unsubPersonale();
      unsubMezzi();
      unsubRapportini();
      unsubContabilita();
      unsubMateriali();
      unsubMovements();
      unsubDocuments();
    };
  }, [company?.id]);

  // Dedicated real-time listener on active user account to immediately intercept admin deactivations
  useEffect(() => {
    if (!company || !currentUser?.id) return;

    const userDocRef = doc(db, 'companies', company.id, 'users', currentUser.id);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const cloudUser = snap.data() as UserAccount;
        setCurrentUser(prev => {
          if (!prev || prev.id !== cloudUser.id) return prev;
          return cloudUser;
        });
      } else {
        // Account deleted from server
        setCurrentUser(null);
      }
    });

    return () => unsubUser();
  }, [company?.id, currentUser?.id]);

  // Splash effect
  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleRegisterCompany = async (newCompany: Company, adminUser: UserAccount) => {
    await firestoreService.saveCompany(newCompany);
    await firestoreService.saveUser(newCompany.id, adminUser);
    setCompany(newCompany);
    setCurrentUser(adminUser);
  };

  const handleLogin = async (user: UserAccount) => {
    // Refresh user data from cloud before logging in
    if (company) {
      const cloudUsers = await firestoreService.getUsers(company.id);
      const cloudUser = cloudUsers.find(u => u.id === user.id);
      if (cloudUser) {
        if (!cloudUser.active) {
          alert('Impossibile accedere: utenza disattivata dall\'amministratore aziendale.');
          return;
        }
        // Update in cloud if mustChangePassword was cleared
        if (user.password !== cloudUser.password) {
          await firestoreService.saveUser(company.id, user);
        }
        setCurrentUser(cloudUser);
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCompany(null); // Full logout as per "bind to device" implies clearing if they explicitly logout
  };

  // Cloud Write Handlers
  const cloudHandlers = {
    setCantieri: (data: Cantiere[]) => {
      if (!company) return;
      // We don't replace the whole array, we'll handle individual additions in components
      // But for compatibility with existing props:
      setCantieri(data);
    },
    saveCantiere: async (c: Cantiere) => company && await firestoreService.saveCantiere(company.id, c),
    savePersonale: async (p: Personale) => company && await firestoreService.savePersonale(company.id, p),
    saveMezzo: async (m: Mezzo) => company && await firestoreService.saveMezzo(company.id, m),
    saveMateriale: async (m: Materiale) => company && await firestoreService.saveMateriale(company.id, m),
    saveMovement: async (m: StockMovement) => company && await firestoreService.addMovement(company.id, m),
    saveDocument: async (d: MaterialDocument) => company && await firestoreService.saveMaterialDocument(company.id, d),
    saveRapportino: async (r: Rapportino) => {
      if (!company) return;
      if (currentUser && !currentUser.active) {
        alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
        throw new Error('Utenza disattivata: invio rapportino non consentito.');
      }
      await firestoreService.saveRapportino(company.id, r);
    },
    cancelRapportino: async (rapportinoId: string, motivo: string) => {
      if (!company) return;
      if (currentUser && !currentUser.active) {
        alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
        throw new Error('Utenza disattivata: operazione non consentita.');
      }
      await firestoreService.cancelRapportino(company.id, rapportinoId, currentUser?.name || 'Operatore', motivo);
    },
    saveContabilita: async (e: ContabilitaEntry) => company && await firestoreService.saveContabilitaEntry(company.id, e),
    saveUser: async (u: UserAccount) => company && await firestoreService.saveUser(company.id, u),
    deleteUser: async (uid: string) => company && await firestoreService.deleteUser(company.id, uid),
    acceptTransfer: async (mid: string) => {
      if (!company) return;
      if (currentUser && !currentUser.active) {
        alert('Operazione bloccata: la tua utenza è stata disattivata dall\'amministratore del server.');
        throw new Error('Utenza disattivata: operazione non consentita.');
      }
      await firestoreService.acceptTransfer(company.id, mid);
    },
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          <Logo className="scale-125" />
          <div className="w-48 h-1 bg-slate-900 rounded-full mt-4 overflow-hidden relative">
            <motion.div 
              initial={{ left: '-100%' }}
              animate={{ left: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute top-0 w-1/2 h-full bg-amber-500/50 blur-sm"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // If no user is logged in, show AuthScreen
  if (!currentUser || !company) {
    return (
      <AuthScreen
        company={company}
        users={users}
        onRegisterCompany={handleRegisterCompany}
        onLogin={handleLogin}
        onRegisterCollaborator={async (u) => company && await firestoreService.saveUser(company.id, u)}
        setCompany={setCompany}
        setUsers={setUsers}
      />
    );
  }

  // If user account is deactivated by company administrator, display immediate lock screen
  if (!currentUser.active) {
    return (
      <AccountDeactivatedScreen
        currentUser={currentUser}
        company={company}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 selection:bg-amber-500 selection:text-slate-950 relative flex overflow-hidden w-full max-w-full">
      {isCloudLoading && (
        <div className="fixed top-4 right-4 z-[110] bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 shadow-lg">
          <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sincronizzazione Cloud</span>
        </div>
      )}

      {/* Sidebar for Desktop Admin/Tecnico View */}
      {currentUser.role !== 'operativo' && !isMobileView && (
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          currentUser={currentUser}
          company={company}
          onLogout={handleLogout}
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full max-w-full">
        <Navbar
          currentUser={currentUser}
          company={company}
          onLogout={handleLogout}
          isMobileView={isMobileView}
          setIsMobileView={setIsMobileView}
          onGenerateTransferCode={handleGenerateTransferCode}
          activeTransferCode={activeTransferCode}
          transferTimeLeft={transferTimeLeft}
          isGeneratingTransferCode={isGeneratingTransferCode}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full bg-slate-50">
          <AnimatePresence mode="wait">
            {isMobileView || currentUser.role === 'operativo' ? (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-full overflow-x-hidden"
              >
                <MobileRapportinoView
                  currentUser={currentUser}
                  company={company}
                  cantieri={cantieri}
                  personale={personale}
                  mezzi={mezzi}
                  rapportini={rapportini}
                  movements={movements}
                  onAddRapportino={cloudHandlers.saveRapportino}
                  onCancelRapportino={cloudHandlers.cancelRapportino}
                  onAcceptTransfer={cloudHandlers.acceptTransfer}
                />
              </motion.div>
            ) : (
              <motion.div
                key="desktop"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                className="p-4 sm:p-8"
              >
                <AdminDashboard
                  company={company}
                  cantieri={cantieri}
                  onAddCantiere={cloudHandlers.saveCantiere}
                  personale={personale}
                  onAddPersonale={cloudHandlers.savePersonale}
                  mezzi={mezzi}
                  onAddMezzo={cloudHandlers.saveMezzo}
                  contabilita={contabilita}
                  onAddContabilita={cloudHandlers.saveContabilita}
                  rapportini={rapportini}
                  onAddRapportino={cloudHandlers.saveRapportino}
                  onCancelRapportino={cloudHandlers.cancelRapportino}
                  materiali={materiali}
                  onAddMateriale={cloudHandlers.saveMateriale}
                  movements={movements}
                  onAddMovement={cloudHandlers.saveMovement}
                  documents={documents}
                  onAddDocument={cloudHandlers.saveDocument}
                  users={users}
                  onSaveUser={cloudHandlers.saveUser}
                  onDeleteUser={cloudHandlers.deleteUser}
                  currentUser={currentUser}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <PWAInstallButton />
    </div>
  );
}
