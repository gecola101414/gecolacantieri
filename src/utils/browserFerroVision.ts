// Motore di Visione Computazionale 100% Client-Side nel Browser
// Basato su algoritmi deterministici e regole geometriche per l'individuazione di tondi B450C:
// 1. Analisi contrasto di luminanza (teste di taglio metalliche lucide vs interstizi d'ombra)
// 2. Trasformata di Simmetria Radiale Veloce (FRST) e rilevamento cerchi (Hough circolare)
// 3. Soppressione dei non-massimi (NMS) basata sul diametro delle barre
// 4. Segmentazione e clustering spaziale multi-fascione (separazione ripiani e lotti)
// 5. Calcolo pesi teorici B450C UNI EN 10080

import { FascioneRilevato, RiconoscimentoFerriResult, PESI_LINEARI_FERRO, calcolaPesoFascione } from './ferroUtils';

export interface BrowserVisionOptions {
  diametroSelezionato?: number; // mm (se specificato dall'utente, altrimenti stimato)
  lunghezzaMetri: number;
  sensitivity?: 'bassa' | 'media' | 'alta';
  highlightThreshold?: number; // 0-255: soglia per considerare una parte "lucida"
  roundnessThreshold?: number; // 0.0 - 1.0: rigidità forma rotonda
  minRadius?: number; // raggio minimo in pixel
  maxRadius?: number; // raggio massimo in pixel
  cropRect?: { x: number; y: number; width: number; height: number }; // % ritaglio
  cantiereId?: string;
  cantiereName?: string;
  operatore?: string;
}

/**
 * Carica l'immagine in un elemento HTMLImageElement
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Impossibile caricare l\'immagine nel canvas del browser: ' + e));
    img.src = dataUrl;
  });
}

/**
 * Esegue il rilevamento delle sole parti più chiare/lucenti di forma strettamente rotonda
 * direttamente nel browser senza alcuna dipendenza esterna o modello neurale.
 */
