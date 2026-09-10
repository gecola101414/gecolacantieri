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
import { UserAccount, Company, Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry, Materiale } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Loader2 } from 'lucide-react';
import { firestoreService } from './lib/firestoreService';
import { db } from './lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

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

  const [isMobileView, setIsMobileView] = useState<boolean>(initialLocalData.currentUser?.role === 'operativo');
  const [activeTab, setActiveTab] = useState<'panoramica' | 'cantieri' | 'personale' | 'mezzi' | 'rapportini' | 'utenti' | 'materiali'>('panoramica');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

    const unsubUsers = onSnapshot(collection(db, 'companies', company.id, 'users'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as UserAccount);
      setUsers(data);
      // Update currentUser if it changed in the cloud
      if (currentUser) {
        const updated = data.find(u => u.id === currentUser.id);
        if (updated) setCurrentUser(updated);
      }
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

    setIsCloudLoading(false);

    return () => {
      unsubUsers();
      unsubCantieri();
      unsubPersonale();
      unsubMezzi();
      unsubRapportini();
      unsubContabilita();
      unsubMateriali();
    };
  }, [company?.id]);

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
        // Update in cloud if mustChangePassword was cleared
        if (user.password !== cloudUser.password) {
          await firestoreService.saveUser(company.id, user);
        }
        setCurrentUser(user);
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
    saveRapportino: async (r: Rapportino) => company && await firestoreService.saveRapportino(company.id, r),
    saveContabilita: async (e: ContabilitaEntry) => company && await firestoreService.saveContabilitaEntry(company.id, e),
    saveUser: async (u: UserAccount) => company && await firestoreService.saveUser(company.id, u),
    deleteUser: async (uid: string) => company && await firestoreService.deleteUser(company.id, uid),
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
          <div className="w-24 h-24 bg-amber-500 rounded-[32px] flex items-center justify-center shadow-[0_0_50px_-10px_rgba(245,158,11,0.5)]">
            <Building2 className="w-12 h-12 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight font-display">CantieriCloud <span className="text-amber-500">Pro</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">Enterprise Cloud Infrastructure</p>
          </div>
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-amber-500 selection:text-slate-950 relative flex overflow-hidden">
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

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Navbar
          currentUser={currentUser}
          company={company}
          onLogout={handleLogout}
          isMobileView={isMobileView}
          setIsMobileView={setIsMobileView}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50">
          <AnimatePresence mode="wait">
            {isMobileView || currentUser.role === 'operativo' ? (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4"
              >
                <MobileRapportinoView
                  currentUser={currentUser}
                  cantieri={cantieri}
                  personale={personale}
                  mezzi={mezzi}
                  rapportini={rapportini}
                  onAddRapportino={cloudHandlers.saveRapportino}
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
                  materiali={materiali}
                  onAddMateriale={cloudHandlers.saveMateriale}
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
    </div>
  );
}
