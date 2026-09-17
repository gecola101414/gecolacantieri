import React, { useState, useRef } from 'react';
import { MaterialDocument, DocumentItem, Cantiere, Materiale, StockMovement, UserAccount } from '../types';
import { extractTextFromPdf, parseBollaOrFatturaText, ExtractedDocumentData } from '../utils/pdfExtractor';
import { formatItalianDate } from '../utils/dateUtils';
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
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocDetails, setSelectedDocDetails] = useState<MaterialDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<MaterialDocument | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract unique suppliers
  const uniqueSuppliers = Array.from(new Set(documents.map(d => d.supplier).filter(Boolean))).sort();

  // Upload & Extraction state (PDF files only)
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
    parsedDocumentTotal?: number;
    parsedImponibile?: number;
    destinationHint?: string;
    summaryDescription?: string;
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
    summaryDescription: '',
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

  // Apply parsed document data to docForm
  const applyExtractedData = (parsed: ExtractedDocumentData, sourceLabel: string) => {
    // Match destination cantiere if specified in document
    let matchedDestinationId = docForm.defaultDestination;
    let matchedDestinationName = '';
    if (parsed.destinationCantiere) {
      const destLower = parsed.destinationCantiere.toLowerCase();
      const foundCantiere = cantieri.find(c => 
        destLower.includes(c.name.toLowerCase()) || 
        c.name.toLowerCase().includes(destLower) ||
        (c.address && (destLower.includes(c.address.toLowerCase()) || c.address.toLowerCase().includes(destLower)))
      );
      if (foundCantiere) {
        matchedDestinationId = foundCantiere.id;
        matchedDestinationName = foundCantiere.name;
      }
    }

    // Map extracted items
    const mappedItems = parsed.items.map((item, idx) => {
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
        destinationCantiereId: matchedDestinationId,
      };
    });

    const totalItemsPrice = parseFloat(mappedItems.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toFixed(2));

    setDocForm(prev => ({
      ...prev,
      type: parsed.type,
      number: parsed.number,
      date: parsed.date,
      supplier: parsed.supplier,
      defaultDestination: matchedDestinationId,
      destinationHint: parsed.destinationCantiere,
      summaryDescription: parsed.summaryDescription || prev.summaryDescription,
      parsedDocumentTotal: totalItemsPrice > 0 ? totalItemsPrice : (parsed.totalAmount || 0),
      parsedImponibile: totalItemsPrice > 0 ? totalItemsPrice : (parsed.imponibile || 0),
      items: mappedItems.length > 0 ? mappedItems : prev.items,
    }));

    const destInfo = matchedDestinationName 
      ? ` Destinazione: "${matchedDestinationName}".` 
      : (parsed.destinationCantiere ? ` Destinazione rilevata: "${parsed.destinationCantiere}".` : '');

    const formattedDate = formatItalianDate(parsed.date);

    setExtractedNotice(
      `${sourceLabel} analizzato con successo! Riconosciuti: Fornitore (${parsed.supplier}), ${parsed.type.toUpperCase()} N. ${parsed.number}, Data ${formattedDate}, ${mappedItems.length} voci materiali.${destInfo} Totale (IVA Esclusa): €${(totalItemsPrice > 0 ? totalItemsPrice : parsed.totalAmount).toFixed(2)}.`
    );
  };

  // Handle PDF file selection & AI recognition (PDF ONLY)
  const handleFileUpload = async (file: File) => {
    setIsExtracting(true);
    setExtractedNotice(null);
    setUploadedPdfName(file.name);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setExtractedNotice('Errore: formato file non supportato. È possibile caricare esclusivamente documenti in formato PDF.');
      setIsExtracting(false);
      return;
    }

    try {
      if (file.size < 2000000) {
        const reader = new FileReader();
        reader.onload = () => {
          setUploadedPdfDataUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }

      const rawText = await extractTextFromPdf(file);
      if (rawText && rawText.trim().length > 30) {
        try {
          // Send extracted PDF text to AI analysis endpoint
          const res = await fetch('/api/analyze-bolla', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText, fileName: file.name }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            const d = json.data;
            const mappedItems = (d.items || []).map((it: any) => {
              const qty = Number(it.quantity) || 1;
              const uPrice = Number(it.unitPrice) || (it.totalPrice && qty ? Number((it.totalPrice / qty).toFixed(2)) : 0);
              const tPrice = Number(it.totalPrice) || Number((qty * uPrice).toFixed(2));
              return {
                code: it.code || undefined,
                materialeName: it.materialeName || '',
                quantity: qty,
                unit: it.unit || 'pz',
                unitPrice: uPrice,
                totalPrice: tPrice,
              };
            });

            const parsed: ExtractedDocumentData = {
              type: d.type === 'fattura' ? 'fattura' : 'bolla',
              number: d.number || '',
              date: d.date || new Date().toISOString().split('T')[0],
              supplier: d.supplier || '',
              destinationCantiere: d.destinationCantiere || '',
              totalAmount: typeof d.totalAmount === 'number' ? d.totalAmount : mappedItems.reduce((s, i) => s + i.totalPrice, 0),
              imponibile: typeof d.imponibile === 'number' ? d.imponibile : undefined,
              summaryDescription: d.summaryDescription || '',
              rawText: rawText,
              confidence: { supplier: true, number: true, date: true, totalAmount: true, items: true },
              items: mappedItems,
            };
            applyExtractedData(parsed, 'Documento PDF (con Intelligenza Artificiale Gemini)');
            return;
          }
        } catch (aiErr) {
          console.warn('AI PDF analysis failed, using local parser:', aiErr);
        }

        // Fallback to local regex parser
        const parsed: ExtractedDocumentData = parseBollaOrFatturaText(rawText, file.name);
        applyExtractedData(parsed, 'Documento PDF (Lettura Testo Completa)');
      } else {
        setExtractedNotice('Il PDF non contiene testo decodificabile. Assicurarsi che sia un file PDF generato da gestionale o con testo selezionabile.');
      }
    } catch (err: any) {
      console.error('File recognition error:', err);
      setExtractedNotice(`Analisi automatica: ${err.message || 'parziale'}. Puoi verificare e completare i campi manualmente.`);
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

      // Calculate total amount (IVA Esclusa) strictly from the sum of line items
      const totalAmount = parseFloat(docForm.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toFixed(2));

      // Check if all items go to same cantiere or are split
      const destinations: string[] = Array.from(new Set(docForm.items.map(i => i.destinationCantiereId || 'centrale')));
      const isSplit = destinations.length > 1;
      const primaryDestination: string = isSplit ? 'misto' : (destinations[0] || 'centrale');

      const isCentraleOnly = destinations.length === 1 && destinations[0] === 'centrale';
      const initialDocStatus = isCentraleOnly ? 'accettata' : docForm.status;

      const finalTotal = totalAmount > 0 ? totalAmount : (docForm.parsedDocumentTotal || 0);

      const newDoc: MaterialDocument = {
        id: `doc-${Date.now()}`,
        number: docForm.number.trim(),
        date: docForm.date,
        supplier: docForm.supplier.trim(),
        type: docForm.type,
        totalAmount: finalTotal,
        imponibile: finalTotal,
        documentTotalOriginal: docForm.parsedDocumentTotal,
        summaryDescription: docForm.summaryDescription || docForm.items.map(i => `${i.materialeName} (${i.quantity} ${i.unit})`).join(', '),
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
        summaryDescription: '',
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

    const matchesSupplier = 
      selectedSuppliers.length === 0 || 
      selectedSuppliers.includes(doc.supplier);

    return matchesSearch && matchesType && matchesCantiere && matchesStatus && matchesSupplier;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

          {/* Supplier Multi-Select */}
          <div className="relative">
            <div 
              onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs outline-none font-bold text-slate-700 cursor-pointer flex justify-between items-center"
            >
              <span className="truncate">
                {selectedSuppliers.length === 0 
                  ? "Tutti i Fornitori" 
                  : `${selectedSuppliers.length} selezionati`}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
            {showSupplierDropdown && (
              <div className="absolute z-50 mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                <div className="p-2 space-y-1">
                  {uniqueSuppliers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500 italic">Nessun fornitore</div>
                  ) : (
                    uniqueSuppliers.map(sup => (
                      <label key={sup} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                        <input 
                          type="checkbox"
                          className="rounded text-amber-500 focus:ring-amber-500"
                          checked={selectedSuppliers.includes(sup)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSuppliers([...selectedSuppliers, sup]);
                            } else {
                              setSelectedSuppliers(selectedSuppliers.filter(s => s !== sup));
                            }
                          }}
                        />
                        <span className="text-xs font-medium text-slate-700 truncate" title={sup}>{sup}</span>
                      </label>
                    ))
                  )}
                  {selectedSuppliers.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-slate-100">
                      <button 
                        onClick={() => {
                          setSelectedSuppliers([]);
                          setShowSupplierDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-[10px] font-bold text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                      >
                        Reset Filtro
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
                            <p className="text-[11px] text-slate-400 font-medium">{formatItalianDate(doc.date)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-6 py-4.5">
                        <p className="text-xs font-bold text-slate-900">{doc.supplier}</p>
                        {doc.fileName && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewDocument(doc);
                            }}
                            className="text-[10px] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 mt-0.5 truncate max-w-[150px] transition-colors cursor-pointer"
                            title="Visualizza documento originale"
                          >
                            <FileText className="w-3 h-3 shrink-0" />
                            {doc.fileName}
                          </button>
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

                      {/* Itemized Materials / Breve Descrizione */}
                      <td className="px-6 py-4.5 max-w-sm">
                        {doc.summaryDescription ? (
                          <div className="space-y-1">
                            <p className="text-xs text-slate-800 font-semibold line-clamp-2" title={doc.summaryDescription}>
                              {doc.summaryDescription}
                            </p>
                            <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                              <span>{doc.items.length} voci materiali</span>
                            </p>
                          </div>
                        ) : (
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
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="px-6 py-4.5 text-right">
                        <p className="text-sm font-black text-slate-900">
                          €{doc.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="text-[9px] font-bold text-slate-400">Totale Bolla</span>
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
              {/* Document Input Options Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Acquisizione Documenti:</span>
                  <span className="text-[10px] px-2.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-full border border-amber-300">
                    Solo File PDF (.pdf)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm flex items-center gap-2 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Seleziona File PDF</span>
                  </button>
                </div>
              </div>

              {/* Hidden file input restricted strictly to PDF */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              {/* Drag & Drop Dropzone for PDF */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/70 p-7 sm:p-9 rounded-3xl transition-all cursor-pointer text-center group relative overflow-hidden"
              >
                {isExtracting ? (
                  <div className="flex flex-col items-center justify-center py-4 space-y-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
                      <Sparkles className="w-5 h-5 text-amber-600 absolute inset-0 m-auto" />
                    </div>
                    <p className="text-sm font-bold text-slate-900">Analisi Documento PDF in corso (Gemini AI)...</p>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Estrazione di fornitore, n. documento, data, cantiere, totali e tutte le righe articolo anche su documenti multi-pagina...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileText className="w-7 h-7 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {uploadedPdfName ? `PDF Selezionato: ${uploadedPdfName}` : 'Trascina o clicca per caricare una Bolla / Fattura in formato PDF'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Accetta esclusivamente file <strong>PDF</strong> (singole e multi-pagina). L'Intelligenza Artificiale estrarrà automaticamente tutti gli articoli e le quantità.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                    placeholder="es. BC04/2026/16957"
                    value={docForm.number}
                    onChange={e => setDocForm({ ...docForm, number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Documento *</label>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      {formatItalianDate(docForm.date) || 'GG/MM/AAAA'}
                    </span>
                  </div>
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
                    placeholder="es. SARDARES S.p.A."
                    value={docForm.supplier}
                    onChange={e => setDocForm({ ...docForm, supplier: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                    Totale Bolla (IVA Esclusa) (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={(docForm.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0) || docForm.parsedDocumentTotal || 0).toFixed(2)}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setDocForm({ ...docForm, parsedDocumentTotal: val, parsedImponibile: val });
                    }}
                    placeholder="Calculated from items"
                    className="w-full bg-amber-50/50 border border-amber-300 rounded-2xl p-3.5 text-xs font-black text-slate-900 outline-none focus:border-amber-500"
                  />
                  <span className="text-[9px] text-amber-700 font-semibold block">Calcolato sommando le voci materiali rilevate</span>
                </div>
              </div>

              {/* Breve Descrizione Riassuntiva dei Materiali */}
              <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Breve Descrizione Riassuntiva dei Materiali
                  </label>
                  <span className="text-[10px] text-slate-400">Generata automaticamente o modificabile</span>
                </div>
                <input
                  type="text"
                  value={docForm.summaryDescription || ''}
                  onChange={e => setDocForm({ ...docForm, summaryDescription: e.target.value })}
                  placeholder="Es. CEMENTO 32,5R 25kg (10 nr), SABBIA FINE LAVATA 0/2 (8 ql), GRANIGLIA 8-16 (7 ql)..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500"
                />
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
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" /> Totale Bolla (Somma Voci - IVA Esclusa)
                      </p>
                      <p className="text-3xl font-black text-white">
                        €{docForm.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    {docForm.items.length} voce/i materiali • Valore IVA esclusa calcolato sommando le singole voci rilevate
                    {docForm.destinationHint ? ` • Consegna: ${docForm.destinationHint}` : ''}
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
                  Fornitore: <span className="font-bold text-slate-800">{selectedDocDetails.supplier}</span> • Emesso il: <span className="font-bold text-slate-800">{formatItalianDate(selectedDocDetails.date)}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedDocDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Breve Descrizione Riassuntiva dei Materiali */}
            {(selectedDocDetails.summaryDescription || selectedDocDetails.items.length > 0) && (
              <div className="bg-amber-50/70 border border-amber-200 p-4 sm:p-5 rounded-3xl space-y-1.5">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Breve Descrizione Riassuntiva dei Materiali
                </p>
                <p className="text-xs sm:text-sm text-slate-800 font-semibold leading-relaxed">
                  {selectedDocDetails.summaryDescription || selectedDocDetails.items.map(i => `${i.materialeName} (${i.quantity} ${i.unit})`).join(', ')}
                </p>
              </div>
            )}

            {/* Note per il Capocantiere */}
            {selectedDocDetails.acceptanceNote && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-500" /> Nota di Accettazione per il Cantiere
                </p>
                <p className="text-xs text-slate-800 font-medium">{selectedDocDetails.acceptanceNote}</p>
              </div>
            )}

            {/* Spacchettamento Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Elenco Completo di Tutti i Materiali ({selectedDocDetails.items.length} voci)</span>
                <span className="text-[10px] text-slate-400 font-normal">Spacchettamento riga per riga</span>
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
            <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" /> Totale Bolla (Somma Voci - IVA Esclusa)
                </p>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-black text-white">
                    €{selectedDocDetails.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Valore IVA esclusa calcolato esattamente come somma delle voci materiali estratte</p>
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

      {/* MODAL 3: DOCUMENT PREVIEW MODAL */}
      {previewDocument && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[300] flex items-center justify-center p-2 sm:p-6" onClick={() => setPreviewDocument(null)}>
          <div 
            className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-500" />
                <div>
                  <h4 className="font-bold text-slate-900">{previewDocument.fileName || 'Documento Originale'}</h4>
                  <p className="text-[10px] text-slate-500">{previewDocument.supplier} - N. {previewDocument.number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewDocument.pdfDataUrl && (
                  <a
                    href={previewDocument.pdfDataUrl}
                    download={previewDocument.fileName || `Bolla_${previewDocument.number}.pdf`}
                    className="p-2 text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
                    title="Scarica documento"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewDocument(null)}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors"
                  title="Chiudi visualizzatore"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4">
              {previewDocument.pdfDataUrl ? (
                previewDocument.pdfDataUrl.startsWith('data:image/') ? (
                  <img src={previewDocument.pdfDataUrl} alt="Document Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-sm" />
                ) : (
                  <iframe 
                    src={`${previewDocument.pdfDataUrl}#toolbar=0`} 
                    className="w-full h-full rounded-xl shadow-sm border-0"
                    title="PDF Viewer"
                  />
                )
              ) : (
                <div className="text-center text-slate-400">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Nessun file allegato a questo documento</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
