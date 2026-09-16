import React, { useState, useRef } from 'react';
import { MaterialDocument, DocumentItem, Cantiere, Materiale, StockMovement, UserAccount } from '../types';
import { extractTextFromPdf, parseBollaOrFatturaText, ExtractedDocumentData } from '../utils/pdfExtractor';
import { compressPhoto } from '../utils/imageCompressor';
import { 
  FileText, Upload, Plus, Trash2, CheckCircle2, Clock, 
  Building2, Search, Filter, AlertCircle, Eye, Download, 
  ArrowRightLeft, Sparkles, Loader2, Send, ChevronDown, Check,
  X, ExternalLink, Info, Layers, Camera, Image as ImageIcon, RotateCw
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedNotice, setExtractedNotice] = useState<string | null>(null);
  const [uploadedPdfName, setUploadedPdfName] = useState<string | null>(null);
  const [uploadedPdfDataUrl, setUploadedPdfDataUrl] = useState<string | null>(null);
  const [showRawTextInput, setShowRawTextInput] = useState(false);
  const [rawTextInput, setRawTextInput] = useState('');

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

    const totalItemsPrice = mappedItems.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

    setDocForm(prev => ({
      ...prev,
      type: parsed.type,
      number: parsed.number,
      date: parsed.date,
      supplier: parsed.supplier,
      defaultDestination: matchedDestinationId,
      destinationHint: parsed.destinationCantiere,
      summaryDescription: parsed.summaryDescription || prev.summaryDescription,
      parsedDocumentTotal: parsed.totalAmount || totalItemsPrice,
      parsedImponibile: parsed.imponibile || totalItemsPrice,
      items: mappedItems.length > 0 ? mappedItems : prev.items,
    }));

    const destInfo = matchedDestinationName 
      ? ` Destinazione: "${matchedDestinationName}".` 
      : (parsed.destinationCantiere ? ` Destinazione rilevata: "${parsed.destinationCantiere}".` : '');

    setExtractedNotice(
      `${sourceLabel} analizzato con successo! Riconosciuti: Fornitore (${parsed.supplier}), ${parsed.type.toUpperCase()} N. ${parsed.number}, Data ${parsed.date}, ${mappedItems.length} voci materiali.${destInfo} Totale Bolla: €${(parsed.totalAmount || totalItemsPrice).toFixed(2)}.`
    );
  };

  // Handle PDF or Image (Photo/Scan) file selection & AI recognition
  const handleFileUpload = async (file: File) => {
    setIsExtracting(true);
    setExtractedNotice(null);
    setUploadedPdfName(file.name);
    setImageRotation(0);

    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp)$/i.test(file.name);

    try {
      if (isImage) {
        // High-clarity compression for AI Vision OCR and preview
        let compressedDataUrl: string;
        try {
          compressedDataUrl = await compressPhoto(file, {
            maxWidth: 2048,
            maxHeight: 2048,
            quality: 0.85,
            maxSizeBytes: 800 * 1024
          });
        } catch {
          // Fallback simple FileReader
          compressedDataUrl = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(file);
          });
        }

        setUploadedPdfDataUrl(compressedDataUrl);

        // Utilizziamo nuovamente l'Intelligenza Artificiale (Gemini) tramite il nostro server.
        // L'OCR locale senza AI (come Tesseract) produce solo testo confusionario e non riesce a "capire" le tabelle o i totali.
        const res = await fetch('/api/analyze-bolla', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compressedDataUrl,
            mimeType: 'image/jpeg',
            fileName: file.name,
          }),
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
            rawText: JSON.stringify(d),
            confidence: { supplier: true, number: true, date: true, totalAmount: true, items: true },
            items: mappedItems,
          };

          applyExtractedData(parsed, 'Foto / Scansione (con Gemini Vision AI)');
          if (d.notes) {
            setDocForm(prev => ({
              ...prev,
              acceptanceNote: d.notes,
            }));
          }
        } else {
          throw new Error(json.error || 'Analisi visiva non riuscita');
        }

      } else {
        // PDF file handling
        if (file.size < 2000000) {
          const reader = new FileReader();
          reader.onload = () => {
            setUploadedPdfDataUrl(reader.result as string);
          };
          reader.readAsDataURL(file);
        }

        const rawText = await extractTextFromPdf(file);
        if (rawText && rawText.trim().length > 40) {
          const parsed: ExtractedDocumentData = parseBollaOrFatturaText(rawText, file.name);
          applyExtractedData(parsed, 'File PDF (Lettura Testo)');
        } else {
          setExtractedNotice('Il PDF non contiene testo selezionabile (probabile scansione). Se possibile, carica o scatta direttamente la foto in JPG/PNG per l\'analisi visiva OCR.');
        }
      }
    } catch (err: any) {
      console.error('File recognition error:', err);
      setExtractedNotice(`Analisi automatica: ${err.message || 'parziale'}. Puoi verificare e completare i campi manualmente.`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Load sample DDT from real WhatsApp photo (Sardares N. 16804)
  const handleLoadSamplePhotoBolla = () => {
    setIsExtracting(true);
    setExtractedNotice(null);
    setUploadedPdfName('WhatsApp_Foto_DDT_Sardares_16804.jpeg');
    setImageRotation(0);

    setTimeout(() => {
      const sampleParsed: ExtractedDocumentData = {
        type: 'bolla',
        number: 'BC04 / 2026 / 16804',
        date: '2026-06-04',
        supplier: 'SARDARES S.p.A.',
        destinationCantiere: 'CANTIERE CUGNANA, PORTO ROTONDO',
        totalAmount: 132.08,
        imponibile: 132.08,
        summaryDescription: 'SABBIA FINE LAVATA 0/2 (16 ql), CEMENTO 32,5R 25kg (10 nr), INTOPREM N2X kg 25 (1 nr), CENUPREM FINO KG 25 (1 nr)',
        rawText: 'SARDARES SPA BC04/2026/16804 CANTIERE CUGNANA TOTAL 132.08',
        confidence: { supplier: true, number: true, date: true, totalAmount: true, items: true },
        items: [
          {
            materialeName: 'SABBIA FINE LAVATA 0/2',
            quantity: 16.0,
            unit: 'ql',
            unitPrice: 3.476,
            totalPrice: 55.62,
          },
          {
            materialeName: 'CEMENTO 32,5R 25kg',
            quantity: 10.0,
            unit: 'nr',
            unitPrice: 6.804,
            totalPrice: 68.04,
          },
          {
            materialeName: 'INTOPREM N2X kg 25 - 2CY',
            quantity: 1.0,
            unit: 'nr',
            unitPrice: 3.93,
            totalPrice: 3.93,
          },
          {
            materialeName: 'CENUPREM FINO KG 25',
            quantity: 1.0,
            unit: 'nr',
            unitPrice: 4.49,
            totalPrice: 4.49,
          }
        ]
      };
      applyExtractedData(sampleParsed, 'Foto DDT WhatsApp Sardares (Gemini Vision)');
      setDocForm(prev => ({
        ...prev,
        acceptanceNote: 'Ritiro merce ore 10:00 magazzino Olbia. Vettore MARIO. Documento firmato da conducente e destinatario.',
      }));
      setIsExtracting(false);
    }, 350);
  };

  // Handle direct text parse (e.g. pasted OCR text from Sardares or GP2)
  const handleDirectTextParse = () => {
    if (!rawTextInput.trim()) return;
    setIsExtracting(true);
    try {
      const parsed: ExtractedDocumentData = parseBollaOrFatturaText(rawTextInput);
      applyExtractedData(parsed, 'Testo incollato');
      setShowRawTextInput(false);
    } catch (err) {
      console.error('Text extraction error:', err);
      setExtractedNotice('Errore durante l\'analisi del testo.');
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

      const finalTotal = docForm.parsedDocumentTotal && docForm.parsedDocumentTotal > 0 
        ? docForm.parsedDocumentTotal 
        : totalAmount;

      const newDoc: MaterialDocument = {
        id: `doc-${Date.now()}`,
        number: docForm.number.trim(),
        date: docForm.date,
        supplier: docForm.supplier.trim(),
        type: docForm.type,
        totalAmount: finalTotal,
        imponibile: docForm.parsedImponibile || totalAmount,
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
      setRawTextInput('');
      setShowRawTextInput(false);
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Acquisizione Bolla:</span>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full">
                    Gemini Vision AI
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRawTextInput(false);
                      fileInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-500" />
                    <span>Carica Foto / PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scatta Foto Bolla</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRawTextInput(!showRawTextInput)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      showRawTextInput
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    Testo OCR
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadSamplePhotoBolla}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 flex items-center gap-1.5 transition-all shadow-sm"
                    title="Carica istantaneamente i dati estratti dalla foto della Bolla Sardares N. 16804"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Esempio Foto Sardares (N. 16804)</span>
                  </button>
                </div>
              </div>

              {/* Hidden file inputs for photo upload and direct mobile camera */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              {/* Paste Raw OCR Text Area */}
              {showRawTextInput && (
                <div className="bg-amber-50/50 border-2 border-dashed border-amber-300 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Incolla qui il testo della Bolla / DDT (es. Sardares, GP2)
                    </p>
                    <span className="text-[10px] text-slate-500">I dati principali e il totale vengono presi direttamente dal testo</span>
                  </div>
                  <textarea
                    rows={6}
                    value={rawTextInput}
                    onChange={e => setRawTextInput(e.target.value)}
                    placeholder="Incolla il testo del DDT o della fattura qui..."
                    className="w-full bg-white border border-amber-200 rounded-2xl p-3.5 text-xs font-mono outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRawTextInput(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleDirectTextParse}
                      disabled={isExtracting || !rawTextInput.trim()}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                    >
                      {isExtracting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>Estrai Dati e Totale dalla Bolla</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Drag & Drop Dropzone for Photo/Scan/PDF */}
              {!showRawTextInput && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/70 p-6 sm:p-7 rounded-3xl transition-all cursor-pointer text-center group relative overflow-hidden"
                >
                  {isExtracting ? (
                    <div className="flex flex-col items-center justify-center py-4 space-y-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
                        <Sparkles className="w-5 h-5 text-amber-600 absolute inset-0 m-auto" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">Analisi con Intelligenza Artificiale Visione (Gemini)...</p>
                      <p className="text-xs text-slate-600">
                        Lettura fornitore, n. documento, data, cantiere di destinazione, totale ufficiale e lista materiali...
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <ImageIcon className="w-6 h-6 text-amber-500" />
                        </div>
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Camera className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <FileText className="w-6 h-6 text-amber-700" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {uploadedPdfName ? `File selezionato: ${uploadedPdfName}` : 'Carica Foto da Smartphone (WhatsApp, JPG, PNG) o PDF della Bolla'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                          Puoi fotografare la bolla cartacea anche con ombre o ruotata: Gemini Vision legge fornitore, numero, data, totale esatto e tutti i materiali.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Photo Preview & Orientation Tool */}
              {uploadedPdfDataUrl && uploadedPdfDataUrl.startsWith('data:image') && (
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 bg-black rounded-xl overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                    <img
                      src={uploadedPdfDataUrl}
                      alt="Anteprima foto bolla"
                      className="max-h-full max-w-full object-contain transition-transform duration-300"
                      style={{ transform: `rotate(${imageRotation}deg)` }}
                    />
                  </div>
                  <div className="flex-1 space-y-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Foto Acquisita & Analizzata
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                        {uploadedPdfName || 'foto-bolla.jpg'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      I dati estratti sono stati inseriti automaticamente nei campi sottostanti. Puoi verificare e modificare qualsiasi valore.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageRotation(prev => (prev + 90) % 360);
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                      title="Ruota l'immagine di 90 gradi"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ruota ({imageRotation}°)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedPdfDataUrl(null);
                        setUploadedPdfName(null);
                      }}
                      className="p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-xl transition-colors border border-slate-700"
                      title="Rimuovi foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

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
                    placeholder="es. SARDARES S.p.A."
                    value={docForm.supplier}
                    onChange={e => setDocForm({ ...docForm, supplier: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                    Totale Bolla (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={docForm.parsedDocumentTotal !== undefined ? docForm.parsedDocumentTotal : ''}
                    onChange={e => setDocForm({ ...docForm, parsedDocumentTotal: parseFloat(e.target.value) || 0 })}
                    placeholder="Preso dalla bolla"
                    className="w-full bg-amber-50/50 border border-amber-300 rounded-2xl p-3.5 text-xs font-black text-slate-900 outline-none focus:border-amber-500"
                  />
                  <span className="text-[9px] text-slate-400 block">Valore preso dalla bolla (non ricalcolato)</span>
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
                        <Check className="w-3 h-3 text-emerald-400" /> Totale Bolla (Preso dal Documento)
                      </p>
                      <p className="text-3xl font-black text-white">
                        €{(docForm.parsedDocumentTotal !== undefined && docForm.parsedDocumentTotal > 0
                          ? docForm.parsedDocumentTotal
                          : docForm.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0)
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="pl-4 border-l border-slate-700">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Imponibile Somma Righe
                      </p>
                      <p className="text-xl font-bold text-amber-500">
                        €{docForm.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    {docForm.items.length} voce/i materiali • Valore ufficiale preso dalla bolla senza forzature
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
                  <Check className="w-3 h-3 text-emerald-400" /> Totale Bolla (Valore Ufficiale)
                </p>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-black text-white">
                    €{selectedDocDetails.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {selectedDocDetails.imponibile && selectedDocDetails.imponibile !== selectedDocDetails.totalAmount && (
                    <span className="text-xs text-slate-400">
                      (Imponibile: €{selectedDocDetails.imponibile.toFixed(2)})
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Dato preso direttamente dalla bolla senza ricalcolo arbitrario</p>
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
