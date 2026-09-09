import React, { useState } from 'react';
import { Cantiere, Personale, Mezzo, Rapportino, UserAccount } from '../types';
import { Smartphone, Camera, Plus, Trash2, Send, CheckCircle, Calendar, HardHat, Wrench, Package, ArrowLeft, Fuel } from 'lucide-react';

interface MobileRapportinoViewProps {
  currentUser: UserAccount;
  cantieri: Cantiere[];
  personaleList: Personale[];
  mezziList: Mezzo[];
  onAddRapportino: (rapportino: Rapportino) => void;
  onBackToAdmin?: () => void;
}

export const MobileRapportinoView: React.FC<MobileRapportinoViewProps> = ({
  currentUser,
  cantieri,
  personaleList,
  mezziList,
  onAddRapportino,
  onBackToAdmin,
}) => {
  const [selectedCantiereId, setSelectedCantiereId] = useState(currentUser.cantiereId || cantieri[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [descrizione, setDescrizione] = useState('');
  
  // Personnel hours
  const [selectedPersonale, setSelectedPersonale] = useState<Array<{ personaleId: string; hours: number }>>([
    { personaleId: personaleList[0]?.id || '', hours: 8 }
  ]);

  // Materials used
  const [materiali, setMateriali] = useState<Array<{ name: string; quantity: number; unit: string; costoUnitario: number }>>([
    { name: '', quantity: 1, unit: 'sacchi', costoUnitario: 0 }
  ]);

  // Machinery used
  const [mezzi, setMezzi] = useState<Array<{ mezzoId: string; hours: number; fuelLiters: number; fuelCost: number; maintenanceCost: number }>>([]);

  // Photos
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1541888946425-d0fbb18f2632?auto=format&fit=crop&w=600&q=80'
  ]);

  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleAddPersonaleRow = () => {
    setSelectedPersonale([...selectedPersonale, { personaleId: personaleList[0]?.id || '', hours: 8 }]);
  };

  const handleAddMaterialeRow = () => {
    setMateriali([...materiali, { name: '', quantity: 1, unit: 'sacchi', costoUnitario: 0 }]);
  };

  const handleAddMezzoRow = () => {
    setMezzi([...mezzi, { mezzoId: mezziList[0]?.id || '', hours: 4, fuelLiters: 10, fuelCost: 20, maintenanceCost: 0 }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCantiereId || !descrizione.trim()) {
      alert('Seleziona un cantiere e inserisci una descrizione dei lavori svolti.');
      return;
    }

    const newRapportino: Rapportino = {
      id: 'rap-' + Date.now(),
      cantiereId: selectedCantiereId,
      userId: currentUser.id,
      userName: currentUser.name,
      date,
      descrizione,
      personale: selectedPersonale,
      materiali: materiali.filter(m => m.name.trim() !== '').map((m, idx) => ({ ...m, id: 'mat-' + idx })),
      mezzi,
      photos,
      createdAt: new Date().toISOString(),
    };

    onAddRapportino(newRapportino);
    setSubmittedSuccess(true);
    setTimeout(() => {
      setSubmittedSuccess(false);
      setDescrizione('');
    }, 4000);
  };

  const handleSimulatePhotoAdd = () => {
    const samplePhotos = [
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80',
    ];
    const randomPhoto = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
    setPhotos([...photos, randomPhoto]);
  };

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-12 shadow-2xl border-x border-slate-200">
      {/* Mobile Device Frame Header */}
      <div className="bg-slate-900 text-white px-4 py-4 sticky top-0 z-20 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          {onBackToAdmin && (
            <button onClick={onBackToAdmin} className="p-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-bold text-sm flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-400" /> Rapportino Giornaliero Cantiere
            </h1>
            <p className="text-[11px] text-slate-400">Compilazione Rapida Operatore</p>
          </div>
        </div>
        <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-mono flex items-center gap-1 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Firebase Sync
        </div>
      </div>

      {submittedSuccess ? (
        <div className="p-8 text-center my-12 bg-white mx-4 rounded-3xl shadow-xl border border-emerald-100">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Rapportino Inviato con Successo!</h2>
          <p className="text-sm text-slate-600 mb-6">
            I dati del cantiere, il personale impiegato, i materiali e le foto sono stati catalogati sul server Firebase e notificati all'amministratore.
          </p>
          <button
            onClick={() => setSubmittedSuccess(false)}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm shadow hover:bg-slate-800"
          >
            Compila Nuovo Rapportino
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Cantiere & Data */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cantiere di Riferimento *</label>
              <select
                value={selectedCantiereId}
                onChange={(e) => setSelectedCantiereId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                required
              >
                {cantieri.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" /> Data Rapportino *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Descrizione Lavori */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Descrizione Lavori Svolti Oggi *</label>
            <textarea
              rows={3}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Es. Solaio primo piano, posa tubazioni idrauliche, getto cls..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
              required
            ></textarea>
          </div>

          {/* Personale Impegato */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-amber-600" /> Personale & Ore Impiegate
              </label>
              <button
                type="button"
                onClick={handleAddPersonaleRow}
                className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-lg border border-amber-200 hover:bg-amber-100 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Aggiungi
              </button>
            </div>

            {selectedPersonale.map((item, index) => (
              <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <select
                  value={item.personaleId}
                  onChange={(e) => {
                    const updated = [...selectedPersonale];
                    updated[index].personaleId = e.target.value;
                    setSelectedPersonale(updated);
                  }}
                  className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none"
                >
                  {personaleList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
                <div className="w-20">
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={item.hours}
                    onChange={(e) => {
                      const updated = [...selectedPersonale];
                      updated[index].hours = Number(e.target.value);
                      setSelectedPersonale(updated);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-center font-bold text-slate-900 outline-none"
                    placeholder="Ore"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">ore</span>
                {selectedPersonale.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPersonale(selectedPersonale.filter((_, i) => i !== index))}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Materiali Impiegati */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" /> Materiali Utilizzati
              </label>
              <button
                type="button"
                onClick={handleAddMaterialeRow}
                className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Aggiungi
              </button>
            </div>

            {materiali.map((mat, index) => (
              <div key={index} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome materiale / fornitura..."
                    value={mat.name}
                    onChange={(e) => {
                      const updated = [...materiali];
                      updated[index].name = e.target.value;
                      setMateriali(updated);
                    }}
                    className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMateriali(materiali.filter((_, i) => i !== index))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500">Qtà</span>
                    <input
                      type="number"
                      min="1"
                      value={mat.quantity}
                      onChange={(e) => {
                        const updated = [...materiali];
                        updated[index].quantity = Number(e.target.value);
                        setMateriali(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Unità</span>
                    <select
                      value={mat.unit}
                      onChange={(e) => {
                        const updated = [...materiali];
                        updated[index].unit = e.target.value;
                        setMateriali(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900 outline-none"
                    >
                      <option value="sacchi">sacchi</option>
                      <option value="mc">mc</option>
                      <option value="kg">kg</option>
                      <option value="metri">metri</option>
                      <option value="pz">pz</option>
                      <option value="tonn">tonn</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Costo Unit (€)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={mat.costoUnitario}
                      onChange={(e) => {
                        const updated = [...materiali];
                        updated[index].costoUnitario = Number(e.target.value);
                        setMateriali(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mezzi & Carburante Impiegati */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-purple-600" /> Mezzi & Costo Carburante
              </label>
              <button
                type="button"
                onClick={handleAddMezzoRow}
                className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-1 rounded-lg border border-purple-200 hover:bg-purple-100 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Aggiungi
              </button>
            </div>

            {mezzi.map((mItem, index) => (
              <div key={index} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={mItem.mezzoId}
                    onChange={(e) => {
                      const updated = [...mezzi];
                      updated[index].mezzoId = e.target.value;
                      setMezzi(updated);
                    }}
                    className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 outline-none"
                  >
                    {mezziList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.plate})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setMezzi(mezzi.filter((_, i) => i !== index))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500">Ore Lavoro</span>
                    <input
                      type="number"
                      min="0"
                      value={mItem.hours}
                      onChange={(e) => {
                        const updated = [...mezzi];
                        updated[index].hours = Number(e.target.value);
                        setMezzi(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><Fuel className="w-3 h-3 text-amber-500" /> Litri Gasolio</span>
                    <input
                      type="number"
                      min="0"
                      value={mItem.fuelLiters}
                      onChange={(e) => {
                        const updated = [...mezzi];
                        updated[index].fuelLiters = Number(e.target.value);
                        updated[index].fuelCost = Number(e.target.value) * 1.8; // stima 1.8€/L
                        setMezzi(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Costo Carburante (€)</span>
                    <input
                      type="number"
                      min="0"
                      value={mItem.fuelCost}
                      onChange={(e) => {
                        const updated = [...mezzi];
                        updated[index].fuelCost = Number(e.target.value);
                        setMezzi(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Foto Cantiere */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-600" /> Foto Cantiere & Prove Lavori
            </label>

            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                  <img src={p} alt={`Cantiere ${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full text-xs shadow hover:bg-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleSimulatePhotoAdd}
                className="aspect-square border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-amber-600 bg-slate-50 transition-colors"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-semibold">Scatta / Carica</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-base transition-transform active:scale-98"
          >
            <Send className="w-5 h-5" /> Invia Rapportino al Cloud (Firebase)
          </button>
        </form>
      )}
    </div>
  );
};
