import React, { useState, useRef } from 'react';
import { MaterialDocument, DocumentItem, Cantiere, Materiale, StockMovement, UserAccount } from '../types';
import { extractTextFromPdf, parseBollaOrFatturaText, ExtractedDocumentData } from '../utils/pdfExtractor';
import { 
  FileText, Upload, Plus, Trash2, CheckCircle2, Clock, 
  Building2, Search, Filter, AlertCircle, Eye, Download, 
  ArrowRightLeft, Sparkles, Loader2, Send, ChevronDown, Check,
  X, ExternalLink, Info, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BolleManagerProps {
  documents: MaterialDocument[];
  cantieri: Cantiere[];
  materiali: Materiale[];
  movements: StockMovement[];
  currentUser: UserAccount;
  onSaveDocument: (doc: MaterialDocument) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onAcceptDocument: (docId: string) => Promise<void>;
  onAcceptTransfer: (moveId: string) => Promise<void>;
  onAddMateriale: (m: Materiale) => Promise<void>;
}

export const BolleManager: React.FC<BolleManagerProps> = ({
  documents,
  cantieri,
  materiali,
  movements,
  currentUser,
  onSaveDocument,
  onDeleteDocument,
  onAcceptDocument,
  onAcceptTransfer,
  onAddMateriale,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'bolla' | 'fattura'>('all');
  const [selectedCantiereFilter, setSelectedCantiereFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocDetails, setSelectedDocDetails] = useState<MaterialDocument | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Upload & Extraction state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedNotice, setExtractedNotice] = useState<string | null>(null);
  const [uploadedPdfName, setUploadedPdfName] = useState<string | null>(null);
  const [uploadedPdfDataUrl, setUploadedPdfDataUrl] = useState<string | null>(null);

  // Form state for creating a new Bolla / Fattura
  const [docForm, setDocForm] = useState<{
    type: 'bolla' | 'fattura';
    number: string;
    date: string;
    supplier: string;
    acceptanceNote: string;
    defaultDestination: string; // 'centrale' or cantiereId
    status: 'in_attesa_accettazione' | 'accettata';
    items: {
      materialeId: string;
      materialeName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      destinationCantiereId: string;
    }[];
  }>({
    type: 'bolla',
    number: '',
    date: new Date().toISOString().split('T')[0],
    supplier: '',
    acceptanceNote: 'Verificare integrità materiali ed esattezza quantità allo scarico.',
    defaultDestination: cantieri[0]?.id || 'centrale',
    status: 'in_attesa_accettazione',
    items: [
      {
        materialeId: '',
        materialeName: 'Calcestruzzo Rck 30',
        quantity: 10,
        unit: 'mc',
        unitPrice: 95,
        destinationCantiereId: cantieri[0]?.id || 'centrale',
      }
    ],
  });

  // Calculate stats
  const totalAmountSum = documents.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
  const pendingAcceptanceCount = documents.filter(d => d.status === 'in_attesa_accettazione').length;
  const acceptedCount = documents.filter(d => d.status === 'accettata').length;

  // Handle PDF file selection & instant recognition
  const handlePdfUpload = async (file: File) => {
    setIsExtracting(true);
    setExtractedNotice(null);
    setUploadedPdfName(file.name);

    try {
      // 1. Read Base64 DataUrl for preview if size is reasonable (< 1.5MB)
      if (file.size < 1500000) {
        const reader = new FileReader();
        reader.onload = () => {
          setUploadedPdfDataUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }

      // 2. Client-side text extraction using native pdfjs-dist
      const rawText = await extractTextFromPdf(file);
      const parsed: ExtractedDocumentData = parseBollaOrFatturaText(rawText, file.name);

      // 3. Map extracted items or create items
      const mappedItems = parsed.items.map((item, idx) => {
        // Find existing material in catalog
        const found = materiali.find(m => 
          m.name.toLowerCase().includes(item.materialeName.toLowerCase()) || 
          item.materialeName.toLowerCase().includes(m.name.toLowerCase())
        );

        return {
          materialeId: found ? found.id : `mat-ext-${Date.now()}-${idx}`,
          materialeName: item.materialeName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          destinationCantiereId: docForm.defaultDestination,
        };
      });

      setDocForm(prev => ({
        ...prev,
        type: parsed.type,
        number: parsed.number,
        date: parsed.date,
        supplier: parsed.supplier,
        items: mappedItems.length > 0 ? mappedItems : prev.items,
      }));

      setExtractedNotice(
        `PDF analizzato con successo! Riconosciuti: Fornitore (${parsed.supplier}), ${parsed.type.toUpperCase()} N. ${parsed.number}, Data ${parsed.date}, ${mappedItems.length} righe materiali.`
      );
    } catch (err) {
      console.error('Extraction error:', err);
      setExtractedNotice('Lettura automatica parziale. Puoi comunque verificare e completare i campi manualmente.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Add a new row to the items list
  const handleAddItemRow = () => {
    setDocForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialeId: '',
          materialeName: '',
          quantity: 1,
          unit: 'pz',
          unitPrice: 0,
          destinationCantiereId: prev.defaultDestination,
        }
      ]
    }));
  };

  // Remove row
  const handleRemoveItemRow = (index: number) => {
    if (docForm.items.length <= 1) return;
    setDocForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Propagate master destination change to all items
  const handleMasterDestinationChange = (destId: string) => {
    setDocForm(prev => ({
      ...prev,
      defaultDestination: destId,
      items: prev.items.map(i => ({ ...i, destinationCantiereId: destId }))
    }));
  };

  // Save new document
  const handleSaveNewDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.number.trim() || !docForm.supplier.trim()) {
      alert('Inserisci il numero documento e il fornitore.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure any new materials are registered in catalog
      for (const item of docForm.items) {
        const existing = materiali.find(m => m.id === item.materialeId || m.name.toLowerCase() === item.materialeName.toLowerCase());
        if (!existing && item.materialeName.trim()) {
          const newMat: Materiale = {
            id: item.materialeId || `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: item.materialeName.trim(),
            unit: item.unit || 'pz',
            defaultPrice: item.unitPrice || 0,
            category: 'Edili'
          };
          await onAddMateriale(newMat);
        }
      }

      // Calculate total amount
      const totalAmount = docForm.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

      // Check if all items go to same cantiere or are split
      const destinations: string[] = Array.from(new Set(docForm.items.map(i => i.destinationCantiereId || 'centrale')));
      const isSplit = destinations.length > 1;
      const primaryDestination: string = isSplit ? 'misto' : (destinations[0] || 'centrale');

      const isCentraleOnly = destinations.length === 1 && destinations[0] === 'centrale';
      const initialDocStatus = isCentraleOnly ? 'accettata' : docForm.status;

      const newDoc: MaterialDocument = {
        id: `doc-${Date.now()}`,
        number: docForm.number.trim(),
        date: docForm.date,
        supplier: docForm.supplier.trim(),
        type: docForm.type,
        totalAmount,
        notes: `Caricata da ${currentUser.name}`,
        acceptanceNote: docForm.acceptanceNote,
        destinationCantiereId: primaryDestination,
        pdfDataUrl: uploadedPdfDataUrl || undefined,
        fileName: uploadedPdfName || undefined,
        status: initialDocStatus,
        createdAt: new Date().toISOString(),
        items: docForm.items.map(item => ({
          materialeId: item.materialeId || `mat-${Date.now()}`,
          materialeName: item.materialeName.trim(),
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          destinationCantiereId: item.destinationCantiereId,
          status: item.destinationCantiereId === 'centrale' || initialDocStatus === 'accettata' ? 'accettata' : 'in_attesa',
        }))
      };

      await onSaveDocument(newDoc);
      setShowUploadModal(false);
      // Reset form
      setDocForm({
        type: 'bolla',
        number: '',
        date: new Date().toISOString().split('T')[0],
        supplier: '',
        acceptanceNote: 'Verificare integrità materiali ed esattezza quantità allo scarico.',
        defaultDestination: cantieri[0]?.id || 'centrale',
        status: 'in_attesa_accettazione',
        items: [
          {
            materialeId: '',
            materialeName: '',
            quantity: 1,
            unit: 'pz',
            unitPrice: 0,
            destinationCantiereId: cantieri[0]?.id || 'centrale',
          }
        ]
      });
      setUploadedPdfDataUrl(null);
      setUploadedPdfName(null);
      setExtractedNotice(null);
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Errore durante il salvataggio della bolla.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.items.some(i => i.materialeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.notes && doc.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = selectedType === 'all' || doc.type === selectedType;
    
    const matchesCantiere = 
      selectedCantiereFilter === 'all' || 
      doc.destinationCantiereId === selectedCantiereFilter ||
      doc.items.some(i => i.destinationCantiereId === selectedCantiereFilter);

    const matchesStatus = 
      selectedStatusFilter === 'all' || 
      doc.status === selectedStatusFilter;

    return matchesSearch && matchesType && matchesCantiere && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <FileText className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestione Bolle & Fatture (DDT)</h2>
              <p className="text-xs font-medium text-slate-500">
                Caricamento PDF con riconoscimento automatico, spacchettamento nei cantieri e note di accettazione.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setUploadedPdfName(null);
              setUploadedPdfDataUrl(null);
              setExtractedNotice(null);
              setShowUploadModal(true);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3.5 rounded-2xl text-xs flex items-center gap-2.5 shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            <span>Carica Bolla / Fattura PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Documenti Registrati</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900">{documents.length}</p>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {documents.filter(d => d.type === 'bolla').length} Bolle DDT • {documents.filter(d => d.type === 'fattura').length} Fatture
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valore Totale Forniture</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600">
            €{totalAmountSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs font-semibold text-slate-400 mt-1">Acquisti caricati a sistema</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">In Attesa Capocantiere</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-600">{pendingAcceptanceCount}</p>
          <p className="text-xs font-semibold text-slate-400 mt-1">Da verificare allo scarico</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accettate nei Cantieri</span>
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900">{acceptedCount}</p>
          <p className="text-xs font-semibold text-slate-400 mt-1">Valore caricato nel costo cantiere</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca per n. bolla, fornitore o materiale..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl pl-11 pr-4 py-3 text-xs outline-none focus:border-amber-500 transition-colors font-medium"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs outline-none font-bold text-slate-700"
            >
              <option value="all">Tutti i Documenti</option>
              <option value="bolla">Solo Bolle di Consegna (DDT)</option>
              <option value="fattura">Solo Fatture Immediate / Accompagnatorie</option>
            </select>
          </div>

          {/* Cantiere Destination Filter */}
          <div>
            <select
              value={selectedCantiereFilter}
              onChange={e => setSelectedCantiereFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs outline-none font-bold text-slate-700"
            >
              <option value="all">Tutte le Destinazioni</option>
              <option value="centrale">Magazzino Centrale</option>
              <option value="misto">Spacchettato (Più Cantieri)</option>
              {cantieri.map(c => (
                <option key={c.id} value={c.id}>Cantiere: {c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs outline-none font-bold text-slate-700"
            >
              <option value="all">Tutti gli Stati</option>
              <option value="in_attesa_accettazione">In Attesa di Accettazione</option>
              <option value="accettata">Accettata & Caricata</option>
              <option value="parzialmente_accettata">Parzialmente Accettata</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Documents Registry Table */}
      <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-lg text-slate-900">Registro Storico Bolle & Forniture</h3>
            <p className="text-xs text-slate-400 font-medium">
              Elenco dettagliato con spacchettamento materiali e tracking accettazione capocantiere.
            </p>
          </div>
          <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3.5 py-1.5 rounded-full self-start">
            {filteredDocuments.length} di {documents.length} documenti
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <p className="font-bold text-slate-700 text-base">Nessun documento trovato</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Carica la tua prima bolla o fattura in PDF per visualizzare il riconoscimento automatico e lo spacchettamento.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-amber-500 text-slate-950 px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-amber-600 transition-colors shadow-sm"
            >
              Carica PDF Ora
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornitore</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destinazione</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiali (Spacchettati)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valore (€)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Stato Accettazione</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map(doc => {
                  const targetCantiere = cantieri.find(c => c.id === doc.destinationCantiereId);
                  const isPending = doc.status === 'in_attesa_accettazione';

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Document Type & Number */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${
                            doc.type === 'bolla' 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {doc.type === 'bolla' ? 'DDT' : 'FATT'}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">N. {doc.number}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{doc.date}</p>
                          </div>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-6 py-4.5">
                        <p className="text-xs font-bold text-slate-900">{doc.supplier}</p>
                        {doc.fileName && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[150px]">
                            <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                            {doc.fileName}
                          </p>
                        )}
                      </td>

                      {/* Destination Cantiere */}
                      <td className="px-6 py-4.5">
                        {doc.destinationCantiereId === 'centrale' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                            <Building2 className="w-3 h-3 text-slate-500" /> Magazzino Centrale
                          </span>
                        ) : doc.destinationCantiereId === 'misto' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                            <Layers className="w-3 h-3 text-amber-600" /> Più Cantieri
                          </span>
                        ) : targetCantiere ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                            <Building2 className="w-3 h-3 text-emerald-600" /> {targetCantiere.name}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Non specificato</span>
                        )}
                      </td>

                      {/* Itemized Materials */}
                      <td className="px-6 py-4.5 max-w-xs">
                        <div className="space-y-1">
                          {doc.items.slice(0, 2).map((item, idx) => (
                            <p key={idx} className="text-xs text-slate-700 font-medium truncate">
                              <span className="font-bold text-slate-900">{item.quantity} {item.unit}</span> - {item.materialeName}
                            </p>
                          ))}
                          {doc.items.length > 2 && (
                            <p className="text-[10px] text-amber-600 font-bold">
                              + altri {doc.items.length - 2} materiali...
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="px-6 py-4.5 text-right">
                        <p className="text-sm font-black text-slate-900">
                          €{doc.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </td>

                      {/* Acceptance Status */}
                      <td className="px-6 py-4.5 text-center">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                            <Clock className="w-3 h-3 text-amber-600" /> In Attesa Capocantiere
                          </span>
                        ) : doc.status === 'accettata' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                            <Check className="w-3 h-3 text-emerald-600" /> Accettata & Caricata
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                            <Check className="w-3 h-3 text-blue-600" /> Parziale
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              onClick={async () => {
                                if (confirm(`Confermi l'accettazione di questa fornitura per caricarla nel cantiere e aggiornare i costi materiali?`)) {
                                  await onAcceptDocument(doc.id);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                              title="Accetta subito fornitura"
                            >
                              <Check className="w-3.5 h-3.5" /> Accetta
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedDocDetails(doc)}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Vedi dettagli e spacchettamento"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={async () => {
                              if (confirm(`Eliminare definitivamente il documento ${doc.number} e i relativi movimenti associati?`)) {
                                await onDeleteDocument(doc.id);
                              }
                            }}
                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Elimina documento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: UPLOAD & EDIT BOLLE / FATTURE PDF */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[36px] shadow-2xl max-w-4xl w-full p-8 sm:p-10 border border-slate-200 overflow-y-auto max-h-[92vh] my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Carica & Riconosci Bolla / Fattura</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Riconoscimento nativo in browser: rileva fornitore, data, totali e spacchetta i materiali per cantiere.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewDocument} className="space-y-8">
              {/* Drag & Drop PDF Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/70 p-6 sm:p-8 rounded-3xl transition-all cursor-pointer text-center group relative overflow-hidden"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfUpload(file);
                  }}
                />

                {isExtracting ? (
                  <div className="flex flex-col items-center justify-center py-4 space-y-3">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <p className="text-sm font-bold text-slate-800">Analisi e riconoscimento automatico in corso...</p>
                    <p className="text-xs text-slate-500">Estrazione fornitore, n. bolla, data e righe materiali...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-md border border-amber-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles className="w-7 h-7 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {uploadedPdfName ? `File selezionato: ${uploadedPdfName}` : 'Trascina qui il file PDF della Bolla / Fattura o clicca per sfogliare'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supporta PDF e scansioni. Il browser estrarrà i dati gratis e senza inviarli a server esterni.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Extraction notice banner */}
              {extractedNotice && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Riconoscimento Automatico Completato</p>
                    <p className="text-emerald-700 mt-0.5">{extractedNotice}</p>
                  </div>
                </div>
              )}

              {/* Document Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tipo Documento *</label>
                  <select
                    value={docForm.type}
                    onChange={e => setDocForm({ ...docForm, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-amber-500"
                  >
                    <option value="bolla">Bolla di Consegna (DDT)</option>
                    <option value="fattura">Fattura Accompagnatoria</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Numero Documento *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. DDT 142/B"
                    value={docForm.number}
                    onChange={e => setDocForm({ ...docForm, number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Documento *</label>
                  <input
                    type="date"
                    required
                    value={docForm.date}
                    onChange={e => setDocForm({ ...docForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fornitore / Cedente *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. Italcementi S.p.A."
                    value={docForm.supplier}
                    onChange={e => setDocForm({ ...docForm, supplier: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Master Destination / Spacchettamento Controls */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-500" /> Smistamento Predefinito
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Puoi assegnare tutti i materiali a un cantiere o differenziare riga per riga.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Assegna Tutti a:</span>
                    <select
                      value={docForm.defaultDestination}
                      onChange={e => handleMasterDestinationChange(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
                    >
                      <option value="centrale">Magazzino Centrale</option>
                      {cantieri.map(c => (
                        <option key={c.id} value={c.id}>Cantiere: {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Spacchettamento Righe Materiali */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Spacchettamento Elementi della Bolla</h4>
                    <p className="text-[11px] text-slate-400">
                      Ogni riga può essere indirizzata a un cantiere diverso o al magazzino.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-600" /> Aggiungi Riga
                  </button>
                </div>

                <div className="space-y-2.5">
                  {docForm.items.map((item, idx) => (
                    <div key={idx} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      {/* Material Name / Description */}
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Materiale / Descrizione</label>
                        <input
                          type="text"
                          required
                          placeholder="Nome materiale"
                          value={item.materialeName}
                          onChange={e => {
                            const updated = [...docForm.items];
                            updated[idx].materialeName = e.target.value;
                            setDocForm({ ...docForm, items: updated });
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                        />
                      </div>

                      {/* Quantity & Unit */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Quantità</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.quantity}
                            onChange={e => {
                              const updated = [...docForm.items];
                              updated[idx].quantity = parseFloat(e.target.value) || 0;
                              setDocForm({ ...docForm, items: updated });
                            }}
                            className="w-2/3 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold outline-none text-center"
                          />
                          <input
                            type="text"
                            placeholder="U.M."
                            value={item.unit}
                            onChange={e => {
                              const updated = [...docForm.items];
                              updated[idx].unit = e.target.value;
                              setDocForm({ ...docForm, items: updated });
                            }}
                            className="w-1/3 bg-white border border-slate-200 rounded-xl px-1.5 py-2 text-[11px] font-bold outline-none text-center"
                          />
                        </div>
                      </div>

                      {/* Unit Price */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Prezzo Unit. (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.unitPrice}
                          onChange={e => {
                            const updated = [...docForm.items];
                            updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                            setDocForm({ ...docForm, items: updated });
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold outline-none text-right"
                        />
                      </div>

                      {/* Destination for this specific line */}
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Destinazione Cantiere</label>
                        <select
                          value={item.destinationCantiereId}
                          onChange={e => {
                            const updated = [...docForm.items];
                            updated[idx].destinationCantiereId = e.target.value;
                            setDocForm({ ...docForm, items: updated });
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold outline-none truncate"
                        >
                          <option value="centrale">Magazzino Centrale</option>
                          {cantieri.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Remove Row */}
                      <div className="md:col-span-1 flex justify-center pt-3 md:pt-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          disabled={docForm.items.length <= 1}
                          className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acceptance Workflow & Capocantiere Note */}
              <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-3xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-amber-600" /> Workflow Accettazione Capocantiere
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Se inviato in attesa, il capocantiere riceverà la notifica e con 1 tap caricherà i materiali nel cantiere aggiornando i costi.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDocForm({ ...docForm, status: 'in_attesa_accettazione' })}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        docForm.status === 'in_attesa_accettazione'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'bg-white/80 text-slate-600 hover:bg-white'
                      }`}
                    >
                      In Attesa Accettazione
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocForm({ ...docForm, status: 'accettata' })}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        docForm.status === 'accettata'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-white/80 text-slate-600 hover:bg-white'
                      }`}
                    >
                      Già Accettata Subito
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Nota di consegna per il Capocantiere
                  </label>
                  <input
                    type="text"
                    value={docForm.acceptanceNote}
                    onChange={e => setDocForm({ ...docForm, acceptanceNote: e.target.value })}
                    placeholder="es. Verificare i bancali allo scarico e la corrispondenza con il DDT allegato"
                    className="w-full bg-white border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-amber-500 font-medium"
                  />
                </div>
              </div>

              {/* Total & Submit Action Bar */}
              <div className="bg-slate-900 rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-white">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Totale Complessivo Bolla</p>
                  <p className="text-3xl font-black text-amber-500">
                    €{docForm.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {docForm.items.length} riga/e materiali spacchettati
                  </p>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 sm:flex-none px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvataggio...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Registra e Invia Fornitura</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: VIEW DETAILS & FULL SPACCHETTAMENTO */}
      {selectedDocDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[36px] shadow-2xl max-w-3xl w-full p-8 sm:p-10 border border-slate-200 overflow-y-auto max-h-[90vh] my-auto space-y-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                    selectedDocDetails.type === 'bolla' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedDocDetails.type.toUpperCase()}
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    N. {selectedDocDetails.number}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Fornitore: <span className="font-bold text-slate-800">{selectedDocDetails.supplier}</span> • Emesso il: <span className="font-bold text-slate-800">{selectedDocDetails.date}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedDocDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Note per il Capocantiere */}
            {selectedDocDetails.acceptanceNote && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Nota di Accettazione per il Cantiere
                </p>
                <p className="text-xs text-slate-800 font-medium">{selectedDocDetails.acceptanceNote}</p>
              </div>
            )}

            {/* Spacchettamento Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Dettaglio Spacchettamento Materiali ({selectedDocDetails.items.length} voci)
              </h4>
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="px-4 py-3">Materiale</th>
                      <th className="px-4 py-3">Quantità</th>
                      <th className="px-4 py-3">Prezzo Unit.</th>
                      <th className="px-4 py-3">Destinazione</th>
                      <th className="px-4 py-3 text-right">Totale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedDocDetails.items.map((item, idx) => {
                      const cDest = cantieri.find(c => c.id === item.destinationCantiereId);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900">{item.materialeName}</td>
                          <td className="px-4 py-3 font-semibold">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-3 text-slate-500">€{item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">
                              <Building2 className="w-3 h-3 text-amber-500" />
                              {item.destinationCantiereId === 'centrale' ? 'Magazzino Centrale' : cDest?.name || 'Cantiere'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-black text-slate-900 text-right">
                            €{item.totalPrice.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PDF View or Download if available */}
            {selectedDocDetails.pdfDataUrl && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{selectedDocDetails.fileName || 'Documento_Originale.pdf'}</p>
                    <p className="text-[10px] text-slate-400">File allegato</p>
                  </div>
                </div>
                <a
                  href={selectedDocDetails.pdfDataUrl}
                  download={selectedDocDetails.fileName || `Bolla_${selectedDocDetails.number}.pdf`}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Scarica PDF
                </a>
              </div>
            )}

            {/* Acceptance Footer */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valore Totale</p>
                <p className="text-2xl font-black text-amber-500">
                  €{selectedDocDetails.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="flex gap-3">
                {selectedDocDetails.status === 'in_attesa_accettazione' && (
                  <button
                    onClick={async () => {
                      await onAcceptDocument(selectedDocDetails.id);
                      setSelectedDocDetails({
                        ...selectedDocDetails,
                        status: 'accettata'
                      });
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Check className="w-4 h-4" /> Accetta Tutto nel Cantiere
                  </button>
                )}
                <button
                  onClick={() => setSelectedDocDetails(null)}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-3 rounded-2xl text-xs transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
