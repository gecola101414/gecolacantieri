import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Sparkles, Upload, X, Check, RefreshCw, ZoomIn, ZoomOut, 
  Layers, Eye, Plus, Minus, FileText, CheckCircle2, AlertTriangle, 
  ShieldCheck, Scale, Ruler, Building2, Printer, Download, Info, 
  ChevronRight, Box, ArrowRight, Zap, Sliders, Crop, Sun, Contrast, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Cantiere, MaterialDocument, Materiale, UserAccount } from '../types';
import { 
  FascioneRilevato, 
  RiconoscimentoFerriResult, 
  PESI_LINEARI_FERRO, 
  DIAMETRI_DISPONIBILI, 
  LUNGHEZZE_DISPONIBILI,
  getPesoLineareFerro, 
  calcolaPesoFascione,
  generaBollaScaricoDaRilievo,
  generaMaterialiDaRilievo
} from '../utils/ferroUtils';
import { analyzeFerriInBrowser } from '../utils/browserFerroVision';
import { ImageAdjustmentPanel } from './ImageAdjustmentPanel';
import { ImageAdjustmentSettings, DEFAULT_ADJUSTMENTS } from '../utils/imageAdjustments';
import { APP_VERSION, APP_LAST_UPDATE } from '../version';

interface RiconoscimentoFerriModalProps {
  isOpen: boolean;
  onClose: () => void;
  cantieri: Cantiere[];
  currentUser: UserAccount;
  defaultCantiereId?: string;
  onSaveDocument?: (doc: MaterialDocument) => Promise<void>;
  onAddMateriale?: (m: Materiale) => Promise<void>;
  onSuccessNotice?: (msg: string) => void;
}

// Immagini demo sintetiche per test rapido
const DEMO_PHOTO_SINGLE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'><rect width='800' height='600' fill='%231e293b'/><circle cx='400' cy='300' r='180' fill='%230f172a' stroke='%23475569' stroke-width='4'/><g fill='%23e2e8f0' stroke='%2394a3b8' stroke-width='1.5'>" +
  Array.from({ length: 48 }).map((_, i) => {
    const angle = (i / 48) * Math.PI * 2 + (i % 3) * 0.2;
    const rad = 25 + (i % 5) * 28;
    const x = Math.round(400 + Math.cos(angle) * rad);
    const y = Math.round(300 + Math.sin(angle) * rad);
    return `<circle cx='${x}' cy='${y}' r='10'/><circle cx='${x}' cy='${y}' r='3' fill='%23ffffff'/>`;
  }).join('') +
  "</g><text x='400' y='540' font-family='sans-serif' font-size='16' font-weight='bold' fill='%23cbd5e1' text-anchor='middle'>FASCIONE SINGOLO TONDINI B450C Ø12 (TESTE DI TAGLIO LUCIDE)</text></svg>";

