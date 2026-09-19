import React, { useState } from 'react';
import { MaterialRequest, MaterialRequestItem, Materiale, Cantiere, UserAccount, MaterialRequestStatus } from '../types';
import { 
  Plus, Search, Trash2, Send, Clock, CheckCircle2, 
  XCircle, AlertCircle, ShoppingCart, Package, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MaterialRequestManagerProps {
  cantiere: Cantiere;
  currentUser: UserAccount;
  materialiArchive: Materiale[];
  requests: MaterialRequest[];
  onSaveRequest: (r: MaterialRequest) => Promise<void>;
  onUpdateStatus: (rid: string, status: MaterialRequestStatus) => Promise<void>;
}

export const MaterialRequestManager: React.FC<MaterialRequestManagerProps> = ({
  cantiere,
  currentUser,
  materialiArchive,
  requests,
  onSaveRequest,
  onUpdateStatus
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<MaterialRequestItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredArchive = materialiArchive.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = (m: Materiale) => {
    if (selectedItems.some(i => i.materialeId === m.id)) return;
    setSelectedItems([...selectedItems, {
      materialeId: m.id,
      materialeName: m.name,
      quantity: 1,
      unit: m.unit || 'u'
    }]);
  };

  const handleUpdateQty = (id: string, qty: number) => {
    setSelectedItems(selectedItems.map(i => 
      i.materialeId === id ? { ...i, quantity: Math.max(0.0001, qty) } : i
    ));
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter(i => i.materialeId !== id));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      alert('Seleziona almeno un materiale.');
      return;
    }
    setIsSubmitting(true);
    try {
      const now = new Date();
      const newRequest: MaterialRequest = {
        id: 'req-' + Date.now(),
        cantiereId: cantiere.id,
        cantiereName: cantiere.name,
        userId: currentUser.id,
        userName: currentUser.name,
        date: now.toISOString().split('T')[0],
        items: selectedItems,
        status: 'inviata',
        notes: notes.trim(),
        urgent: isUrgent,
        createdAt: now.toISOString()
      };
      await onSaveRequest(newRequest);
      setIsCreating(false);
      setSelectedItems([]);
      setNotes('');
      setIsUrgent(false);
      alert('Richiesta materiali inviata con successo.');
    } catch (err) {
      console.error('Error saving material request:', err);
      alert('Errore nell\'invio della richiesta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: MaterialRequestStatus) => {
    switch (status) {
      case 'inviata': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Inviata</span>;
      case 'approvata': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Approvata</span>;
      case 'ordinata': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Ordinata</span>;
      case 'rifiutata': return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Rifiutata</span>;
      case 'evasa': return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Evasa</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-amber-500" />
          Richieste Materiali
        </h3>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-slate-950 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />
            Nuova Richiesta
          </button>
        )}
      </div>

      <AnimatePresence>
        {isCreating ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl border-2 border-amber-500/20 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase">Prepara Richiesta</h4>
                <button onClick={() => setIsCreating(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Archive */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cerca materiale in archivio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
                
                {searchTerm.trim() !== '' && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                    {filteredArchive.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">Nessun materiale trovato.</div>
                    ) : (
                      filteredArchive.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            handleAddItem(m);
                            setSearchTerm('');
                          }}
                          className="w-full p-2.5 text-left hover:bg-amber-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{m.name}</p>
                            <p className="text-[10px] text-slate-500">{m.code || 'Senza codice'}</p>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-amber-600" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Items */}
              <div className="space-y-2">
                {selectedItems.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
                    <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-slate-400">Nessun materiale selezionato.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map(item => (
                      <div key={item.materialeId} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate">{item.materialeName}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">{item.unit}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQty(item.materialeId, parseFloat(e.target.value))}
                            className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-center focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                          />
                          <button
                            onClick={() => handleRemoveItem(item.materialeId)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes & Urgency */}
              <div className="space-y-3">
                <textarea
                  placeholder="Note aggiuntive per l'ufficio acquisti..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs min-h-[80px] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${isUrgent ? 'bg-rose-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isUrgent ? 'left-6' : 'left-1'}`} />
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 group-hover:text-slate-900">
                    Segnala come URGENTE
                  </span>
                </label>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedItems.length === 0}
                className="w-full bg-slate-950 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 disabled:opacity-50 transition-all shadow-lg"
              >
                {isSubmitting ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-amber-400" />}
                Invia Richiesta all'Ufficio
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* History List */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-xs text-slate-400 font-medium">
            Nessuna richiesta materiali inviata.
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{new Date(req.date).toLocaleDateString('it-IT')}</span>
                  {getStatusBadge(req.status)}
                  {req.urgent && (
                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase animate-pulse">Urgente</span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Richiesta di: {req.userName}</p>
              </div>
              
              <div className="space-y-1">
                {req.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800">{item.materialeName}</span>
                    <span className="font-black text-slate-900">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>

              {req.notes && (
                <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                  Note: {req.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
