import React, { useState, useEffect } from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, UserAccount, Company, TransferCode } from '../types';
import { 
  Building2, HardHat, Wrench, FileText, Plus, Camera, Send, Clock, 
  MapPin, CheckCircle2, AlertCircle, ChevronRight, Fuel, User, 
  Trash2, Image as ImageIcon, Sparkles, Smartphone, Cloud, ArrowLeft, KeyRound, Timer, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';

interface MobileRapportinoViewProps {
  currentUser: UserAccount;
  company: Company | null;
  cantieri: Cantiere[];
  personale: Personale[];
  mezzi: Mezzo[];
  rapportini: Rapportino[];
  onAddRapportino: (r: Rapportino) => void;
}

export const MobileRapportinoView: React.FC<MobileRapportinoViewProps> = ({
  currentUser,
  company,
  cantieri,
  personale,
  mezzi,
  rapportini,
  onAddRapportino,
}) => {
  const [step, setStep] = useState<'list' | 'create'>('list');
  const [selectedCantiere, setSelectedCantiere] = useState<Cantiere | null>(null);
  
  // Transfer Code Logic
  const [activeTransferCode, setActiveTransferCode] = useState<TransferCode | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else {
      setActiveTransferCode(null);
    }
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleGenerateTransferCode = async () => {
    if (!company) return;
    setIsGenerating(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCode: TransferCode = {
      id: 'tc-' + Date.now(),
      code,
      userId: currentUser.id,
      expiresAt: new Date(Date.now() + 120 * 1000).toISOString(),
      used: false
    };
    
    try {
      await firestoreService.saveTransferCode(company.id, newCode);
      setActiveTransferCode(newCode);
      setTimeLeft(120);
    } catch (err) {
      alert('Errore nella generazione del codice.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Create form state
  const [formStep, setFormStep] = useState(1);
  const [newRapportino, setNewRapportino] = useState<Partial<Rapportino>>({
    personale: [],
    materiali: [],
    mezzi: [],
    foto: [],
    note: '',
  });

  const handleCreateNew = (cantiere: Cantiere) => {
    setSelectedCantiere(cantiere);
    setNewRapportino({
      userId: currentUser.id,
      userName: currentUser.name,
      cantiereId: cantiere.id,
      date: new Date().toISOString().split('T')[0],
      personale: [],
      materiali: [],
      mezzi: [],
      foto: [],
      note: '',
    });
    setStep('create');
    setFormStep(1);
  };

  const handleTogglePersonale = (p: Personale) => {
    const current = newRapportino.personale || [];
    const exists = current.find(item => item.personaleId === p.id);
    if (exists) {
      setNewRapportino({ ...newRapportino, personale: current.filter(item => item.personaleId !== p.id) });
    } else {
      setNewRapportino({ ...newRapportino, personale: [...current, { personaleId: p.id, nome: p.name, ore: 8 }] });
    }
  };

  const handleUpdateOre = (pId: string, ore: number) => {
    const current = newRapportino.personale || [];
    setNewRapportino({
      ...newRapportino,
      personale: current.map(item => item.personaleId === pId ? { ...item, ore } : item)
    });
  };

  const handleAddMateriale = () => {
    const nome = prompt('Nome materiale (es. Cemento RCK 30):');
    if (!nome) return;
    const quantita = prompt('Quantità (es. 5 mc):');
    if (!quantita) return;
    const current = newRapportino.materiali || [];
    setNewRapportino({ ...newRapportino, materiali: [...current, { nome, quantita }] });
  };

  const handleAddMezzo = () => {
    const mId = prompt('ID Mezzo o Targa:');
    if (!mId) return;
    const ore = prompt('Ore utilizzo:');
    if (!ore) return;
    const current = newRapportino.mezzi || [];
    setNewRapportino({ ...newRapportino, mezzi: [...current, { mezzoId: mId, nome: mId, ore: Number(ore) }] });
  };

  const handleSubmit = () => {
    if (!selectedCantiere) return;
    const rapportino: Rapportino = {
      id: 'rap-' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      cantiereId: selectedCantiere.id,
      date: newRapportino.date || new Date().toISOString().split('T')[0],
      personale: newRapportino.personale || [],
      materiali: newRapportino.materiali || [],
      mezzi: newRapportino.mezzi || [],
      foto: newRapportino.foto || [],
      note: newRapportino.note || '',
    };
    onAddRapportino(rapportino);
    setStep('list');
    alert('Rapportino inviato con successo al server cloud!');
  };

  const userRapportini = rapportini.filter(r => r.userId === currentUser.id);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-[640px] mx-auto shadow-2xl relative">
      
      {/* Mobile Top Bar */}
      <div className="bg-slate-950 text-white p-6 sticky top-0 z-50 rounded-b-[32px] shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Building2 className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">CantieriCloud</h1>
              <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">Mobile Ops • Cloud Sync</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleGenerateTransferCode}
              disabled={isGenerating || timeLeft > 0}
              className={`p-2.5 rounded-xl border transition-all ${
                timeLeft > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_-5px_rgba(16,185,129,0.5)]' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
              }`}
              title="Genera Codice Trasferimento PC"
            >
              <KeyRound className={`w-5 h-5 ${isGenerating ? 'animate-pulse' : ''}`} />
            </button>
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-amber-500 text-xs font-bold">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {activeTransferCode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-[1px] rounded-2xl shadow-lg shadow-emerald-500/20"
            >
              <div className="bg-slate-950 rounded-[15px] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mb-1">Codice Accesso PC</p>
                    <p className="text-xl font-mono font-black text-white tracking-[0.2em]">{activeTransferCode.code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Scade tra</p>
                  <p className="text-lg font-bold text-white tabular-nums flex items-center gap-1.5 justify-end">
                    <Timer className="w-4 h-4 text-emerald-500" /> {timeLeft}s
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {step === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Active Assignments */}
              <div>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">I Tuoi Cantieri</h2>
                  <Smartphone className="w-4 h-4 text-slate-300" />
                </div>
                
                <div className="space-y-4">
                  {cantieri.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-12 text-center">
                      <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400">Nessun cantiere attivo assegnato.</p>
                    </div>
                  ) : (
                    cantieri.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleCreateNew(c)}
                        className="w-full bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-amber-500/30 text-left group transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3" /> Attivo
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{c.name}</h3>
                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {c.address}
                        </p>
                        <div className="mt-6 flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Nuovo Rapportino</span>
                          <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                            <Plus className="w-4 h-4 stroke-[3]" />
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* History */}
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Ultimi Invii</h2>
                <div className="space-y-3">
                  {userRapportini.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-white px-5 py-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Rapportino {r.date}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">Inviato al server</p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Breadcrumb / Back */}
              <button 
                onClick={() => setStep('list')}
                className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Annulla Rapportino
              </button>

              <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-slate-950 p-6 text-white">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Nuovo Rapportino Giornaliero</p>
                  <h3 className="text-xl font-bold">{selectedCantiere?.name}</h3>
                </div>

                <div className="p-8 space-y-8">
                  {/* Step Progress */}
                  <div className="flex items-center justify-between mb-8">
                    {[1, 2, 3].map(s => (
                      <div key={s} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          formStep >= s ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {s}
                        </div>
                        {s < 3 && <div className={`w-12 h-1 bg-slate-100 mx-2 rounded-full ${formStep > s ? 'bg-amber-500' : ''}`}></div>}
                      </div>
                    ))}
                  </div>

                  {formStep === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <h4 className="text-lg font-bold text-slate-900">Personale Impiegato</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Seleziona i colleghi presenti in cantiere oggi e specifica le ore lavorate.</p>
                      <div className="space-y-3">
                        {personale.map(p => {
                          const selected = newRapportino.personale?.find(item => item.personaleId === p.id);
                          return (
                            <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                              selected ? 'bg-amber-500/5 border-amber-500' : 'bg-slate-50 border-slate-100'
                            }`}>
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={!!selected} 
                                  onChange={() => handleTogglePersonale(p)}
                                  className="w-5 h-5 rounded-lg border-slate-300 text-amber-500 focus:ring-amber-500"
                                />
                                <span className={`text-sm font-bold ${selected ? 'text-slate-900' : 'text-slate-500'}`}>{p.name}</span>
                              </div>
                              {selected && (
                                <input 
                                  type="number" 
                                  value={selected.ore}
                                  onChange={(e) => handleUpdateOre(p.id, Number(e.target.value))}
                                  className="w-16 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {formStep === 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <h4 className="text-lg font-bold text-slate-900">Materiali & Mezzi</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <button onClick={handleAddMateriale} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-amber-500 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700">Aggiungi Materiale</span>
                          </div>
                          <Plus className="w-4 h-4 text-slate-400" />
                        </button>
                        <button onClick={handleAddMezzo} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-amber-500 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                              <Wrench className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700">Aggiungi Mezzo</span>
                          </div>
                          <Plus className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>

                      {/* Summary List */}
                      <div className="space-y-2 mt-4">
                        {newRapportino.materiali?.map((m, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold">
                            <span className="text-slate-900">{m.nome}</span>
                            <span className="text-amber-600">{m.quantita}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {formStep === 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <h4 className="text-lg font-bold text-slate-900">Note & Foto</h4>
                      <div className="space-y-4">
                        <textarea 
                          placeholder="Note di cantiere, imprevisti, avanzamento..."
                          value={newRapportino.note}
                          onChange={e => setNewRapportino({...newRapportino, note: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm min-h-[120px] outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <div className="p-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3 hover:bg-white hover:border-amber-500 transition-all cursor-pointer">
                          <Camera className="w-8 h-8" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Scatta Foto Cantiere</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-4 pt-8">
                    {formStep > 1 && (
                      <button 
                        onClick={() => setFormStep(prev => prev - 1)}
                        className="flex-1 bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl text-xs hover:bg-slate-200 transition-colors"
                      >
                        Indietro
                      </button>
                    )}
                    {formStep < 3 ? (
                      <button 
                        onClick={() => setFormStep(prev => prev + 1)}
                        className="flex-1 bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl hover:bg-slate-900 transition-all"
                      >
                        Avanti
                      </button>
                    ) : (
                      <button 
                        onClick={handleSubmit}
                        className="flex-1 bg-amber-500 text-slate-950 font-bold py-4 rounded-2xl text-xs shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
                      >
                        Invia Rapportino <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating User Context */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[592px] z-[60]">
        <div className="bg-slate-950/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xs uppercase">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-none">{currentUser.name}</p>
              <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">{currentUser.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 bg-white/5 px-2 py-1 rounded-lg">
            <Cloud className="w-3 h-3" />
            <span>V2.0 PRO</span>
          </div>
        </div>
      </div>
    </div>
  );
};
