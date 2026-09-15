import React, { useState, useEffect } from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, UserAccount, Company, TransferCode, StockMovement } from '../types';
import { 
  Building2, HardHat, Wrench, FileText, Plus, Camera, Send, Clock, 
  MapPin, CheckCircle2, AlertCircle, ChevronRight, Fuel, User, 
  Trash2, Image as ImageIcon, Sparkles, Smartphone, Cloud, ArrowLeft, KeyRound, Timer, ShieldCheck, Loader2, ArrowRightLeft, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';
import imageCompression from 'browser-image-compression';
import { Logo, FooterBranding } from './Branding';

interface MobileRapportinoViewProps {
  currentUser: UserAccount;
  company: Company | null;
  cantieri: Cantiere[];
  personale: Personale[];
  mezzi: Mezzo[];
  rapportini: Rapportino[];
  movements: StockMovement[];
  onAddRapportino: (r: Rapportino) => void;
  onAcceptTransfer: (moveId: string) => Promise<void>;
}

export const MobileRapportinoView: React.FC<MobileRapportinoViewProps> = ({
  currentUser,
  company,
  cantieri,
  personale,
  mezzi,
  rapportini,
  movements,
  onAddRapportino,
  onAcceptTransfer,
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
      console.error('Transfer code generation error:', err);
      alert(`Errore nella generazione del codice: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Create form state
  const [formStep, setFormStep] = useState(1);
  const [newRapportino, setNewRapportino] = useState<Partial<Rapportino>>({
    personale: [],
    materiali: [], // Visual only
    materialiUsed: [], // Database stock sync
    mezzi: [],
    personnelHours: [],
    mezziHours: [],
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
      materialiUsed: [],
      mezzi: [],
      personnelHours: [],
      mezziHours: [],
      foto: [],
      note: '',
    });
    setStep('create');
    setFormStep(1);
  };

  const handleTogglePersonale = (p: Personale) => {
    const current = newRapportino.personale || [];
    const currentHours = newRapportino.personnelHours || [];
    const exists = current.find(item => item.personaleId === p.id);
    if (exists) {
      setNewRapportino({ 
        ...newRapportino, 
        personale: current.filter(item => item.personaleId !== p.id),
        personnelHours: currentHours.filter(item => item.personnelId !== p.id)
      });
    } else {
      setNewRapportino({ 
        ...newRapportino, 
        personale: [...current, { personaleId: p.id, nome: p.name, ore: 8 }],
        personnelHours: [...currentHours, { personnelId: p.id, hours: 8 }]
      });
    }
  };

  const handleUpdateOre = (pId: string, ore: number) => {
    const current = newRapportino.personale || [];
    const currentHours = newRapportino.personnelHours || [];
    setNewRapportino({
      ...newRapportino,
      personale: current.map(item => item.personaleId === pId ? { ...item, ore } : item),
      personnelHours: currentHours.map(item => item.personnelId === pId ? { ...item, hours: ore } : item)
    });
  };

  const handleAddMaterialeFromStock = (materialeId: string, quantity: number) => {
    if (!selectedCantiere?.stock) return;
    const stockItem = selectedCantiere.stock.find(s => s.materialeId === materialeId);
    if (!stockItem) return;

    const currentUsed = newRapportino.materialiUsed || [];
    const currentVisual = newRapportino.materiali || [];

    setNewRapportino({
      ...newRapportino,
      materialiUsed: [...currentUsed, { materialeId, quantity, unit: stockItem.unit }],
      materiali: [...currentVisual, { materialeId, materialeName: stockItem.materialeName, quantity, unit: stockItem.unit }]
    });
  };

  const handleAddManualMateriale = () => {
    const name = prompt('Nome materiale:');
    if (!name) return;
    const qty = prompt('Quantità:');
    if (!qty) return;
    const unit = prompt('Unità di misura:', 'u');
    if (!unit) return;

    const currentVisual = newRapportino.materiali || [];
    setNewRapportino({
      ...newRapportino,
      materiali: [...currentVisual, { materialeId: 'manual-' + Date.now(), materialeName: name, quantity: Number(qty), unit }]
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && company) {
      setIsSubmitting(true);
      try {
        // Compress image before upload
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1280,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);

        const path = `rapportini/foto-${Date.now()}-${file.name}`;
        const url = await firestoreService.uploadFile(company.id, path, compressedFile);
        const currentFoto = newRapportino.foto || [];
        setNewRapportino({
          ...newRapportino,
          foto: [...currentFoto, url]
        });
      } catch (err) {
        console.error('Error uploading photo:', err);
        alert('Errore nel caricamento della foto. Riprova.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAddMezzo = (mezzoId: string, hours: number) => {
    const mezzo = mezzi.find(m => m.id === mezzoId);
    if (!mezzo) return;

    const currentMezzi = newRapportino.mezzi || [];
    const currentMezziHours = newRapportino.mezziHours || [];

    setNewRapportino({
      ...newRapportino,
      mezzi: [...currentMezzi, { mezzoId, nome: mezzo.name, ore: hours }],
      mezziHours: [...currentMezziHours, { mezzoId, hours }]
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCantiere) return;
    setIsSubmitting(true);
    try {
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
        personnelHours: newRapportino.personnelHours || [],
        mezziHours: newRapportino.mezziHours || [],
        materialiUsed: newRapportino.materialiUsed || [],
      };
      await onAddRapportino(rapportino);
      setStep('list');
      alert('Rapportino inviato con successo al server cloud!');
    } catch (err) {
      console.error('Error submitting rapportino:', err);
      alert('Errore nell\'invio del rapportino. Controlla la connessione e riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async (moveId: string) => {
    setIsSubmitting(true);
    try {
      await onAcceptTransfer(moveId);
      alert('Carico accettato con successo. Le giacenze di cantiere sono state aggiornate.');
    } catch (err) {
      console.error('Error accepting transfer:', err);
      alert('Errore durante l\'accettazione del carico.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userRapportini = rapportini.filter(r => r.userId === currentUser.id);
  const filteredCantieri = currentUser.role === 'admin' 
    ? cantieri 
    : cantieri.filter(c => (currentUser.cantieriAccreditati || []).includes(c.id));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-[640px] mx-auto shadow-2xl relative">
      
      {/* Mobile Top Bar */}
      <div className="bg-slate-950 text-white p-6 sticky top-0 z-50 rounded-b-[32px] shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <Logo className="scale-75 origin-left" />
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
                  {filteredCantieri.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-12 text-center">
                      <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400">Nessun cantiere attivo assegnato.</p>
                    </div>
                  ) : (
                    filteredCantieri.map(c => (
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

              {/* Pending Transfers */}
              {movements.some(m => m.status === 'pending' && m.toId && (currentUser.cantieriAccreditati || []).includes(m.toId)) && (
                <div>
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-amber-500" /> Materiali in Arrivo
                  </h2>
                  <div className="space-y-3">
                    {movements
                      .filter(m => m.status === 'pending' && m.toId && (currentUser.cantieriAccreditati || []).includes(m.toId))
                      .map(m => (
                        <div key={m.id} className="bg-amber-50 border border-amber-200 p-5 rounded-[28px] shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest leading-none mb-1">Trasferimento</p>
                              <p className="text-sm font-black text-slate-900">{m.materialeName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-slate-900 leading-none">{m.quantity}</p>
                              <p className="text-[9px] font-bold text-slate-500 uppercase">Quantità</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <p className="text-[10px] font-bold text-slate-500">
                              DESTINAZIONE: {cantieri.find(c => c.id === m.toId)?.name}
                            </p>
                          </div>

                          <button 
                            onClick={() => handleAccept(m.id)}
                            disabled={isSubmitting}
                            className="w-full bg-slate-950 text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )} Accetta Carico
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <FooterBranding />

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
                      
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiali in Cantiere</p>
                            <button 
                              onClick={handleAddManualMateriale}
                              className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Aggiungi Manuale
                            </button>
                          </div>
                          {!selectedCantiere?.stock || selectedCantiere.stock.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic">Nessun materiale caricato in questo cantiere.</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedCantiere.stock.map(item => (
                                <button 
                                  key={item.materialeId}
                                  onClick={() => {
                                    const q = prompt(`Quantità di ${item.materialeName} (${item.unit}) utilizzata (Disponibile: ${item.quantity}):`);
                                    if (q) handleAddMaterialeFromStock(item.materialeId, Number(q));
                                  }}
                                  className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 text-left"
                                >
                                  <div>
                                    <p className="text-xs font-bold text-slate-900">{item.materialeName}</p>
                                    <p className="text-[10px] text-slate-500">Disp: {item.quantity} {item.unit}</p>
                                  </div>
                                  <Plus className="w-4 h-4 text-amber-500" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Mezzi Disponibili</p>
                          <div className="space-y-2">
                            {mezzi.map(m => (
                              <button 
                                key={m.id}
                                onClick={() => {
                                  const h = prompt(`Ore utilizzo per ${m.name}:`);
                                  if (h) handleAddMezzo(m.id, Number(h));
                                }}
                                className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 text-left"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{m.name}</p>
                                  <p className="text-[10px] text-slate-500">{m.plate}</p>
                                </div>
                                <Plus className="w-4 h-4 text-blue-500" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Summary List */}
                      {(newRapportino.materiali?.length || 0) + (newRapportino.mezzi?.length || 0) > 0 && (
                        <div className="space-y-2 mt-6">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Riepilogo Selezione</p>
                          {newRapportino.materiali?.map((m, i) => (
                            <div key={`mat-${i}`} className="flex items-center justify-between px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[10px] font-bold">
                              <span className="text-slate-900">{m.materialeName}</span>
                              <span className="text-amber-600">{m.quantity} {m.unit}</span>
                            </div>
                          ))}
                          {newRapportino.mezzi?.map((m, i) => (
                            <div key={`mez-${i}`} className="flex items-center justify-between px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-[10px] font-bold">
                              <span className="text-slate-900">{m.nome}</span>
                              <span className="text-blue-600">{m.ore} ore</span>
                            </div>
                          ))}
                        </div>
                      )}
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
                        
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Documentazione Fotografica</p>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {newRapportino.foto?.map((f, i) => (
                              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200 relative">
                                <img src={f} alt={`Foto ${i}`} className="w-full h-full object-cover" />
                                <button 
                                  onClick={() => {
                                    const updated = [...(newRapportino.foto || [])];
                                    updated.splice(i, 1);
                                    setNewRapportino({...newRapportino, foto: updated});
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-white/80 rounded-full shadow-sm"
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                              </div>
                            ))}
                            
                            <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-2 hover:bg-white hover:border-amber-500 transition-all cursor-pointer">
                              <Camera className="w-6 h-6" />
                              <span className="text-[8px] font-black uppercase">Aggiungi</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden" 
                              />
                            </label>
                          </div>
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
                        disabled={isSubmitting}
                        className="flex-1 bg-amber-500 text-slate-950 font-bold py-4 rounded-2xl text-xs shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>Inviando... <Loader2 className="w-4 h-4 animate-spin" /></>
                        ) : (
                          <>Invia Rapportino <Send className="w-4 h-4" /></>
                        )}
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
