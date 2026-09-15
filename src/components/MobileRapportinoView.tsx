import React, { useState, useEffect } from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, UserAccount, Company, TransferCode, StockMovement } from '../types';
import { 
  Building2, HardHat, Wrench, FileText, Plus, Camera, Send, Clock, 
  MapPin, CheckCircle2, AlertCircle, ChevronRight, Fuel, User, 
  Trash2, Image as ImageIcon, Sparkles, Smartphone, Cloud, ArrowLeft, KeyRound, Timer, ShieldCheck, Loader2, ArrowRightLeft, Check, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../lib/firestoreService';
import { compressPhoto } from '../utils/imageCompressor';
import { PhotoLightbox } from './PhotoLightbox';
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

  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [selectedHistoryRapportino, setSelectedHistoryRapportino] = useState<Rapportino | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same camera/file can be reselected if needed
    e.target.value = '';

    const currentFoto = newRapportino.foto || [];
    if (currentFoto.length >= 4) {
      alert('Puoi allegare al massimo 4 foto per rapportino.');
      return;
    }

    setIsCompressingPhoto(true);
    try {
      // Blazing-fast client-side canvas compression (< 200ms) to clean, optimized data URL
      const dataUrl = await compressPhoto(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.68
      });

      setNewRapportino(prev => ({
        ...prev,
        foto: [...(prev.foto || []), dataUrl]
      }));
    } catch (err) {
      console.error('Error compressing photo:', err);
      alert('Errore durante l\'elaborazione della foto. Riprova con un\'altra immagine.');
    } finally {
      setIsCompressingPhoto(false);
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
      const numFoto = (rapportino.foto || []).length;
      alert(`Rapportino inviato con successo al server cloud!${numFoto > 0 ? ` (${numFoto} foto allegat${numFoto === 1 ? 'a' : 'e'})` : ''}`);
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
                    <div 
                      key={r.id} 
                      onClick={() => setSelectedHistoryRapportino(r)}
                      className="bg-white px-5 py-4 rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer hover:border-amber-500/40 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 group-hover:bg-amber-500/10 rounded-xl flex items-center justify-center transition-colors">
                          <FileText className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">Rapportino {r.date}</h4>
                            {r.foto && r.foto.length > 0 && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                                <Camera className="w-3 h-3" /> {r.foto.length}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {cantieri.find(c => c.id === r.cantiereId)?.name || 'Cantiere'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
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
                          <div className="flex items-center justify-between px-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documentazione Fotografica</p>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              {newRapportino.foto?.length || 0} / 4 foto
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2.5">
                            {newRapportino.foto?.map((f, i) => (
                              <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 relative group shadow-sm bg-slate-100">
                                <img 
                                  src={f} 
                                  alt={`Foto ${i + 1}`} 
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => setPreviewPhoto(f)}
                                />
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = [...(newRapportino.foto || [])];
                                    updated.splice(i, 1);
                                    setNewRapportino({...newRapportino, foto: updated});
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1.5 bg-slate-950/75 hover:bg-rose-600 text-white rounded-full shadow-md transition-colors"
                                  title="Elimina foto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold text-white bg-slate-950/60 px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                                  #{i + 1}
                                </span>
                              </div>
                            ))}

                            {isCompressingPhoto && (
                              <div className="aspect-square rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 flex flex-col items-center justify-center text-amber-600 gap-2 animate-pulse">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="text-[9px] font-extrabold uppercase tracking-tight">Elaborazione...</span>
                              </div>
                            )}
                            
                            {(!newRapportino.foto || newRapportino.foto.length < 4) && !isCompressingPhoto && (
                              <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-500/5 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-amber-600 gap-1.5 transition-all cursor-pointer shadow-xs">
                                <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center">
                                  <Camera className="w-4 h-4 text-slate-700" />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider">Scatta Foto</span>
                                <span className="text-[8px] text-slate-400 font-medium">Istantanea</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment"
                                  onChange={handleFileChange}
                                  className="hidden" 
                                />
                              </label>
                            )}
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
      {/* Detail Modal for Past Rapportino */}
      <AnimatePresence>
        {selectedHistoryRapportino && (
          <div 
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedHistoryRapportino(null)}
          >
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-[32px] sm:rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Rapportino Inviato</span>
                  <h3 className="text-lg font-black text-slate-900">
                    {cantieri.find(c => c.id === selectedHistoryRapportino.cantiereId)?.name || 'Cantiere'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Data: {selectedHistoryRapportino.date}</p>
                </div>
                <button 
                  onClick={() => setSelectedHistoryRapportino(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Photos Section */}
              {selectedHistoryRapportino.foto && selectedHistoryRapportino.foto.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Foto Cantiere ({selectedHistoryRapportino.foto.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedHistoryRapportino.foto.map((f, i) => (
                      <div 
                        key={i} 
                        onClick={() => setPreviewPhoto(f)}
                        className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer group relative shadow-xs"
                      >
                        <img src={f} alt={`Foto ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white bg-slate-950/70 px-2 py-0.5 rounded-md">Ingrandisci</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Nessuna foto allegata a questo rapportino.
                </div>
              )}

              {/* Note */}
              {selectedHistoryRapportino.note && (
                <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note di Cantiere</p>
                  <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap">{selectedHistoryRapportino.note}</p>
                </div>
              )}

              {/* Personale */}
              {selectedHistoryRapportino.personale && selectedHistoryRapportino.personale.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personale Impiegato</p>
                  <div className="space-y-1.5">
                    {selectedHistoryRapportino.personale.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-800">{p.nome}</span>
                        <span className="font-bold text-amber-600">{p.ore} ore</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mezzi */}
              {selectedHistoryRapportino.mezzi && selectedHistoryRapportino.mezzi.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mezzi & Macchinari</p>
                  <div className="space-y-1.5">
                    {selectedHistoryRapportino.mezzi.map((m, i) => (
                      <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-800">{m.nome}</span>
                        <span className="font-bold text-blue-600">{m.ore} ore</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setSelectedHistoryRapportino(null)}
                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Chiudi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox for instant high-res photo viewing */}
      <PhotoLightbox 
        photoUrl={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        title="Foto Cantiere"
        subtitle={selectedCantiere?.name || 'Rapportino Giornaliero'}
      />
    </div>
  );
};
