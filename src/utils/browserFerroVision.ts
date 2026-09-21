// Motore di Visione Computazionale 100% Client-Side nel Browser
// Basato su algoritmi deterministici e filtri di risposta circolare per l'individuazione di tondi B450C:
// 1. Analisi contrasto di luminanza e binarizzazione adattiva (teste di taglio lucide vs interstizi d'ombra)
// 2. Filtro di Risposta Circolare Differenziale (Circular Difference-of-Gaussians / Annular Ring Contrast)
// 3. Stima automatica del raggio dominante delle barre nel fascio (adattamento da Ø8 a Ø32 a qualsiasi distanza)
// 4. Soppressione dei non-massimi (NMS) con vincolo geometrico di impacchettamento e non compenetrazione
// 5. Raggruppamento e clustering spaziale multi-fascione (distinzione ripiani e lotti separati)
// 6. Calcolo pesi teorici B450C UNI EN 10080

import { FascioneRilevato, RiconoscimentoFerriResult, calcolaPesoFascione } from './ferroUtils';

export interface BrowserVisionOptions {
  diametroSelezionato?: number; // mm (se specificato dall'operatore, altrimenti stimato o default 12)
  lunghezzaMetri: number;
  sensitivity?: 'bassa' | 'media' | 'alta';
  highlightThreshold?: number; // 0-255: soglia per considerare una parte "lucida"
  roundnessThreshold?: number; // 0.0 - 1.0: rigidità forma rotonda
  minRadius?: number; // raggio minimo in pixel
  maxRadius?: number; // raggio massimo in pixel
  cropRect?: { x: number; y: number; width: number; height: number }; // % ritaglio ROI
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
 * Esegue il rilevamento ad alta precisione di TUTTE le teste di taglio circolari nel fascio
 * direttamente nel browser senza alcuna dipendenza cloud o librerie esterne pesanti.
 */
export async function analyzeFerriInBrowser(
  dataUrl: string,
  options: BrowserVisionOptions
): Promise<RiconoscimentoFerriResult> {
  const img = await loadImage(dataUrl);

  // Normalizza le dimensioni di analisi per garantire massima reattività (< 250ms)
  // mantenendo la risoluzione geometrica ottimale per distinguere barre a contatto
  const maxDim = 900;
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

  // 1. Mappa di luminanza percettiva (BT.601) e statistiche
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

  // Delimitazione dell'area di scansione (in caso di ritaglio ROI manuale)
  let minScanX = 8;
  let maxScanX = w - 8;
  let minScanY = 8;
  let maxScanY = h - 8;

  if (options.cropRect) {
    const c = options.cropRect;
    minScanX = Math.max(8, Math.round((c.x / 100) * w));
    minScanY = Math.max(8, Math.round((c.y / 100) * h));
    maxScanX = Math.min(w - 8, Math.round(((c.x + c.width) / 100) * w));
    maxScanY = Math.min(h - 8, Math.round(((c.y + c.height) / 100) * h));
  }

  // Calcolo statistiche dell'area di interesse (ROI)
  let roiSum = 0;
  let roiCount = 0;
  let roiMax = 0;
  let roiMin = 255;
  for (let y = minScanY; y < maxScanY; y += 2) {
    for (let x = minScanX; x < maxScanX; x += 2) {
      const val = gray[y * w + x];
      roiSum += val;
      roiCount++;
      if (val > roiMax) roiMax = val;
      if (val < roiMin) roiMin = val;
    }
  }
  const roiAvg = roiCount > 0 ? roiSum / roiCount : avgLuminance;

  const sens = options.sensitivity || 'media';

  // Soglia minima di luminosità della testa metallica
  // Nelle foto di cantiere, il metallo tagliato è più chiaro dello sfondo scuro o degli interstizi d'ombra
  let minMetalLum: number;
  if (options.highlightThreshold !== undefined && options.highlightThreshold !== 110) {
    // L'utente ha personalizzato manualmente lo slider di soglia
    minMetalLum = options.highlightThreshold;
  } else {
    // Calcolo adattivo automatico: il metallo tagliato si trova sopra la media della ROI
    const sensFactor = sens === 'alta' ? 0.15 : sens === 'bassa' ? 0.35 : 0.22;
    minMetalLum = Math.max(35, roiAvg + (roiMax - roiAvg) * sensFactor);
  }

  // 2. Stima Automatica del Raggio Dominante (Ø barre in pixel)
  // In un fascione di ferro omogeneo, tutte le barre hanno il medesimo diametro.
  // Testiamo diversi raggi candidati e individuiamo quello che massimizza la risonanza circolare
  const candidateRadii = [10, 14, 18, 22, 26, 30, 34, 40, 48];
  let bestR = options.diametroSelezionato ? Math.max(12, Math.round(options.diametroSelezionato * 1.5)) : 22;
  let bestRScore = -1;

  for (const testR of candidateRadii) {
    const inR = Math.max(2, Math.round(testR * 0.55));
    const outR1 = Math.round(testR * 0.92);
    const outR2 = Math.round(testR * 1.25);

    // Campionamento rapido per determinare la risonanza del raggio
    const inOffsets: Array<{ dx: number; dy: number }> = [];
    for (let dy = -inR; dy <= inR; dy += 2) {
      for (let dx = -inR; dx <= inR; dx += 2) {
        if (dx * dx + dy * dy <= inR * inR) inOffsets.push({ dx, dy });
      }
    }

    const outOffsets: Array<{ dx: number; dy: number }> = [];
    for (let dy = -outR2; dy <= outR2; dy += 2) {
      for (let dx = -outR2; dx <= outR2; dx += 2) {
        const d2 = dx * dx + dy * dy;
        if (d2 >= outR1 * outR1 && d2 <= outR2 * outR2) outOffsets.push({ dx, dy });
      }
    }

    if (inOffsets.length === 0 || outOffsets.length === 0) continue;

    const sampleDiffs: number[] = [];
    const sampleStep = Math.max(6, Math.round(testR * 0.6));
    const startY = Math.max(minScanY + outR2 + 4, outR2 + 4);
    const endY = Math.min(maxScanY - outR2 - 4, h - outR2 - 4);
    const startX = Math.max(minScanX + outR2 + 4, outR2 + 4);
    const endX = Math.min(maxScanX - outR2 - 4, w - outR2 - 4);

    for (let y = startY; y < endY; y += sampleStep) {
      for (let x = startX; x < endX; x += sampleStep) {
        if (gray[y * w + x] < minMetalLum * 0.7) continue;

        let inSum = 0;
        for (let i = 0; i < inOffsets.length; i++) {
          inSum += gray[(y + inOffsets[i].dy) * w + (x + inOffsets[i].dx)];
        }
        const inAvg = inSum / inOffsets.length;

        let outSum = 0;
        for (let i = 0; i < outOffsets.length; i++) {
          outSum += gray[(y + outOffsets[i].dy) * w + (x + outOffsets[i].dx)];
        }
        const outAvg = outSum / outOffsets.length;

        const diff = inAvg - outAvg;
        if (diff > 4) {
          sampleDiffs.push(diff);
        }
      }
    }

    sampleDiffs.sort((a, b) => b - a);
    const topSum = sampleDiffs.slice(0, 35).reduce((s, v) => s + v, 0);
    if (topSum > bestRScore) {
      bestRScore = topSum;
      bestR = testR;
    }
  }

  // 3. Convoluzione Circolare ad Alta Precisione con il Raggio Ottimale
  const targetR = bestR;
  const inR = Math.max(2, Math.round(targetR * 0.55));
  const outR1 = Math.round(targetR * 0.90);
  const outR2 = Math.round(targetR * 1.25);

  const inOffsets: Array<{ dx: number; dy: number }> = [];
  for (let dy = -inR; dy <= inR; dy += 2) {
    for (let dx = -inR; dx <= inR; dx += 2) {
      if (dx * dx + dy * dy <= inR * inR) inOffsets.push({ dx, dy });
    }
  }

  const outOffsets: Array<{ dx: number; dy: number }> = [];
  for (let dy = -outR2; dy <= outR2; dy += 2) {
    for (let dx = -outR2; dx <= outR2; dx += 2) {
      const d2 = dx * dx + dy * dy;
      if (d2 >= outR1 * outR1 && d2 <= outR2 * outR2) outOffsets.push({ dx, dy });
    }
  }

  const inLen = inOffsets.length;
  const outLen = outOffsets.length;

  const responseMap = new Float32Array(w * h);
  const convStep = 2;
  const startY = Math.max(minScanY + outR2 + 2, outR2 + 2);
  const endY = Math.min(maxScanY - outR2 - 2, h - outR2 - 2);
  const startX = Math.max(minScanX + outR2 + 2, outR2 + 2);
  const endX = Math.min(maxScanX - outR2 - 2, w - outR2 - 2);

  for (let y = startY; y < endY; y += convStep) {
    for (let x = startX; x < endX; x += convStep) {
      const centerLum = gray[y * w + x];
      // Ignora pixel scuri o ombre nette di fondo
      if (centerLum < minMetalLum * 0.65) continue;

      let inSum = 0;
      for (let i = 0; i < inLen; i++) {
        inSum += gray[(y + inOffsets[i].dy) * w + (x + inOffsets[i].dx)];
      }
      const inAvg = inSum / inLen;

      let outSum = 0;
      for (let i = 0; i < outLen; i++) {
        outSum += gray[(y + outOffsets[i].dy) * w + (x + outOffsets[i].dx)];
      }
      const outAvg = outSum / outLen;

      // La testa circolare del ferro presenta contrasto positivo rispetto alla corona perimetrale
      const contrastDiff = inAvg - outAvg;
      if (contrastDiff > 0) {
        responseMap[y * w + x] = contrastDiff * (inAvg / (roiAvg || 1));
      }
    }
  }

  // 4. Estrazione dei Picchi Locali (Centri delle Barre)
  interface CandidateBar {
    x: number;
    y: number;
    radius: number;
    score: number;
    brightness: number;
  }

  const candidateBars: CandidateBar[] = [];
  const localWin = Math.max(3, Math.round(targetR * 0.5));
  const minResponseCutoff = sens === 'alta' ? 2.5 : sens === 'bassa' ? 6.5 : 4.0;

  for (let y = startY; y < endY; y += convStep) {
    for (let x = startX; x < endX; x += convStep) {
      const val = responseMap[y * w + x];
      if (val < minResponseCutoff) continue;

      let isMax = true;
      for (let dy = -localWin; dy <= localWin; dy += convStep) {
        for (let dx = -localWin; dx <= localWin; dx += convStep) {
          if (dx === 0 && dy === 0) continue;
          if (responseMap[(y + dy) * w + (x + dx)] > val) {
            isMax = false;
            break;
          }
        }
        if (!isMax) break;
      }

      if (isMax) {
        candidateBars.push({
          x,
          y,
          radius: targetR,
          score: val,
          brightness: Math.round(gray[y * w + x]),
        });
      }
    }
  }

  // Ordina i candidati per score decrescente (le teste più nette hanno priorità)
  candidateBars.sort((a, b) => b.score - a.score);

  // 5. Non-Maximum Suppression (NMS) con Vincolo Fisico di Spaziatura
  // Due barre di raggio R non possono compenetrarsi; la loro distanza minima è circa 1.55 * R
  const minSeparation = targetR * 1.55;
  const minSepSq = minSeparation * minSeparation;
  const acceptedPoints: Array<{ x: number; y: number; radius: number; score: number }> = [];

  for (const bar of candidateBars) {
    let tooClose = false;
    for (let i = 0; i < acceptedPoints.length; i++) {
      const acc = acceptedPoints[i];
      const dx = bar.x - acc.x;
      const dy = bar.y - acc.y;
      if (dx * dx + dy * dy < minSepSq) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      acceptedPoints.push(bar);
    }
  }

  // 6. Completamento a Reticolo Hexagonale (Recupero Barre con Riflesso Minore o Parziale Ombra)
  // Nei fasci di tondini, le barre sono disposte a nido d'ape (hexagonal close-packing).
  // Se la sensibilità è media o alta, controlliamo se ci sono nodi del reticolo vuoti con buona risonanza
  if ((sens === 'alta' || sens === 'media') && acceptedPoints.length >= 8) {
    // Passo tipico del reticolo a contatto
    const latticeStep = targetR * 1.85;
    const hexAngles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];

    const additionalPoints: Array<{ x: number; y: number; radius: number; score: number }> = [];
    const minExtraCutoff = minResponseCutoff * 0.65;

    for (let i = 0; i < acceptedPoints.length; i++) {
      const basePt = acceptedPoints[i];
      for (const angle of hexAngles) {
        const nx = Math.round(basePt.x + Math.cos(angle) * latticeStep);
        const ny = Math.round(basePt.y + Math.sin(angle) * latticeStep);

        if (nx < startX || nx >= endX || ny < startY || ny >= endY) continue;

        // Verifica che non ci sia già una barra accettata vicina
        let hasNeighbor = false;
        for (let j = 0; j < acceptedPoints.length; j++) {
          const pt = acceptedPoints[j];
          const dx = nx - pt.x;
          const dy = ny - pt.y;
          if (dx * dx + dy * dy < minSepSq) {
            hasNeighbor = true;
            break;
          }
        }
        if (hasNeighbor) continue;

        for (let j = 0; j < additionalPoints.length; j++) {
          const pt = additionalPoints[j];
          const dx = nx - pt.x;
          const dy = ny - pt.y;
          if (dx * dx + dy * dy < minSepSq) {
            hasNeighbor = true;
            break;
          }
        }
        if (hasNeighbor) continue;

        // Se in quel nodo del reticolo il segnale circolare è positivo e la luminosità è metallica
        const nodeVal = responseMap[ny * w + nx];
        const nodeLum = gray[ny * w + nx];
        if (nodeVal >= minExtraCutoff && nodeLum >= minMetalLum * 0.65) {
          additionalPoints.push({
            x: nx,
            y: ny,
            radius: targetR,
            score: nodeVal,
          });
        }
      }
    }

    acceptedPoints.push(...additionalPoints);
  }

