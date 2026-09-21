/**
 * Utility per pre-trattamento, regolazione contrasto, isolamento parti lucide e ritaglio (Crop ROI)
 * delle foto di fascioni di ferro prima del riconoscimento.
 */

export interface ImageAdjustmentSettings {
  contrast: number; // 0.5 a 3.0 (default 1.4)
  brightness: number; // -50 a +50 (default 0)
  highlightThreshold: number; // 0 a 255 (default 120): elimina tutto ciò che è sotto questa soglia
  isolateHighlights: boolean; // Se true, spinge a nero puro tutto ciò che non è lucido
  showMask: boolean; // Se true, mostra la maschera binarizzata delle sole teste lucide
}

export interface CropRectangle {
  x: number; // percentuale 0-100
  y: number; // percentuale 0-100
  width: number; // percentuale 0-100
  height: number; // percentuale 0-100
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustmentSettings = {
  contrast: 1.4,
  brightness: 5,
  highlightThreshold: 110,
  isolateHighlights: false,
  showMask: false,
};

/**
 * Carica un'immagine da Data URL in un HTMLImageElement
 */
export function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Errore nel caricamento dell\'immagine: ' + e));
    img.src = dataUrl;
  });
}

/**
 * Applica contrasto, luminosità, isolamento parti lucide e ritaglio (Crop) su un canvas HTML5.
 * Restituisce il Data URL dell'immagine elaborata.
 */
export async function processImageWithAdjustments(
  originalDataUrl: string,
  settings: ImageAdjustmentSettings,
  crop?: CropRectangle | null
): Promise<string> {
  const img = await loadImageElement(originalDataUrl);

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Calcola coordinate assolute di ritaglio
  let sourceX = 0;
  let sourceY = 0;
  let sourceW = origW;
  let sourceH = origH;

  if (crop && crop.width > 2 && crop.height > 2) {
    sourceX = Math.max(0, Math.round((crop.x / 100) * origW));
    sourceY = Math.max(0, Math.round((crop.y / 100) * origH));
    sourceW = Math.min(origW - sourceX, Math.round((crop.width / 100) * origW));
    sourceH = Math.min(origH - sourceY, Math.round((crop.height / 100) * origH));
  }

  // Risoluzione di output (massimo 1200px sul lato lungo per velocità e nitidezza)
  const maxDim = 1200;
  let targetW = sourceW;
  let targetH = sourceH;
  if (targetW > maxDim || targetH > maxDim) {
    if (targetW > targetH) {
      targetH = Math.round((targetH * maxDim) / targetW);
      targetW = maxDim;
    } else {
      targetW = Math.round((targetW * maxDim) / targetH);
      targetH = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context non disponibile');
  }

  // Disegna porzione ritagliata
  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, targetW, targetH);

  // Se i filtri sono neutri e non c'è maschera, restituisci direttamente
  const isNeutral =
    settings.contrast === 1.0 &&
    settings.brightness === 0 &&
    !settings.isolateHighlights &&
    !settings.showMask;

  if (isNeutral && (!crop || (crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100))) {
    return canvas.toDataURL('image/jpeg', 0.90);
  }

  // Elaborazione pixel per pixel di contrasto, luminanza e soppressione interferenze
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imageData.data;
  const contrastFactor = settings.contrast;
  const brightness = settings.brightness;
  const thresh = settings.highlightThreshold;
  const isolate = settings.isolateHighlights;
  const showMask = settings.showMask;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Calcolo luminanza percettiva
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (showMask) {
      // Modalità maschera: se sopra la soglia lucida diventa bianco, altrimenti nero
      if (lum >= thresh) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
      continue;
    }

    if (isolate) {
      // Se non supera la soglia delle parti lucide, attenua drasticamente a scuro per togliere interferenze
      if (lum < thresh) {
        data[i] = Math.max(0, Math.round(r * 0.15));
        data[i + 1] = Math.max(0, Math.round(g * 0.15));
        data[i + 2] = Math.max(0, Math.round(b * 0.15));
        continue;
      }
    }

    // Applicazione contrasto e luminosità standard (curva centrata a 128)
    r = (r - 128) * contrastFactor + 128 + brightness;
    g = (g - 128) * contrastFactor + 128 + brightness;
    b = (b - 128) * contrastFactor + 128 + brightness;

    // Se la soglia è attiva (ma non in modalità maschera pura), sopprimi leggermente ombre sotto soglia
    const newLum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (newLum < thresh * 0.7) {
      r = r * 0.4;
      g = g * 0.4;
      b = b * 0.4;
    }

    data[i] = Math.min(255, Math.max(0, Math.round(r)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.90);
}