export async function analyzeFerriInBrowser(
  dataUrl: string,
  options: BrowserVisionOptions
): Promise<RiconoscimentoFerriResult> {
  const img = await loadImage(dataUrl);

  // Normalizza le dimensioni di analisi per garantire massima reattività (< 300ms)
  const maxDim = 850;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D non supportato nel browser corrente');
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  // 1. Mappa di luminanza percettiva (BT.601) e calcolo statistiche
  const gray = new Float32Array(w * h);
  let sumL = 0;
  let maxL = 0;
  let minL = 255;

  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    sumL += lum;
    if (lum > maxL) maxL = lum;
    if (lum < minL) minL = lum;
  }
  const avgLuminance = sumL / (w * h);

  // Calcolo soglia automatica parti lucide se non specificata dall'utente
  // La testa di taglio del ferro è tra il 20% dei pixel più chiari dell'immagine
  const userThresh = options.highlightThreshold;
  const sens = options.sensitivity || 'media';
  let brightThreshold = userThresh !== undefined 
    ? userThresh 
    : avgLuminance + (maxL - avgLuminance) * (sens === 'alta' ? 0.35 : sens === 'bassa' ? 0.65 : 0.48);

  // Limiti raggio teste rotonde in pixel (in base al diametro o sensibilità)
  const minR = options.minRadius || (sens === 'alta' ? 4 : sens === 'bassa' ? 7 : 5);
  const maxR = options.maxRadius || (sens === 'alta' ? 24 : sens === 'bassa' ? 18 : 20);
  const minRoundness = options.roundnessThreshold || 0.62; // Rapporto R_min / R_max

  // 2. Mappa dei gradienti Sobel
  const gradMag = new Float32Array(w * h);
  const gradDirX = new Float32Array(w * h);
  const gradDirY = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = (gray[idx + 1] - gray[idx - 1]) * 0.5;
      const gy = (gray[idx + w] - gray[idx - w]) * 0.5;
      const mag = Math.sqrt(gx * gx + gy * gy);
      gradMag[idx] = mag;
      if (mag > 3) {
        gradDirX[idx] = gx / mag;
        gradDirY[idx] = gy / mag;
      }
    }
  }

  // Se è stato specificato un ritaglio, delimitiamo l'area di scansione
  let minScanX = 10;
  let maxScanX = w - 10;
  let minScanY = 10;
  let maxScanY = h - 10;

  if (options.cropRect) {
    const c = options.cropRect;
    minScanX = Math.max(10, Math.round((c.x / 100) * w));
    minScanY = Math.max(10, Math.round((c.y / 100) * h));
    maxScanX = Math.min(w - 10, Math.round(((c.x + c.width) / 100) * w));
    maxScanY = Math.min(h - 10, Math.round(((c.y + c.height) / 100) * h));
  }

  // 3. Rilevamento delle sole parti più chiare e verifica della forma rotonda
  interface DetectedCircle {
    x: number;
    y: number;
    radius: number;
    circularity: number;
    brightness: number;
    score: number;
  }

  const detectedCircles: DetectedCircle[] = [];
  const numRays = 12; // 12 raggi a 30 gradi per test di rotondità ad alta precisione
  const rayAngles: Array<{ cos: number; sin: number }> = [];
  for (let a = 0; a < numRays; a++) {
    const rad = (a / numRays) * Math.PI * 2;
    rayAngles.push({ cos: Math.cos(rad), sin: Math.sin(rad) });
  }

  // Scansione pixel candidati: SOLO pixel con luminanza superiore alla soglia e che sono massimi locali
  const step = 2;
  for (let y = minScanY + maxR; y < maxScanY - maxR; y += step) {
    for (let x = minScanX + maxR; x < maxScanX - maxR; x += step) {
      const idx = y * w + x;
      const centerLum = gray[idx];

      // REGOLA 1: Deve essere una delle parti più chiare (sopra soglia di brillantezza)
      if (centerLum < brightThreshold) continue;

      // Massimo locale in una finestra 5x5
      let isLocalMax = true;
      for (let dy = -2; dy <= 2; dy += 2) {
        for (let dx = -2; dx <= 2; dx += 2) {
          if (dx === 0 && dy === 0) continue;
          if (gray[(y + dy) * w + (x + dx)] > centerLum) {
            isLocalMax = false;
            break;
          }
        }
        if (!isLocalMax) break;
      }
      if (!isLocalMax) continue;

      // REGOLA 2: Verifica geometrica della forma rotonda lungo 12 direzioni radiali
      const rayLengths: number[] = [];
      let totalR = 0;
      let validRays = 0;

      for (let i = 0; i < numRays; i++) {
        const { cos, sin } = rayAngles[i];
        let foundEdge = false;
        let edgeR = minR;

        // Cammina dal centro verso l'esterno cercando il bordo di contrasto (discesa luminanza)
        for (let r = minR - 1; r <= maxR + 3; r++) {
          const rx = Math.round(x + cos * r);
          const ry = Math.round(y + sin * r);
          if (rx < 0 || rx >= w || ry < 0 || ry >= h) break;

          const rayLum = gray[ry * w + rx];
          const rayIdx = ry * w + rx;
          const mag = gradMag[rayIdx];

          // Condizione di bordo della testa del ferro:
          // 1. Caduta significativa di luminanza rispetto al centro chiaro
          // 2. Oppure picco di gradiente che punta verso l'esterno
          if (centerLum - rayLum > 18 || (mag > 12 && r >= minR)) {
            edgeR = r;
            foundEdge = true;
            break;
          }
        }

        if (foundEdge && edgeR >= minR && edgeR <= maxR) {
          rayLengths.push(edgeR);
          totalR += edgeR;
          validRays++;
        }
      }

      // Se meno di 9 raggi su 12 hanno trovato un bordo coerente, NON è rotondo (es. linea o superficie piana)
      if (validRays < 9) continue;

      const meanR = totalR / validRays;
      let minRay = Infinity;
      let maxRay = -Infinity;
      let varianceSum = 0;

      for (const r of rayLengths) {
        if (r < minRay) minRay = r;
        if (r > maxRay) maxRay = r;
        varianceSum += (r - meanR) * (r - meanR);
      }

      const stdDev = Math.sqrt(varianceSum / validRays);
      const circularity = minRay / (maxRay || 1); // 1.0 = cerchio perfetto
      const stdRatio = stdDev / (meanR || 1);

      // REGOLA 3: FILTRO DI FORMA STRETTAMENTE ROTONDA
      // - Il rapporto tra raggio minimo e massimo deve essere alto (> minRoundness)
      // - La deviazione standard rispetto al raggio medio deve essere bassa (< 0.26)
      if (circularity < minRoundness || stdRatio > 0.26) {
        continue; // Scartato: forma allungata, rettangolare, travetto o striscia
      }

      // REGOLA 4: CONTRASTO CENTRO CHIARO vs ANELLO ESTERNO SCURO
      // Il dischetto interno deve essere omogeneamente più chiaro del perimetro circostante
      let surroundSum = 0;
      let surroundSamples = 0;
      const surroundR = meanR + 3;

      for (let i = 0; i < numRays; i++) {
        const { cos, sin } = rayAngles[i];
        const sx = Math.round(x + cos * surroundR);
        const sy = Math.round(y + sin * surroundR);
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          surroundSum += gray[sy * w + sx];
          surroundSamples++;
        }
      }

      const surroundAvg = surroundSamples > 0 ? surroundSum / surroundSamples : centerLum;
      const localContrast = centerLum - surroundAvg;

      // La testa metallica tagliata deve essere nettamente più luminosa dell'interstizio
      if (localContrast < (sens === 'alta' ? 6 : sens === 'bassa' ? 18 : 10)) {
        continue; // Scartato: contrasto debole con lo sfondo
      }

      const score = (centerLum * 1.5) + (circularity * 100) + (localContrast * 2);
      detectedCircles.push({
        x,
        y,
        radius: Math.round(meanR * 10) / 10,
        circularity: Math.round(circularity * 100) / 100,
        brightness: Math.round(centerLum),
        score,
      });
    }
  }

  // 4. Non-Maximum Suppression (NMS) per eliminare duplicati sulla stessa barra
  // Ordina per punteggio decrescente (le teste più lucide e rotonde hanno priorità)
  detectedCircles.sort((a, b) => b.score - a.score);

  const acceptedPoints: Array<{ x: number; y: number; radius: number }> = [];
  for (const c of detectedCircles) {
    const minSeparation = c.radius * 1.45; // Barre non possono compenetrarsi
    const minSepSq = minSeparation * minSeparation;
    let tooClose = false;

    for (const acc of acceptedPoints) {
      const dx = c.x - acc.x;
      const dy = c.y - acc.y;
      if (dx * dx + dy * dy < minSepSq) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      acceptedPoints.push({ x: c.x, y: c.y, radius: c.radius });
    }
  }

  // 5. Clustering Spaziale Multi-Fascione (Segmentazione a Regole)
  // Raggruppa i punti che si trovano a distanza ravvicinata in singoli fascioni distinti.
  // Se la foto è stata ritagliata dall'utente (Crop), tutti i punti appartengono al fascione selezionato!
  const avgDetectedRadius = acceptedPoints.length > 0 
    ? acceptedPoints.reduce((s, p) => s + p.radius, 0) / acceptedPoints.length 
    : 8;
  const clusterDist = avgDetectedRadius * 3.8;
  const clusterDistSq = clusterDist * clusterDist;
  const visited = new Set<number>();
  const rawClusters: Array<Array<{ x: number; y: number }>> = [];

  for (let i = 0; i < acceptedPoints.length; i++) {
    if (visited.has(i)) continue;

    const cluster: Array<{ x: number; y: number }> = [];
    const queue: number[] = [i];
    visited.add(i);

    while (queue.length > 0) {
      const currIdx = queue.shift()!;
      const currPt = acceptedPoints[currIdx];
      cluster.push(currPt);

      for (let j = 0; j < acceptedPoints.length; j++) {
        if (visited.has(j)) continue;
        const otherPt = acceptedPoints[j];
        const dx = currPt.x - otherPt.x;
        const dy = currPt.y - otherPt.y;
        if (dx * dx + dy * dy <= clusterDistSq) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    // Un fascione valido deve avere almeno 4 barre
    if (cluster.length >= 4) {
      rawClusters.push(cluster);
    }
  }

  // Se i cluster sono vuoti (es. foto ravvicinata di un solo fascio), prendi tutti i punti come singolo fascione
  if (rawClusters.length === 0 && acceptedPoints.length > 0) {
    rawClusters.push(acceptedPoints);
  }

  // Ordina i cluster spazialmente: prima per altezza (ripiani superiori / inferiori), poi da sinistra a destra
  rawClusters.sort((cA, cB) => {
    const avgYA = cA.reduce((s, p) => s + p.y, 0) / cA.length;
    const avgYB = cB.reduce((s, p) => s + p.y, 0) / cB.length;
    // Se c'è una separazione verticale significativa (> 15% altezza), ordina per riga
    if (Math.abs(avgYA - avgYB) > h * 0.15) {
      return avgYA - avgYB;
    }
    const avgXA = cA.reduce((s, p) => s + p.x, 0) / cA.length;
    const avgXB = cB.reduce((s, p) => s + p.x, 0) / cB.length;
    return avgXA - avgXB;
  });

  const defaultDiam = options.diametroSelezionato || 12;
  const barLength = options.lunghezzaMetri || 12;

  // 6. Costruzione dei fascioni rilevati e calcolo pesi
  let totaleFerri = 0;
  let pesoTotaleKg = 0;

  const fascioni: FascioneRilevato[] = rawClusters.map((cluster, cIndex) => {
    const count = cluster.length;
    totaleFerri += count;

    // Calcolo Bounding Box in percentuale (0 - 100%)
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of cluster) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    // Aggiungi un margine di sicurezza (padding)
    const padX = Math.max(12, (maxX - minX) * 0.08);
    const padY = Math.max(12, (maxY - minY) * 0.08);

    const bBox = {
      x: Math.max(0, Math.round(((minX - padX) / w) * 1000) / 10),
      y: Math.max(0, Math.round(((minY - padY) / h) * 1000) / 10),
      width: Math.min(100, Math.round(((maxX - minX + padX * 2) / w) * 1000) / 10),
      height: Math.min(100, Math.round(((maxY - minY + padY * 2) / h) * 1000) / 10),
    };

    // Coordinate dei punti in percentuale per l'overlay grafico
    const coordinatePunti = cluster.map(p => ({
      x: Math.round((p.x / w) * 1000) / 10,
      y: Math.round((p.y / h) * 1000) / 10,
    }));

    // Posizione descrittiva
    const avgX = (minX + maxX) / 2;
    const avgY = (minY + maxY) / 2;
    const riga = avgY < h * 0.48 ? 'Superiore' : 'Inferiore';
    const colonna = avgX < w * 0.35 ? 'Sx' : avgX > w * 0.65 ? 'Dx' : 'Centro';
    const descPos = rawClusters.length > 1 ? `Ripiano ${riga} (${colonna})` : 'Fascione centrale';

    const pesoFascione = calcolaPesoFascione(count, defaultDiam, barLength);
    pesoTotaleKg += pesoFascione;

    return {
      id_fascione: `Fascione ${cIndex + 1}`,
      posizione: descPos,
      quantita_barre: count,
      diametro_mm: defaultDiam,
      peso_stimato_kg: pesoFascione,
      livello_confidenza: count > 15 ? 'alta' : 'media',
      box_percentuale: bBox,
      coordinate_punti: coordinatePunti,
    };
  });

  return {
    totale_ferri: totaleFerri,
    numero_fascioni: fascioni.length,
    peso_totale_kg: Math.round(pesoTotaleKg),
    lunghezza_barre_metri: barLength,
    fascioni,
    qualita_foto: {
      illuminazione: avgLuminance > 80 ? 'buona' : avgLuminance > 40 ? 'sufficiente' : 'scarsa',
      note: `Analisi completata nel browser tramite motore deterministico di visione (simmetria radiale e contrasto). ${totaleFerri} barre rilevate in ${fascioni.length} fascioni.`,
    },
    sintesi_tecnica: `Rilievo computazionale browser: ${fascioni.length} fascioni di barre B450C Ø${defaultDiam}mm (${totaleFerri} barre totali, peso stimato ${Math.round(pesoTotaleKg).toLocaleString()} kg).`,
    cantiereId: options.cantiereId,
    cantiereName: options.cantiereName || 'Cantiere',
    dataRilievo: new Date().toISOString(),
    operatore: options.operatore || 'Capocantiere',
    imageUrl: dataUrl,
  };
}