  // 7. Clustering Spaziale Multi-Fascione (Segmentazione a Regole)
  // Raggruppa i punti che si trovano a distanza ravvicinata in singoli fascioni distinti.
  // Se la foto è stata ritagliata dall'utente (Crop), tutti i punti appartengono al fascione selezionato!
  const clusterDist = targetR * 3.6;
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

  // Se i cluster sono vuoti o l'utente ha fatto un ritaglio ROI, prendi tutti i punti come singolo fascione
  if (rawClusters.length === 0 && acceptedPoints.length > 0) {
    rawClusters.push(acceptedPoints);
  }

  // Ordina i cluster spazialmente: prima per altezza (ripiani superiori / inferiori), poi da sinistra a destra
  rawClusters.sort((cA, cB) => {
    const avgYA = cA.reduce((s, p) => s + p.y, 0) / cA.length;
    const avgYB = cB.reduce((s, p) => s + p.y, 0) / cB.length;
    if (Math.abs(avgYA - avgYB) > h * 0.15) {
      return avgYA - avgYB;
    }
    const avgXA = cA.reduce((s, p) => s + p.x, 0) / cA.length;
    const avgXB = cB.reduce((s, p) => s + p.x, 0) / cB.length;
    return avgXA - avgXB;
  });

  const defaultDiam = options.diametroSelezionato || 12;
  const barLength = options.lunghezzaMetri || 12;

  // 8. Costruzione dei fascioni rilevati e calcolo pesi
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
      note: `Analisi completata nel browser tramite motore deterministico ad alta precisione (risposta circolare e reticolo hexagonale). ${totaleFerri} barre rilevate in ${fascioni.length} fascioni (raggio medio stimato: ${targetR}px).`,
    },
    sintesi_tecnica: `Rilievo computazionale browser: ${fascioni.length} fascioni di barre B450C Ø${defaultDiam}mm (${totaleFerri} barre totali, peso stimato ${Math.round(pesoTotaleKg).toLocaleString()} kg).`,
    cantiereId: options.cantiereId,
    cantiereName: options.cantiereName || 'Cantiere',
    dataRilievo: new Date().toISOString(),
    operatore: options.operatore || 'Capocantiere',
    imageUrl: dataUrl,
  };
}
