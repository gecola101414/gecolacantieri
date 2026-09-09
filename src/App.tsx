import React, { useState, useEffect } from 'react';
import { 
  loadAppData, saveCompany, saveCantieri, savePersonale, saveMezzi, 
  saveContabilita, saveRapportini, saveUsers, saveCurrentUser 
} from './utils/storage';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { DirigenteDashboard } from './components/DirigenteDashboard';
import { MobileRapportinoView } from './components/MobileRapportinoView';
import { AuthScreen } from './components/AuthScreen';
import { UserAccount, Company, Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry } from './types';

export default function App() {
  const initialData = loadAppData();

  const [company, setCompany] = useState<Company | null>(initialData.company);
  const [users, setUsers] = useState<UserAccount[]>(initialData.users);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(initialData.currentUser);
  const [cantieri, setCantieri] = useState<Cantiere[]>(initialData.cantieri);
  const [personale, setPersonale] = useState<Personale[]>(initialData.personale);
  const [mezzi, setMezzi] = useState<Mezzo[]>(initialData.mezzi);
  const [contabilita, setContabilita] = useState<ContabilitaEntry[]>(initialData.contabilita);
  const [rapportini, setRapportini] = useState<Rapportino[]>(initialData.rapportini);

  const [isMobileView, setIsMobileView] = useState<boolean>(initialData.currentUser?.role === 'operativo');

  // Persistence
  useEffect(() => { saveCompany(company); }, [company]);
  useEffect(() => { saveUsers(users); }, [users]);
  useEffect(() => { saveCurrentUser(currentUser); }, [currentUser]);
  useEffect(() => { saveCantieri(cantieri); }, [cantieri]);
  useEffect(() => { savePersonale(personale); }, [personale]);
  useEffect(() => { saveMezzi(mezzi); }, [mezzi]);
  useEffect(() => { saveContabilita(contabilita); }, [contabilita]);
  useEffect(() => { saveRapportini(rapportini); }, [rapportini]);

  const handleRegisterCompany = (newCompany: Company, adminUser: UserAccount) => {
    setCompany(newCompany);
    setUsers([adminUser]);
    setCurrentUser(adminUser);
    setIsMobileView(false);
  };

  const handleRegisterCollaborator = (newUser: UserAccount) => {
    setUsers([...users, newUser]);
  };

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    if (user.role === 'operativo') {
      setIsMobileView(true);
    } else {
      setIsMobileView(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleAddRapportino = (newRap: Rapportino) => {
    setRapportini([newRap, ...rapportini]);
  };

  // If no user is logged in, show AuthScreen (Login / Registration)
  if (!currentUser) {
    return (
      <AuthScreen
        company={company}
        users={users}
        onRegisterCompany={handleRegisterCompany}
        onLogin={handleLogin}
        onRegisterCollaborator={handleRegisterCollaborator}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-amber-500 selection:text-slate-900">
      <Navbar
        currentUser={currentUser}
        company={company}
        onLogout={handleLogout}
        isMobileView={isMobileView}
        setIsMobileView={setIsMobileView}
      />

      <main className="pb-16">
        {isMobileView || currentUser.role === 'operativo' ? (
          <MobileRapportinoView
            currentUser={currentUser}
            cantieri={cantieri}
            personaleList={personale}
            mezziList={mezzi}
            onAddRapportino={handleAddRapportino}
            onBackToAdmin={currentUser.role === 'admin' ? () => setIsMobileView(false) : undefined}
          />
        ) : currentUser.role === 'dirigente' ? (
          <DirigenteDashboard
            currentUser={currentUser}
            cantieri={cantieri}
            personale={personale}
            mezzi={mezzi}
            contabilita={contabilita}
            rapportini={rapportini}
          />
        ) : (
          <AdminDashboard
            company={company}
            cantieri={cantieri}
            setCantieri={setCantieri}
            personale={personale}
            setPersonale={setPersonale}
            mezzi={mezzi}
            setMezzi={setMezzi}
            contabilita={contabilita}
            setContabilita={setContabilita}
            rapportini={rapportini}
            setRapportini={setRapportini}
            users={users}
            setUsers={setUsers}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}
