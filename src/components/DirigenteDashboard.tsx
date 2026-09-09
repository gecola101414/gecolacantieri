import React from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry, UserAccount } from '../types';
import { Building2, FileText, DollarSign, Shield, Eye, Calendar, MapPin, CheckCircle, Wrench, HardHat } from 'lucide-react';

interface DirigenteDashboardProps {
  currentUser: UserAccount;
  cantieri: Cantiere[];
  personale: Personale[];
  mezzi: Mezzo[];
  contabilita: ContabilitaEntry[];
  rapportini: Rapportino[];
}

export const DirigenteDashboard: React.FC<DirigenteDashboardProps> = ({
  currentUser,
  cantieri,
  personale,
  mezzi,
  contabilita,
  rapportini,
}) => {
  const totalEntrate = contabilita
    .filter((c) => c.type === 'sal' || c.type === 'acconto')
    .reduce((acc, c) => acc + c.amount, 0);

  const totalUscite = contabilita
    .filter((c) => c.type !== 'sal' && c.type !== 'acconto')
    .reduce((acc, c) => acc + Math.abs(c.amount), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex items-center justify-between border border-blue-800">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Portale Dirigente (Sola Lettura da PC)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Dashboard Tecnico & Contabile: {currentUser.name}
          </h1>
          <p className="text-blue-200 text-sm mt-1 max-w-2xl">
            Monitora l'andamento dei cantieri, i rapporti giornalieri dei capicantieri e la situazione finanziaria aggiornata in tempo reale dal server Firebase.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entrate Totali (SAL/Acconti)</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">€{totalEntrate.toLocaleString()}</h3>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Costi Totali</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">€{totalUscite.toLocaleString()}</h3>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl">
            <Building2 className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rapportini Sincronizzati</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{rapportini.length}</h3>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
            <FileText className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Cantieri View */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900">Cantieri Monitorati</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cantieri.map((c) => {
            const cContab = contabilita.filter((cb) => cb.cantiereId === c.id);
            const entrate = cContab.filter((cb) => cb.type === 'sal' || cb.type === 'acconto').reduce((a, b) => a + b.amount, 0);
            const uscite = cContab.filter((cb) => cb.type !== 'sal' && cb.type !== 'acconto').reduce((a, b) => a + Math.abs(b.amount), 0);
            const percent = Math.min(100, Math.round((entrate / c.budget) * 100));

            return (
              <div key={c.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
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
                    <span className="text-slate-500">Incassato (SAL):</span>
                    <span className="font-bold text-emerald-600">€{entrate.toLocaleString()} ({percent}%)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
