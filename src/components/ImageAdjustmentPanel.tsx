import React, { useState, useRef, useEffect } from 'react';
import { 
  Crop, Sun, Contrast, Sliders, RotateCcw, Check, X, Eye, 
  Sparkles, Maximize2, ShieldCheck, Zap
} from 'lucide-react';
import { 
  ImageAdjustmentSettings, 
  CropRectangle, 
  DEFAULT_ADJUSTMENTS, 
  processImageWithAdjustments 
} from '../utils/imageAdjustments';

interface ImageAdjustmentPanelProps {
  originalImage: string;
  activeImage: string;
  onApplyImage: (processedDataUrl: string, settings: ImageAdjustmentSettings, wasCropped?: boolean) => void;
  onResetToOriginal: () => void;
  isImageCropped: boolean;
}

export const ImageAdjustmentPanel: React.FC<ImageAdjustmentPanelProps> = ({
  originalImage,
  activeImage,
  onApplyImage,
  onResetToOriginal,
  isImageCropped,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'contrasto' | 'ritaglio'>('contrasto');
  const [settings, setSettings] = useState<ImageAdjustmentSettings>(DEFAULT_ADJUSTMENTS);
  const [cropBox, setCropBox] = useState<CropRectangle>({ x: 15, y: 15, width: 70, height: 70 });
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; box: CropRectangle }>({
    mouseX: 0,
    mouseY: 0,
    box: { x: 15, y: 15, width: 70, height: 70 },
  });
  const [previewUrl, setPreviewUrl] = useState<string>(activeImage);
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Aggiorna la preview quando cambiano i filtri
  useEffect(() => {
    let isMounted = true;
    const updatePreview = async () => {
      try {
        setIsProcessing(true);
        const processed = await processImageWithAdjustments(
          activeMode === 'ritaglio' ? originalImage : activeImage,
          settings,
          null
        );
        if (isMounted) {
          setPreviewUrl(processed);
        }
      } catch (err) {
        console.error('Errore anteprima contrasto:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    const timeout = setTimeout(updatePreview, 60);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [settings, activeImage, originalImage, activeMode]);

  // Presets di ritaglio per inquadrare rapidamente i fascioni
  const handleApplyPresetCrop = (preset: 'tutto' | 'centro' | 'superiore' | 'inferiore' | 'sinistra' | 'destra') => {
    switch (preset) {
      case 'tutto':
        setCropBox({ x: 0, y: 0, width: 100, height: 100 });
        break;
      case 'centro':
        setCropBox({ x: 20, y: 15, width: 60, height: 70 });
        break;
      case 'superiore':
        setCropBox({ x: 5, y: 5, width: 90, height: 45 });
        break;
      case 'inferiore':
        setCropBox({ x: 5, y: 50, width: 90, height: 45 });
        break;
      case 'sinistra':
        setCropBox({ x: 5, y: 10, width: 45, height: 80 });
        break;
      case 'destra':
        setCropBox({ x: 50, y: 10, width: 45, height: 80 });
        break;
    }
  };

  // Presets di contrasto per teste metalliche
  const handleApplyContrastPreset = (preset: 'neutro' | 'metallo_lucido' | 'ombra_ruggine' | 'alto_stacco') => {
    switch (preset) {
      case 'neutro':
        setSettings({
          contrast: 1.0,
          brightness: 0,
          highlightThreshold: 100,
          isolateHighlights: false,
          showMask: false,
        });
        break;
      case 'metallo_lucido':
        setSettings({
          contrast: 1.8,
          brightness: 5,
          highlightThreshold: 125,
          isolateHighlights: true,
          showMask: false,
        });
        break;
      case 'ombra_ruggine':
        setSettings({
          contrast: 1.4,
          brightness: 15,
          highlightThreshold: 90,
          isolateHighlights: false,
          showMask: false,
        });
        break;
      case 'alto_stacco':
        setSettings({
          contrast: 2.2,
          brightness: -10,
          highlightThreshold: 140,
          isolateHighlights: true,
          showMask: false,
        });
        break;
    }
  };

  // Dragging del rettangolo di ritaglio
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      box: { ...cropBox },
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.mouseX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.mouseY) / rect.height) * 100;

    setCropBox(() => {
      const orig = dragStart.box;
      let newBox = { ...orig };

      if (isDragging === 'move') {
        newBox.x = Math.max(0, Math.min(100 - orig.width, orig.x + deltaX));
        newBox.y = Math.max(0, Math.min(100 - orig.height, orig.y + deltaY));
      } else if (isDragging === 'se') {
        newBox.width = Math.max(15, Math.min(100 - orig.x, orig.width + deltaX));
        newBox.height = Math.max(15, Math.min(100 - orig.y, orig.height + deltaY));
      } else if (isDragging === 'sw') {
        const potentialX = Math.max(0, orig.x + deltaX);
        const maxRight = orig.x + orig.width;
        if (maxRight - potentialX >= 15) {
          newBox.x = potentialX;
          newBox.width = maxRight - potentialX;
        }
        newBox.height = Math.max(15, Math.min(100 - orig.y, orig.height + deltaY));
      } else if (isDragging === 'ne') {
        newBox.width = Math.max(15, Math.min(100 - orig.x, orig.width + deltaX));
        const potentialY = Math.max(0, orig.y + deltaY);
        const maxBottom = orig.y + orig.height;
        if (maxBottom - potentialY >= 15) {
          newBox.y = potentialY;
          newBox.height = maxBottom - potentialY;
        }
      } else if (isDragging === 'nw') {
        const potentialX = Math.max(0, orig.x + deltaX);
        const maxRight = orig.x + orig.width;
        if (maxRight - potentialX >= 15) {
          newBox.x = potentialX;
          newBox.width = maxRight - potentialX;
        }
        const potentialY = Math.max(0, orig.y + deltaY);
        const maxBottom = orig.y + orig.height;
        if (maxBottom - potentialY >= 15) {
          newBox.y = potentialY;
          newBox.height = maxBottom - potentialY;
        }
      }

      return newBox;
    });
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // Esegue il ritaglio effettivo e applica
  const handleConfirmCrop = async () => {
    try {
      setIsProcessing(true);
      const croppedUrl = await processImageWithAdjustments(originalImage, settings, cropBox);
      onApplyImage(croppedUrl, settings, true);
      setIsOpen(false);
    } catch (e) {
      console.error('Errore durante ritaglio:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Conferma regolazioni contrasto
  const handleConfirmAdjustments = async () => {
    try {
      setIsProcessing(true);
      const processedUrl = await processImageWithAdjustments(activeImage, settings, null);
      onApplyImage(processedUrl, settings, false);
      setIsOpen(false);
    } catch (e) {
      console.error('Errore applicazione contrasto:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Barra pulsanti rapidi pre-elaborazione sotto l'immagine */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setActiveMode('ritaglio');
            setIsOpen(true);
          }}
          className="flex-1 min-w-[130px] bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          title="Ritaglia per inquadrare solo il fascione da conteggiare ed eliminare sfondo, travi e pavimento"
        >
          <Crop className="w-3.5 h-3.5 text-amber-400" />
          <span>Ritaglia Fascione</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode('contrasto');
            setIsOpen(true);
          }}
          className="flex-1 min-w-[140px] bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          title="Regola contrasto, luminosità e soglia parti lucide per evidenziare le teste di taglio ed eliminare interferenze"
        >
          <Contrast className="w-3.5 h-3.5 text-amber-400" />
          <span>Regola Contrasti & Luci</span>
        </button>

        {/* Toggle rapido maschera lucida binarizzata */}
        <button
          type="button"
          onClick={() => {
            const nextMask = !settings.showMask;
            const newSettings = { ...settings, showMask: nextMask };
            setSettings(newSettings);
            processImageWithAdjustments(activeImage, newSettings, null).then(url => {
              onApplyImage(url, newSettings, false);
            });
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
            settings.showMask 
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md' 
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Mostra la maschera binarizzata: vedi solo i punti bianchi rotondi che l'algoritmo rileverà"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{settings.showMask ? 'Maschera ON' : 'Vista Lucida'}</span>
        </button>

        {/* Pulsante Ripristina Originale se l'immagine è stata modificata */}
        {isImageCropped && (
          <button
            type="button"
            onClick={onResetToOriginal}
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Ripristina la foto originale non ritagliata"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* MODAL / DRAWER INTERATTIVO DI RITAGLIO E CONTRASTO */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {activeMode === 'ritaglio' ? <Crop className="w-5 h-5" /> : <Contrast className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {activeMode === 'ritaglio' 
                      ? 'Ritaglia Area di Interesse (Fascione)' 
                      : 'Ottimizza Contrasti & Isola Parti Lucenti'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activeMode === 'ritaglio'
                      ? 'Inquadra solo le teste di taglio del fascione per eliminare interferenze esterne.'
                      : 'Migliora la visibilità dei riflessi metallici tondi ed elimina ombre o ruggine di sfondo.'}
                  </p>
                </div>
              </div>

              {/* Tabs Modalità */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveMode('ritaglio')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeMode === 'ritaglio' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ritaglio (Crop)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('contrasto')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeMode === 'contrasto' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Contrasto & Luci
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div 
              className="flex-1 p-4 overflow-y-auto space-y-4"
              onMouseMove={activeMode === 'ritaglio' ? handleMouseMove : undefined}
              onMouseUp={activeMode === 'ritaglio' ? handleMouseUp : undefined}
            >
              {/* STAGE VISIVO CON ANTEPRIMA */}
              <div 
                ref={containerRef}
                className="relative w-full rounded-2xl bg-black overflow-hidden flex items-center justify-center min-h-[280px] max-h-[460px] select-none border border-slate-800"
              >
                <img
                  src={activeMode === 'ritaglio' ? originalImage : previewUrl}
                  alt="Anteprima regolazione"
                  className="max-h-[440px] max-w-full object-contain pointer-events-none"
                />

                {/* RETTANGOLO DI RITAGLIO INTERATTIVO */}
                {activeMode === 'ritaglio' && (
                  <div
                    style={{
                      left: `${cropBox.x}%`,
                      top: `${cropBox.y}%`,
                      width: `${cropBox.width}%`,
                      height: `${cropBox.height}%`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                    className="absolute border-2 border-amber-400 bg-amber-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] cursor-move transition-shadow"
                  >
                    <div className="absolute top-1 left-2 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded shadow pointer-events-none">
                      Area Fascione ({Math.round(cropBox.width)}% × {Math.round(cropBox.height)}%)
                    </div>

                    {/* Maniglie di ridimensionamento angolari */}
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, 'nw')}
                      className="absolute -top-2 -left-2 w-4 h-4 bg-amber-400 border-2 border-slate-950 rounded-sm cursor-nwse-resize shadow" 
                    />
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, 'ne')}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-amber-400 border-2 border-slate-950 rounded-sm cursor-nesw-resize shadow" 
                    />
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, 'sw')}
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-400 border-2 border-slate-950 rounded-sm cursor-nesw-resize shadow" 
                    />
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, 'se')}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-400 border-2 border-slate-950 rounded-sm cursor-nwse-resize shadow" 
                    />
                  </div>
                )}
              </div>

              {/* CONTROLLI SPECIFICI MODALITA' RITAGLIO */}
              {activeMode === 'ritaglio' && (
                <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-300 block">Preset Rapidi di Inquadratura:</span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyPresetCrop('centro')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800"
                    >
                      Centrale
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetCrop('superiore')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800"
                    >
                      Ripiano Alto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetCrop('inferiore')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800"
                    >
                      Ripiano Basso
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetCrop('sinistra')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800"
                    >
                      Sinistra
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetCrop('destra')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800"
                    >
                      Destra
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetCrop('tutto')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold border border-amber-500/30"
                    >
                      Foto Intera
                    </button>
                  </div>
                </div>
              )}

              {/* CONTROLLI SPECIFICI MODALITA' CONTRASTO & LUCI */}
              {activeMode === 'contrasto' && (
                <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800/80">
                    <span className="text-xs font-bold text-slate-300">Preset Ottimizzazione Metallo:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleApplyContrastPreset('metallo_lucido')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-bold border border-amber-500/30"
                      >
                        Metallo Lucido
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyContrastPreset('alto_stacco')}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-bold border border-slate-700"
                      >
                        Forte Stacco Sfondo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyContrastPreset('ombra_ruggine')}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-bold border border-slate-700"
                      >
                        Luce Bassa / Ruggine
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyContrastPreset('neutro')}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-[11px] font-bold border border-slate-800"
                      >
                        Neutro
                      </button>
                    </div>
                  </div>

                  {/* Sliders Regolazione */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Slider Contrasto */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Contrast className="w-3.5 h-3.5 text-amber-400" /> Contrasto Metallo
                        </label>
                        <span className="font-mono text-amber-400 font-bold">{settings.contrast.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="2.8"
                        step="0.1"
                        value={settings.contrast}
                        onChange={(e) => setSettings({ ...settings, contrast: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400">Esaspera la differenza tra testa e vuoto</p>
                    </div>

                    {/* Slider Luminosità */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5 text-amber-400" /> Luminosità
                        </label>
                        <span className="font-mono text-amber-400 font-bold">{settings.brightness > 0 ? `+${settings.brightness}` : settings.brightness}</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="5"
                        value={settings.brightness}
                        onChange={(e) => setSettings({ ...settings, brightness: parseInt(e.target.value) })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400">Compensa foto scure o sovraesposte</p>
                    </div>

                    {/* Slider Soglia Parti Lucide */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" /> Soglia Parti Lucenti
                        </label>
                        <span className="font-mono text-amber-400 font-bold">{settings.highlightThreshold}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="210"
                        step="5"
                        value={settings.highlightThreshold}
                        onChange={(e) => setSettings({ ...settings, highlightThreshold: parseInt(e.target.value) })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400">Elimina ciò che non è acciaio lucido</p>
                    </div>
                  </div>

                  {/* Interruttori Maschera ed Eliminazione Sfondo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={settings.isolateHighlights}
                        onChange={(e) => setSettings({ ...settings, isolateHighlights: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">Soppressione Sfondo & Ruggine</span>
                        <span className="text-[10px] text-slate-400">Annerisce le zone scure e le travi esterne</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={settings.showMask}
                        onChange={(e) => setSettings({ ...settings, showMask: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">Visualizza Maschera Binarizzata</span>
                        <span className="text-[10px] text-slate-400">Mostra in bianco puro solo i cerchietti rilevati</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Annulla
              </button>

              <div className="flex items-center gap-2">
                {activeMode === 'ritaglio' ? (
                  <button
                    type="button"
                    onClick={handleConfirmCrop}
                    disabled={isProcessing}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Applica Ritaglio Fascione</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmAdjustments}
                    disabled={isProcessing}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Applica Contrasto & Luci</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