export const RiconoscimentoFerriModal: React.FC<RiconoscimentoFerriModalProps> = ({
  isOpen,
  onClose,
  cantieri,
  currentUser,
  defaultCantiereId,
  onSaveDocument,
  onAddMateriale,
  onSuccessNotice,
}) => {
  const [rawOriginalImage, setRawOriginalImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isImageCropped, setIsImageCropped] = useState<boolean>(false);
  const [currentAdjustments, setCurrentAdjustments] = useState<ImageAdjustmentSettings>(DEFAULT_ADJUSTMENTS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<'browser' | 'cloud'>('browser');
  const [sensitivity, setSensitivity] = useState<'bassa' | 'media' | 'alta'>('media');
  const [selectedCantiereId, setSelectedCantiereId] = useState<string>(
    defaultCantiereId || cantieri[0]?.id || ''
  );
  const [selectedDiameter, setSelectedDiameter] = useState<number | 'auto'>(12);
  const [barLength, setBarLength] = useState<number>(12);
  const [supplierName, setSupplierName] = useState<string>('Acciaieria Fornitrice Ferro B450C');
  const [unitPriceKg, setUnitPriceKg] = useState<number>(0.92);
  const [operatorNotes, setOperatorNotes] = useState<string>('');

  // Results State
  const [result, setResult] = useState<RiconoscimentoFerriResult | null>(null);
  const [activeTab, setActiveTab] = useState<'visione' | 'scheda'>('visione');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [activeFascioneId, setActiveFascioneId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultCantiereId) {
      setSelectedCantiereId(defaultCantiereId);
    } else if (cantieri.length > 0 && !selectedCantiereId) {
      setSelectedCantiereId(cantieri[0].id);
    }
  }, [defaultCantiereId, cantieri]);

  if (!isOpen) return null;

  const currentCantiere = cantieri.find(c => c.id === selectedCantiereId);

  // Helper: Automatic client-side compression for high-res smartphone photos (crucial for Vercel 4.5MB limit & speed)
  const compressImageForVision = (dataUrl: string, maxDimension = 1600, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      if (dataUrl.startsWith('data:image/svg') || dataUrl.length < 500 * 1024) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      setRawOriginalImage(dataUrl);
      setSelectedImage(dataUrl);
      setIsImageCropped(false);
      setCurrentAdjustments(DEFAULT_ADJUSTMENTS);
      setResult(null);
      setSavedSuccessMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleUseDemo = (demoImg: string, name: string) => {
    setRawOriginalImage(demoImg);
    setSelectedImage(demoImg);
    setSelectedFileName(name);
    setIsImageCropped(false);
    setCurrentAdjustments(DEFAULT_ADJUSTMENTS);
    setErrorMessage(null);
    setResult(null);
    setSavedSuccessMessage(null);
  };

  // Callback per applicazione modifiche da ImageAdjustmentPanel (contrasto o ritaglio fascione)
  const handleApplyAdjustedImage = (processedUrl: string, newSettings: ImageAdjustmentSettings, wasCropped = false) => {
    setSelectedImage(processedUrl);
    setCurrentAdjustments(newSettings);
    if (wasCropped) {
      setIsImageCropped(true);
    }
    setResult(null); // Reset del risultato per forzare nuovo conteggio sulla porzione ritagliata/ottimizzata
  };

  // Ripristino all'immagine originale non ritagliata
  const handleResetToOriginalImage = () => {
    if (rawOriginalImage) {
      setSelectedImage(rawOriginalImage);
      setIsImageCropped(false);
      setCurrentAdjustments(DEFAULT_ADJUSTMENTS);
      setResult(null);
    }
  };

  // Run Vision Analysis (Browser Deterministic Engine or Cloud AI)
  const handleRunAnalysis = async (overrideEngine?: 'browser' | 'cloud') => {
    if (!selectedImage) return;

    const currentEngine = overrideEngine || engineMode;
    setIsAnalyzing(true);
    setErrorMessage(null);

    // MODALITA' 1: Motore Locale nel Browser (100% Offline, Regole Geometriche, Simmetria Radiale)
    if (currentEngine === 'browser') {
      try {
        setAnalysisStep('Inizializzazione canvas e calcolo luminanza sezioni...');
        await new Promise(r => setTimeout(r, 60));
        setAnalysisStep('Scansione sezioni di taglio lucide e simmetria radiale (FRST)...');
        await new Promise(r => setTimeout(r, 100));
        setAnalysisStep('Clustering multi-fascione su ripiani e calcolo pesi...');

        const browserResult = await analyzeFerriInBrowser(selectedImage, {
          diametroSelezionato: selectedDiameter === 'auto' ? undefined : selectedDiameter,
          lunghezzaMetri: barLength,
          sensitivity,
          highlightThreshold: currentAdjustments.highlightThreshold,
          roundnessThreshold: 0.62,
          cantiereId: selectedCantiereId,
          cantiereName: currentCantiere?.name || 'Cantiere',
          operatore: currentUser.name,
        });

        setResult(browserResult);
        setActiveTab('visione');
      } catch (browserErr: any) {
        console.error('Browser vision error:', browserErr);
        setErrorMessage(browserErr?.message || 'Errore durante l\'analisi locale nel browser.');
      } finally {
        setIsAnalyzing(false);
        setAnalysisStep('');
      }
      return;
    }

    // MODALITA' 2: Visione Multimodale Cloud (Google Gemini)
    setAnalysisStep('Ottimizzazione immagine e compressione payload...');

    try {
      // 1. Client-side compression to stay well below Vercel's 4.5MB limit and ensure sub-second upload
      const optimizedImage = await compressImageForVision(selectedImage, 1600, 0.82);

      setAnalysisStep('Segmentazione immagine e individuazione fascioni...');

      // Step simulator for realistic UX
      const timer1 = setTimeout(() => {
        setAnalysisStep('Rilevamento contrasto teste di taglio lucide...');
      }, 1200);

      const timer2 = setTimeout(() => {
        setAnalysisStep('Conteggio puntuale delle barre e calcolo pesi...');
      }, 2500);

      const response = await fetch('/api/analyze-ferri', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: optimizedImage,
          mimeType: 'image/jpeg',
          diametroSelezionato: selectedDiameter === 'auto' ? undefined : selectedDiameter,
          lunghezzaMetri: barLength,
          cantiereName: currentCantiere?.name || '',
          noteOperatore: operatorNotes,
        }),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!response.ok) {
        let serverErr = '';
        try {
          const errorData = await response.json();
          serverErr = errorData.error || errorData.message || '';
        } catch {
          if (response.status === 413) {
            serverErr = 'Payload immagine troppo pesante per il server (limite 4.5MB).';
          } else if (response.status === 504) {
            serverErr = 'Timeout di risposta del server (504 Gateway Timeout).';
          } else if (response.status === 404) {
            serverErr = 'Endpoint /api/analyze-ferri non raggiungibile (HTTP 404).';
          } else {
            serverErr = `Errore HTTP ${response.status}: risposta del server non valida.`;
          }
        }
        throw new Error(serverErr || `Errore HTTP ${response.status} durante l'elaborazione.`);
      }

      const resJson = await response.json();
      if (!resJson.success || !resJson.data) {
        throw new Error(resJson.error || 'Risultato analisi non valido ricevuto dal server.');
      }

      const parsed: RiconoscimentoFerriResult = {
        ...resJson.data,
        cantiereId: selectedCantiereId,
        cantiereName: currentCantiere?.name || 'Cantiere',
        dataRilievo: new Date().toISOString(),
        operatore: currentUser.name,
        imageUrl: selectedImage,
      };

      setResult(parsed);
      setActiveTab('visione');
    } catch (err: any) {
      console.error('Vision analysis error:', err);
      const msg = err?.message || 'Errore durante l\'elaborazione dell\'immagine con il modello di visione.';
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Adjust bar count for a bundle (+1 or -1)
  const handleUpdateFascioneQty = (fascioneId: string, delta: number) => {
    if (!result) return;

    const updatedFascioni = result.fascioni.map(f => {
      if (f.id_fascione === fascioneId) {
        const newQty = Math.max(0, f.quantita_barre + delta);
        const newWeight = calcolaPesoFascione(newQty, f.diametro_mm, result.lunghezza_barre_metri);
        return {
          ...f,
          quantita_barre: newQty,
          peso_stimato_kg: newWeight,
        };
      }
      return f;
    });

    const newTotaleFerri = updatedFascioni.reduce((sum, f) => sum + f.quantita_barre, 0);
    const newTotalePeso = updatedFascioni.reduce((sum, f) => sum + f.peso_stimato_kg, 0);

    setResult({
      ...result,
      fascioni: updatedFascioni,
      totale_ferri: newTotaleFerri,
      peso_totale_kg: Math.round(newTotalePeso * 100) / 100,
    });
  };

  // Change diameter for a specific bundle
  const handleUpdateFascioneDiameter = (fascioneId: string, newDiam: number) => {
    if (!result) return;

    const updatedFascioni = result.fascioni.map(f => {
      if (f.id_fascione === fascioneId) {
        const newWeight = calcolaPesoFascione(f.quantita_barre, newDiam, result.lunghezza_barre_metri);
        return {
          ...f,
          diametro_mm: newDiam,
          peso_stimato_kg: newWeight,
        };
      }
      return f;
    });

    const newTotalePeso = updatedFascioni.reduce((sum, f) => sum + f.peso_stimato_kg, 0);

    setResult({
      ...result,
      fascioni: updatedFascioni,
      peso_totale_kg: Math.round(newTotalePeso * 100) / 100,
    });
  };

  // Click on image to add a point manually
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!result || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Add point to the active bundle or smart-detect which bundle bounding box contains the click
    let targetFascione = activeFascioneId 
      ? result.fascioni.find(f => f.id_fascione === activeFascioneId)
      : null;

    if (!targetFascione) {
      targetFascione = result.fascioni.find(f => {
        if (!f.box_percentuale) return false;
        const b = f.box_percentuale;
        return clickX >= b.x && clickX <= b.x + b.width && clickY >= b.y && clickY <= b.y + b.height;
      }) || result.fascioni[0];
    }

    if (!targetFascione) return;

    const updatedPoints = [...(targetFascione.coordinate_punti || []), { x: Math.round(clickX * 10) / 10, y: Math.round(clickY * 10) / 10 }];
    const newQty = targetFascione.quantita_barre + 1;
    const newWeight = calcolaPesoFascione(newQty, targetFascione.diametro_mm, result.lunghezza_barre_metri);

    const updatedFascioni = result.fascioni.map(f => {
      if (f.id_fascione === targetFascione.id_fascione) {
        return {
          ...f,
          quantita_barre: newQty,
          peso_stimato_kg: newWeight,
          coordinate_punti: updatedPoints,
        };
      }
      return f;
    });

    const newTotaleFerri = updatedFascioni.reduce((sum, f) => sum + f.quantita_barre, 0);
    const newTotalePeso = updatedFascioni.reduce((sum, f) => sum + f.peso_stimato_kg, 0);

    setResult({
      ...result,
      fascioni: updatedFascioni,
      totale_ferri: newTotaleFerri,
      peso_totale_kg: Math.round(newTotalePeso * 100) / 100,
    });
  };

  // Remove a point
  const handleRemovePoint = (fascioneId: string, pointIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!result) return;

    const updatedFascioni = result.fascioni.map(f => {
      if (f.id_fascione === fascioneId && f.coordinate_punti) {
        const newPoints = f.coordinate_punti.filter((_, idx) => idx !== pointIndex);
        const newQty = Math.max(0, f.quantita_barre - 1);
        const newWeight = calcolaPesoFascione(newQty, f.diametro_mm, result.lunghezza_barre_metri);
        return {
          ...f,
          quantita_barre: newQty,
          peso_stimato_kg: newWeight,
          coordinate_punti: newPoints,
        };
      }
      return f;
    });

    const newTotaleFerri = updatedFascioni.reduce((sum, f) => sum + f.quantita_barre, 0);
    const newTotalePeso = updatedFascioni.reduce((sum, f) => sum + f.peso_stimato_kg, 0);

    setResult({
      ...result,
      fascioni: updatedFascioni,
      totale_ferri: newTotaleFerri,
      peso_totale_kg: Math.round(newTotalePeso * 100) / 100,
    });
  };

  // Generate & Save Bolla di Scarico
  const handleSaveBolla = async () => {
    if (!result || !onSaveDocument) return;

    setIsSaving(true);
    try {
      const bolla = generaBollaScaricoDaRilievo(
        result,
        currentUser,
        selectedCantiereId,
        currentCantiere?.name || 'Cantiere',
        supplierName,
        unitPriceKg
      );

      await onSaveDocument(bolla);
      setSavedSuccessMessage(`Bolla di Scarico "${bolla.number}" registrata con successo nel cantiere!`);
      if (onSuccessNotice) {
        onSuccessNotice(`Bolla di Scarico ${bolla.number} creata e associata a ${currentCantiere?.name || 'Cantiere'}`);
      }
    } catch (err: any) {
      alert(`Errore nel salvataggio della bolla: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Update Inventory Giacenze directly
  const handleUpdateInventory = async () => {
    if (!result || !onAddMateriale) return;

    setIsSaving(true);
    try {
      const materialiGenerati = generaMaterialiDaRilievo(result, selectedCantiereId);
      for (const mat of materialiGenerati) {
        await onAddMateriale(mat);
      }
      setSavedSuccessMessage(`Giacenze inventario aggiornate: ${result.peso_totale_kg.toLocaleString()} kg di ferro caricati nel cantiere!`);
      if (onSuccessNotice) {
        onSuccessNotice(`Inventario aggiornato con ${materialiGenerati.length} diametri di ferro B450C.`);
      }
    } catch (err: any) {
      alert(`Errore nell'aggiornamento dell'inventario: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl text-white shadow-2xl flex flex-col max-h-[94vh] overflow-hidden relative"
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                  Riconoscimento Ferri da Foto
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-black uppercase">
                  Vision AI 2026
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden md:inline">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Conteggio automatico teste di taglio barre, segmentazione fascioni e stima peso cantiere
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Chiudi"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Banner */}
        {savedSuccessMessage && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/30 p-3 px-6 text-xs text-emerald-400 font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{savedSuccessMessage}</span>
            </div>
            <button onClick={() => setSavedSuccessMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* STEP 1: Upload / Input Configuration Section */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-3xl p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Photo Input Area (Left - 5 Cols) */}
              <div className="lg:col-span-5 space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-400" />
                  1. Fotografia Frontale Fascioni di Ferro
                </label>

                {/* Dropzone / Preview */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] overflow-hidden ${
                    selectedImage 
                      ? 'border-amber-500/60 bg-slate-900' 
                      : 'border-slate-700 hover:border-amber-500/50 bg-slate-900/40 hover:bg-slate-900/80'
                  }`}
                >
                  {selectedImage ? (
                    <div className="relative w-full h-44 flex items-center justify-center overflow-hidden rounded-xl bg-black">
                      <img 
                        src={selectedImage} 
                        alt="Foto ferro da analizzare" 
                        className="max-h-full max-w-full object-contain"
                      />
                      {isImageCropped && (
                        <div className="absolute top-2 left-2 bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 shadow">
                          <Crop className="w-3 h-3" /> Fascione Ritagliato
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                        <Check className="w-3 h-3" /> Foto Pronta
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200">Trascina o clicca per caricare</p>
                        <p className="text-xs text-slate-400 mt-1">Inquadra frontalmente le teste lucide delle barre</p>
                      </div>
                    </div>
                  )}

                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden" 
                  />

                  <input 
                    type="file" 
                    ref={cameraInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    capture="environment"
                    className="hidden" 
                  />
                </div>

                {/* Direct Camera Button & Demo Buttons */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-amber-400" /> Scatta con Fotocamera
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseDemo(DEMO_PHOTO_SINGLE, 'demo_fascione_b450c.png')}
                    className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 cursor-pointer"
                    title="Usa una foto di test precaricata per provare subito l'algoritmo"
                  >
                    Usa Foto Test
                  </button>
                </div>

                {/* STRUMENTI PRE-ELABORAZIONE FOTO: RITAGLIO FASCIONE (CROP) & REGOLAZIONE CONTRASTO */}
                {selectedImage && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-2">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      Ottimizzazione Foto (Ritaglia & Contrasta Parti Lucenti)
                    </label>
                    <ImageAdjustmentPanel
                      originalImage={rawOriginalImage || selectedImage}
                      activeImage={selectedImage}
                      onApplyImage={handleApplyAdjustedImage}
                      onResetToOriginal={handleResetToOriginalImage}
                      isImageCropped={isImageCropped}
                    />
                  </div>
                )}
              </div>

              {/* Technical Configuration (Right - 7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-amber-400" />
                  2. Parametri Tecnici & Destinazione Cantiere
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cantiere Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Cantiere di Scarico</label>
                    <select
                      value={selectedCantiereId}
                      onChange={e => setSelectedCantiereId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-bold"
                    >
                      {cantieri.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code || 'Cantiere'})</option>
                      ))}
                    </select>
                  </div>

                  {/* Diameter Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Diametro Barre (Ø mm)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedDiameter}
                        onChange={e => setSelectedDiameter(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="auto">Rileva Automaticamente da AI</option>
                        {DIAMETRI_DISPONIBILI.map(d => (
                          <option key={d} value={d}>
                            Ø {d} mm ({PESI_LINEARI_FERRO[d]} kg/m)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Bar Length */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Lunghezza Nominale Barre
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {LUNGHEZZE_DISPONIBILI.map(len => (
                        <button
                          key={len}
                          type="button"
                          onClick={() => setBarLength(len)}
                          className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            barLength === len
                              ? 'bg-amber-500 text-slate-950 shadow-md'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {len} Metri
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Unit price for Bolla estimation */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Prezzo Medio al Kg (€/kg)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={unitPriceKg}
                        onChange={e => setUnitPriceKg(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Supplier & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Acciaieria / Fornitore</label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={e => setSupplierName(e.target.value)}
                      placeholder="es. Feralpi / Alfa Acciai / Pittini"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Note Rilievo / Segni Particolari</label>
                    <input
                      type="text"
                      value={operatorNotes}
                      onChange={e => setOperatorNotes(e.target.value)}
                      placeholder="es. Fascione superiore lievemente ossidato"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Engine Selector: Browser (Rule-based / Local) vs Cloud (Gemini) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      Motore di Visione Computazionale
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                      {engineMode === 'browser' ? '⚡ 100% Offline nel Browser' : '🤖 Cloud Gemini'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEngineMode('browser');
                        setErrorMessage(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        engineMode === 'browser'
                          ? 'bg-amber-500/15 border-amber-500/70 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className={engineMode === 'browser' ? 'text-amber-300' : 'text-slate-300'}>
                          Motore Locale Browser (A Regole)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Riconoscimento deterministico tramite contrasto teste di taglio metalliche e simmetria radiale (FRST). <strong>Zero API Key, immediato su Vercel e smartphone</strong>.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEngineMode('cloud');
                        setErrorMessage(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        engineMode === 'cloud'
                          ? 'bg-amber-500/15 border-amber-500/70 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className={engineMode === 'cloud' ? 'text-amber-300' : 'text-slate-300'}>
                          Visione Multimodale AI Cloud
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Analisi neurale con Google Gemini Flash. Richiede configurazione di GEMINI_API_KEY nel backend del server.
                      </p>
                    </button>
                  </div>

                  {/* Sensitivity controls for browser rule-based engine */}
                  {engineMode === 'browser' && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        Sensibilità rilevamento barre:
                      </span>
                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                        {(['bassa', 'media', 'alta'] as const).map(sens => (
                          <button
                            key={sens}
                            type="button"
                            onClick={() => setSensitivity(sens)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                              sensitivity === sens
                                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {sens} {sens === 'media' && '(Consigliata)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Diagnostic & Error Alert */}
                {errorMessage && (
                  <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1.5 text-xs flex-1">
                        <p className="font-black text-red-300">
                          Impossibile completare l'analisi con Visione AI Cloud:
                        </p>
                        <p className="text-slate-300 font-mono text-[11px] bg-slate-950/70 p-2 rounded-lg border border-red-500/20 break-all">
                          {errorMessage}
                        </p>

                        <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                          💡 <strong>Soluzione Immediata:</strong> Puoi usare il <strong>Motore Locale nel Browser</strong> che funziona al 100% offline direttamente sul tuo dispositivo senza alcuna chiave API o limite serverless!
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEngineMode('browser');
                          handleRunAnalysis('browser');
                        }}
                        disabled={isAnalyzing}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                      >
                        <Zap className="w-3.5 h-3.5" /> Esegui Subito con Motore Locale Browser
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const fallbackDiam = typeof selectedDiameter === 'number' ? selectedDiameter : 12;
                          const count = 50;
                          const peso = calcolaPesoFascione(count, fallbackDiam, barLength);
                          setResult({
                            totale_ferri: count,
                            numero_fascioni: 1,
                            peso_totale_kg: peso,
                            lunghezza_barre_metri: barLength,
                            fascioni: [
                              {
                                id_fascione: 'Fascione 1',
                                posizione: 'Fascione verificato manualmente',
                                quantita_barre: count,
                                diametro_mm: fallbackDiam,
                                peso_stimato_kg: peso,
                                livello_confidenza: 'alta',
                                coordinate_punti: [],
                              }
                            ],
                            qualita_foto: { illuminazione: 'buona', note: 'Inserimento manuale operatore di cantiere' },
                            sintesi_tecnica: `Rilievo manuale cantiere: 1 fascione tondi B450C Ø${fallbackDiam}mm (${count} barre, ${peso} kg).`,
                            cantiereId: selectedCantiereId,
                            cantiereName: currentCantiere?.name || 'Cantiere',
                            dataRilievo: new Date().toISOString(),
                            operatore: currentUser.name,
                            imageUrl: selectedImage || undefined,
                          });
                          setActiveTab('visione');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs border border-slate-700 transition-all cursor-pointer"
                      >
                        Compila Manualmente
                      </button>
                      <button
                        type="button"
                        onClick={() => setErrorMessage(null)}
                        className="text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded-xl text-xs transition-all cursor-pointer ml-auto"
                      >
                        Chiudi
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Submit Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!selectedImage || isAnalyzing}
                    onClick={() => handleRunAnalysis()}
                    className={`w-full py-3.5 px-6 rounded-2xl font-black text-xs flex items-center justify-center gap-2.5 transition-all shadow-xl cursor-pointer ${
                      !selectedImage || isAnalyzing
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20 hover:scale-[1.01]'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>{analysisStep || 'Analisi Visione Computazionale in corso...'}</span>
                      </>
                    ) : engineMode === 'browser' ? (
                      <>
                        <Zap className="w-4 h-4 text-slate-950" />
                        <span>Esegui Conteggio Ferri con Motore Locale Browser (Offline)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        <span>Esegui Conteggio Ferri con Visione AI Cloud (Gemini)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: RESULTS SECTION (If Result Available) */}
          {result && (
            <div className="space-y-6">
              {/* Summary KPIs Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Totale Barre Contate</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl sm:text-4xl font-black font-mono text-white">{result.totale_ferri}</p>
                    <span className="text-xs font-bold text-slate-400">barre</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Teste di taglio rilevate</p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fascioni Segmentati</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl sm:text-4xl font-black font-mono text-amber-300">{result.numero_fascioni}</p>
                    <span className="text-xs font-bold text-slate-400">lotti</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Gruppi distinti</p>
                </div>

                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Peso Totale Stimato</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl sm:text-4xl font-black font-mono text-emerald-300">
                      {result.peso_totale_kg.toLocaleString()}
                    </p>
                    <span className="text-xs font-bold text-slate-400">kg</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    ca. {(result.peso_totale_kg / 1000).toFixed(2)} t (L={result.lunghezza_barre_metri}m)
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qualità Rilievo</span>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-black text-white capitalize">
                      {result.qualita_foto?.illuminazione || 'Buona'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1" title={result.qualita_foto?.note}>
                    {result.qualita_foto?.note || 'Ottima leggibilità'}
                  </p>
                </div>
              </div>

              {/* Sub-Navigation: Vision View vs Technical Discharge Sheet */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('visione')}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'visione'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Verifica Visiva & Punti Conteggio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('scheda')}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'scheda'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Scheda di Scarico & Destinazione Cantiere</span>
                </button>
              </div>

              {/* TAB 1: VISUAL OVERLAY & CANVAS INTERACTION */}
              {activeTab === 'visione' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Visual Canvas (Left - 7 Cols) */}
                  <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-3xl p-4 flex flex-col">
                    <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-300">Rilevamento Teste di Taglio</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                          Clicca per aggiungere (+1) o rimuovere un punto
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.25))}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                          title="Ingrandisci"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.25))}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                          title="Riduci"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCoordinates(prev => !prev)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            showCoordinates
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {showCoordinates ? 'Nascondi Punti' : 'Mostra Punti'}
                        </button>
                      </div>
                    </div>

                    {/* Quick Tuning Toolbar */}
                    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-900 text-[11px] flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Motore attivo:</span>
                        <span className="font-bold text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {engineMode === 'browser' ? <Zap className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                          {engineMode === 'browser' ? 'Locale Browser (Regole Geometriche)' : 'Visione Cloud Gemini'}
                        </span>
                      </div>

                      {engineMode === 'browser' && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-slate-400 text-[10px]">Ricalcola con sensibilità:</span>
                          {(['bassa', 'media', 'alta'] as const).map(sens => (
                            <button
                              key={sens}
                              type="button"
                              onClick={() => {
                                setSensitivity(sens);
                                handleRunAnalysis('browser');
                              }}
                              disabled={isAnalyzing}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                sensitivity === sens
                                  ? 'bg-amber-500 text-slate-950 shadow'
                                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                              }`}
                            >
                              {sens}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Canvas Container with Overlays */}
                    <div className="relative w-full overflow-auto rounded-2xl bg-black flex items-center justify-center min-h-[340px] max-h-[500px]">
                      <div 
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        className="relative cursor-crosshair select-none transition-transform duration-200"
                        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                      >
                        {selectedImage && (
                          <img
                            src={selectedImage}
                            alt="Fascioni di ferro analizzati"
                            className="max-h-[460px] w-auto object-contain block pointer-events-none"
                          />
                        )}

                        {/* Fascione Bounding Boxes */}
                        {showCoordinates && result.fascioni.map((f, fIdx) => {
                          if (!f.box_percentuale) return null;
                          const isFocused = !activeFascioneId || activeFascioneId === f.id_fascione;
                          return (
                            <div
                              key={`box-${fIdx}`}
                              style={{
                                left: `${f.box_percentuale.x}%`,
                                top: `${f.box_percentuale.y}%`,
                                width: `${f.box_percentuale.width}%`,
                                height: `${f.box_percentuale.height}%`,
                              }}
                              className={`absolute border-2 rounded-xl transition-all pointer-events-none ${
                                isFocused 
                                  ? 'border-amber-400/90 bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.3)]' 
                                  : 'border-slate-600/40 opacity-40'
                              }`}
                            >
                              <span className="absolute -top-6 left-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow">
                                {f.id_fascione}: {f.quantita_barre} barre
                              </span>
                            </div>
                          );
                        })}

                        {/* Cut-Head Detected Points */}
                        {showCoordinates && result.fascioni.map((f) => {
                          const isFocused = !activeFascioneId || activeFascioneId === f.id_fascione;
                          if (!isFocused) return null;

                          return (f.coordinate_punti || []).map((pt, pIdx) => (
                            <div
                              key={`pt-${f.id_fascione}-${pIdx}`}
                              onClick={(e) => handleRemovePoint(f.id_fascione, pIdx, e)}
                              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                              className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/80 hover:bg-rose-500 border border-white flex items-center justify-center text-[7px] font-black text-slate-950 cursor-pointer shadow-[0_0_8px_rgba(52,211,153,0.9)] hover:scale-125 transition-transform"
                              title={`Barra ${pIdx + 1} (${f.id_fascione}) - Clicca per rimuovere`}
                            >
                              <span className="w-1.5 h-1.5 bg-white rounded-full pointer-events-none" />
                            </div>
                          ));
                        })}
                      </div>
                    </div>

                    <div className="pt-3 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>💡 <strong>Suggerimento operatore:</strong> Se alcune barre in ombra non sono state catturate, clicca direttamente sopra l'immagine per aggiungerle (+1).</span>
                    </div>
                  </div>

                  {/* Bundles Detail List (Right - 5 Cols) */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400" />
                        Dettaglio Fascioni Rilevati ({result.fascioni.length})
                      </span>
                      {activeFascioneId && (
                        <button
                          type="button"
                          onClick={() => setActiveFascioneId(null)}
                          className="text-[10px] font-bold text-amber-400 hover:underline"
                        >
                          Mostra Tutti
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {result.fascioni.map((f, idx) => {
                        const isSelected = activeFascioneId === f.id_fascione;
                        return (
                          <div
                            key={f.id_fascione || idx}
                            onClick={() => setActiveFascioneId(isSelected ? null : f.id_fascione)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/60 shadow-md'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm text-white">{f.id_fascione}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    f.livello_confidenza === 'alta'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : f.livello_confidenza === 'media'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}>
                                    Confidenza {f.livello_confidenza}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{f.posizione}</p>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-black font-mono text-emerald-400">
                                  {f.peso_stimato_kg.toLocaleString()} kg
                                </span>
                                <p className="text-[9px] text-slate-500">L={result.lunghezza_barre_metri}m</p>
                              </div>
                            </div>

                            {/* Quantity & Diameter Adjusters */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                              {/* Quantity Stepper */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Barre Contate</label>
                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateFascioneQty(f.id_fascione, -1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="flex-1 text-center font-black font-mono text-sm text-amber-300">
                                    {f.quantita_barre}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateFascioneQty(f.id_fascione, +1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Diameter Dropdown per Bundle */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Diametro (Ø mm)</label>
                                <select
                                  value={f.diametro_mm}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => handleUpdateFascioneDiameter(f.id_fascione, Number(e.target.value))}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500 font-bold"
                                >
                                  {DIAMETRI_DISPONIBILI.map(d => (
                                    <option key={d} value={d}>Ø {d} mm</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: OFFICIAL CONSTRUCTION DISCHARGE SHEET (SCHEDA DI SCARICO) */}
              {activeTab === 'scheda' && (
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
                  {/* Printable Construction Document Card */}
                  <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200">
                    {/* Header Sheet */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-900 text-white font-black px-2 py-0.5 rounded text-xs uppercase tracking-wider">
                            Verbale di Cantiere
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-500">UNI EN 10080</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                          SCHEDA DI SCARICO & COLLAUDO FERRO D'ARMATURA
                        </h2>
                        <p className="text-xs text-slate-600 font-medium">
                          Riconoscimento fotografico computerizzato teste di taglio tondi B450C
                        </p>
                      </div>

                      <div className="text-left sm:text-right text-xs space-y-0.5">
                        <p className="font-mono font-bold text-slate-700">Data: {new Date().toLocaleDateString('it-IT')}</p>
                        <p className="font-mono text-slate-500">Ora: {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="font-bold text-amber-600">ID Rilievo: FE-{Date.now().toString().slice(-6)}</p>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400">Cantiere Destinatario</span>
                        <p className="font-black text-slate-900 text-sm">{currentCantiere?.name || 'Cantiere'}</p>
                        <p className="text-slate-500 text-[11px]">{currentCantiere?.address || 'Destinazione Principale'}</p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400">Fornitore / Acciaieria</span>
                        <p className="font-black text-slate-900 text-sm">{supplierName}</p>
                        <p className="text-slate-500 text-[11px]">Acciaio saldabile B450C</p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400">Operatore Rilevatore</span>
                        <p className="font-black text-slate-900 text-sm">{currentUser.name}</p>
                        <p className="text-slate-500 text-[11px]">Ruolo: {currentUser.role.replace('_', ' ').toUpperCase()}</p>
                      </div>
                    </div>

                    {/* Table of Rebar Bundles */}
                    <div className="overflow-x-auto my-6">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b-2 border-slate-300 text-[10px] font-black uppercase text-slate-500">
                            <th className="py-2.5 px-3">Fascione</th>
                            <th className="py-2.5 px-3">Posizione / Settore</th>
                            <th className="py-2.5 px-3 text-center">Diametro</th>
                            <th className="py-2.5 px-3 text-center">Lunghezza</th>
                            <th className="py-2.5 px-3 text-right">Barre Contate</th>
                            <th className="py-2.5 px-3 text-right">Peso Unit. (kg/m)</th>
                            <th className="py-2.5 px-3 text-right">Peso Totale (kg)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {result.fascioni.map((f, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 font-medium">
                              <td className="py-3 px-3 font-black text-slate-900">{f.id_fascione}</td>
                              <td className="py-3 px-3 text-slate-600">{f.posizione}</td>
                              <td className="py-3 px-3 text-center font-bold text-amber-700">Ø {f.diametro_mm} mm</td>
                              <td className="py-3 px-3 text-center font-mono">{result.lunghezza_barre_metri} m</td>
                              <td className="py-3 px-3 text-right font-black font-mono text-slate-900">{f.quantita_barre}</td>
                              <td className="py-3 px-3 text-right font-mono text-slate-600">{getPesoLineareFerro(f.diametro_mm)}</td>
                              <td className="py-3 px-3 text-right font-black font-mono text-slate-900">{f.peso_stimato_kg.toLocaleString()} kg</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-900 bg-slate-50 font-black text-xs">
                            <td colSpan={4} className="py-3 px-3 text-slate-900 uppercase">TOTALE CARICO FERRO</td>
                            <td className="py-3 px-3 text-right font-mono text-amber-700 text-sm">{result.totale_ferri} barre</td>
                            <td className="py-3 px-3 text-right text-slate-500">—</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-900 text-sm">{result.peso_totale_kg.toLocaleString()} kg</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Summary Technical Notes & Signatures */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Esito Visione AI & Note Tecniche</span>
                        <p className="text-slate-700 font-medium">
                          {result.sintesi_tecnica || `Scarico verificato con ${result.totale_ferri} barre totali suddivise in ${result.numero_fascioni} fascioni. Calcolo effettuato con peso nominale teorico.`}
                        </p>
                        {operatorNotes && (
                          <p className="text-slate-500 italic mt-1">Note operatore: "{operatorNotes}"</p>
                        )}
                      </div>

                      <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Firma Capocantiere / Ricevente</span>
                        <div className="border-b border-slate-400 w-48 mt-8"></div>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{currentUser.name} • {new Date().toLocaleDateString('it-IT')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>Stampa Scheda PDF</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleUpdateInventory}
                      className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                    >
                      <Box className="w-4 h-4 text-emerald-400" />
                      <span>Carica Direttamente in Giacenza</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveBolla}
                      className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Salva come Bolla / DDT di Scarico</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4 shrink-0 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-slate-300">Modulo Visione Ferri B450C attivo</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
