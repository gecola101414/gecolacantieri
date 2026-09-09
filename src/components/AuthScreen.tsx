import React, { useState } from 'react';
import { UserAccount, Company, UserRole } from '../types';
import { Building2, Shield, Lock, User, KeyRound, ArrowRight, CheckCircle2, Sparkles, Smartphone } from 'lucide-react';

interface AuthScreenProps {
  company: Company | null;
  users: UserAccount[];
  onRegisterCompany: (company: Company, adminUser: UserAccount) => void;
  onLogin: (user: UserAccount) => void;
  onRegisterCollaborator: (user: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  company,
  users,
  onRegisterCompany,
  onLogin,
  onRegisterCollaborator,
}) => {
  const [mode, setMode] = useState<'login' | 'register_admin' | 'register_collaborator'>(
    !company ? 'register_admin' : 'login'
  );

  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Password change modal on first login
  const [userToChangePassword, setUserToChangePassword] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Register Admin form
  const [adminCompanyName, setAdminCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Register Collaborator form
  const [collabCompanyCode, setCollabCompanyCode] = useState('');
  const [collabName, setCollabName] = useState('');
  const [collabUsername, setCollabUsername] = useState('');
  const [collabRole, setCollabRole] = useState<UserRole>('operativo');
  const [collabPhone, setCollabPhone] = useState('');
  const [collabError, setCollabError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const found = users.find(
      (u) => u.username.toLowerCase() === loginUsername.trim().toLowerCase() && u.password === loginPassword
    );

    if (!found) {
      setLoginError('Username o password non validi. Verifica le credenziali.');
      return;
    }

    if (!found.active) {
      setLoginError('Account disattivato dall\'amministratore.');
      return;
    }

    if (found.mustChangePassword || found.password === '1234') {
      setUserToChangePassword(found);
    } else {
      onLogin(found);
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
      password: adminPassword, // Admin password is permanent and chosen by them
      role: 'admin',
      mustChangePassword: false,
      phone: '',
      active: true,
    };

    onRegisterCompany(newCompany, adminUser);
  };

  const handleRegisterCollabSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCollabError('');
    if (!company || collabCompanyCode.trim().toUpperCase() !== company.code) {
      setCollabError('Codice aziendale errato. Chiedi il codice all\'amministratore.');
      return;
    }
    if (!collabName || !collabUsername) {
      setCollabError('Inserisci nome e username.');
      return;
    }

    const collabUser: UserAccount = {
      id: 'usr-' + Date.now(),
      companyCode: company.code,
      name: collabName,
      username: collabUsername,
      password: '1234', // Initial password requested by user
      role: collabRole,
      mustChangePassword: true, // Forces password change on first login
      phone: collabPhone,
      active: true,
    };

    onRegisterCollaborator(collabUser);
    alert(`Registrazione completata! Il tuo account è stato creato.\n\nUsername: ${collabUsername}\nPassword iniziale: 1234 (verrai invitato a cambiarla al primo accesso).`);
    setMode('login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-700 text-slate-100">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Building2 className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">CantieriCloud Pro</h1>
          <p className="text-xs text-slate-400 mt-1">Piattaforma Contabilità & Rapportini Cloud</p>
          {company && (
            <div className="mt-3 inline-block bg-amber-500/20 text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-500/30 font-mono">
              Azienda: {company.name} (Codice: {company.code})
            </div>
          )}
        </div>

        {/* First Login Password Change Modal */}
        {userToChangePassword ? (
          <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 animate-in fade-in">
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-xs text-amber-200">
              <p className="font-bold mb-1">Primo Accesso Rilevato</p>
              Per motivi di sicurezza, inserisci una nuova password personale per il tuo account.
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Nuova Password *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimo 4 caratteri..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3.5 rounded-xl shadow-lg transition-all"
            >
              Conferma e Accedi
            </button>
          </form>
        ) : (
          <>
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-2xl mb-6 border border-slate-700/50">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'login' ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Accedi
              </button>
              <button
                type="button"
                onClick={() => setMode(!company ? 'register_admin' : 'register_collaborator')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  mode !== 'login' ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {!company ? 'Crea Azienda' : 'Registrati'}
              </button>
            </div>

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Username</label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Il tuo username..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Nota: Ai collaboratori al primo accesso è assegnata la password provvisoria <code className="text-amber-400 font-bold">1234</code></p>
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  Accedi alla Piattaforma <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* REGISTER ADMIN FORM (First entry creates company & admin) */}
            {mode === 'register_admin' && (
              <form onSubmit={handleRegisterAdminSubmit} className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300 mb-2">
                  <span className="font-bold">Primo Accesso / Nuova Azienda:</span> Inserisci i dati dell'amministratore. Il sistema genererà un Codice Aziendale univoco per i collaboratori.
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Nome Azienda / Impresa *</label>
                  <input
                    type="text"
                    value={adminCompanyName}
                    onChange={(e) => setAdminCompanyName(e.target.value)}
                    placeholder="Es. Edilizia Rossi Srl"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Nome e Cognome Amministratore *</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Maria Rossi"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Username *</label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin_maria"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Password *</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Password sicura"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3.5 rounded-xl shadow-lg transition-all"
                >
                  Crea Spazio Aziendale in Cloud
                </button>
              </form>
            )}

            {/* REGISTER COLLABORATOR FORM (Requires Company Code) */}
            {mode === 'register_collaborator' && (
              <form onSubmit={handleRegisterCollabSubmit} className="space-y-4">
                {collabError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs">
                    {collabError}
                  </div>
                )}
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl text-xs text-blue-200">
                  Inserisci il **Codice Aziendale** fornito dall'amministratore. La password iniziale sarà <code className="font-bold text-amber-400">1234</code>.
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Codice Aziendale (es. CANT-XXXX) *</label>
                  <input
                    type="text"
                    value={collabCompanyCode}
                    onChange={(e) => setCollabCompanyCode(e.target.value)}
                    placeholder="CANT-..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white uppercase outline-none font-mono"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Nome e Cognome *</label>
                    <input
                      type="text"
                      value={collabName}
                      onChange={(e) => setCollabName(e.target.value)}
                      placeholder="Mario Bianchi"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Username *</label>
                    <input
                      type="text"
                      value={collabUsername}
                      onChange={(e) => setCollabUsername(e.target.value)}
                      placeholder="mario_cantiere"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Ruolo</label>
                    <select
                      value={collabRole}
                      onChange={(e) => setCollabRole(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                    >
                      <option value="operativo">Capocantiere / Operaio (Cellulare)</option>
                      <option value="dirigente">Dirigente (Vista PC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Telefono</label>
                    <input
                      type="text"
                      value={collabPhone}
                      onChange={(e) => setCollabPhone(e.target.value)}
                      placeholder="+39 ..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3.5 rounded-xl shadow-lg transition-all"
                >
                  Registrati come Collaboratore
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
