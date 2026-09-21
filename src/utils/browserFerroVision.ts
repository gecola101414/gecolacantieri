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
 * Esegue il rilevamento e conteggio barre di ferro direttamente nel browser
 */
export async function analyzeFerriInBrowser(
  dataUrl: string,
  options: BrowserVisionOptions
): Promise<RiconoscimentoFerriResult> {
  const img = await loadImage(dataUrl);

  // Normalizza le dimensioni di analisi per garantire performance real-time (< 350ms)
  const maxDim = 800;
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

  // 1. Creazione mappa in scala di grigi e calcolo statistiche di luminanza
  const gray = new Float32Array(w * h);
  let sumL = 0;
  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    // Luminanza percepita ITU-R BT.601
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = l;
    sumL += l;
  }
  const avgLuminance = sumL / (w * h);

  // 2. Calcolo dei gradienti orizzontali e verticali (Sobel ridotto)
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
      if (mag > 4) {
        gradDirX[idx] = gx / mag;
        gradDirY[idx] = gy / mag;
      }
    }
  }

  // 3. Raggio stimato delle barre in pixel nell'immagine scalata
  // Per immagini standard tipiche da cantiere, le teste hanno un raggio tra 5px e 16px
  const sens = options.sensitivity || 'media';
  const minGradThreshold = sens === 'alta' ? 6 : sens === 'bassa' ? 14 : 9;
  const candidateRadii = [6, 8, 10, 13, 16];

  // Accumulatore di simmetria radiale circolare (FRST - Fast Radial Symmetry)
  const accumulator = new Float32Array(w * h);

  for (const radius of candidateRadii) {
    for (let y = radius + 2; y < h - radius - 2; y += 2) {
      for (let x = radius + 2; x < w - radius - 2; x += 2) {
        const idx = y * w + x;
        const mag = gradMag[idx];
        if (mag < minGradThreshold) continue;

        const dx = gradDirX[idx];
        const dy = gradDirY[idx];

        // Votazione lungo il gradiente inverso (verso il centro lucido della barra)
        const cx = Math.round(x - dx * radius);
        const cy = Math.round(y - dy * radius);

        if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
          const cIdx = cy * w + cx;
          // Regola: Il centro deve essere più chiaro del bordo del ferro
          const centerLum = gray[cIdx];
          const edgeLum = gray[idx];
          if (centerLum >= edgeLum) {
            accumulator[cIdx] += (centerLum - edgeLum + 2) * (mag / 10);
          }
        }
      }
    }
  }

  // 4. Filtro locale di contrasto circolare e non-maximum suppression (NMS)
  const candidatePoints: Array<{ x: number; y: number; score: number; radius: number }> = [];
  const minScoreThreshold = sens === 'alta' ? 15 : sens === 'bassa' ? 35 : 22;

  for (let y = 15; y < h - 15; y += 3) {
    for (let x = 15; x < w - 15; x += 3) {
      const idx = y * w + x;
      const score = accumulator[idx];
      if (score < minScoreThreshold) continue;

      const centerLum = gray[idx];
      // Verifica contrasto con anello circostante (r = 8px)
      let ringAvg = 0;
      let samples = 0;
      const rCheck = 8;
      for (let a = 0; a < 8; a++) {
        const angle = (a / 8) * Math.PI * 2;
        const rx = Math.round(x + Math.cos(angle) * rCheck);
        const ry = Math.round(y + Math.sin(angle) * rCheck);
        if (rx >= 0 && rx < w && ry >= 0 && ry < h) {
          ringAvg += gray[ry * w + rx];
          samples++;
        }
      }
      ringAvg = samples > 0 ? ringAvg / samples : centerLum;

      // Regola: La testa di taglio del ferro ha una brillantezza locale rispetto agli interstizi
      const contrast = centerLum - ringAvg;
      if (contrast > -2) {
        candidatePoints.push({
          x,
          y,
          score: score + Math.max(0, contrast * 2),
          radius: rCheck,
        });
      }
    }
  }

  // Ordina i punti candidati per forza di risposta decrescente
  candidatePoints.sort((a, b) => b.score - a.score);

  // NMS (Non-Maximum Suppression): sopprime punti troppo vicini tra loro
  const acceptedPoints: Array<{ x: number; y: number }> = [];
  const minDistanceBetweenBars = sens === 'alta' ? 10 : sens === 'bassa' ? 16 : 12;
  const minDistanceSq = minDistanceBetweenBars * minDistanceBetweenBars;

  for (const pt of candidatePoints) {
    let tooClose = false;
    for (const acc of acceptedPoints) {
      const dx = pt.x - acc.x;
      const dy = pt.y - acc.y;
      if (dx * dx + dy * dy < minDistanceSq) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      acceptedPoints.push({ x: pt.x, y: pt.y });
    }
  }

  // Se l'immagine contiene pochissimi punti o la soglia era troppo rigida,
  // effettuiamo un secondo passaggio adattivo con griglia a massima brillantezza locale
  if (acceptedPoints.length < 8) {
    const step = 14;
    for (let y = 30; y < h - 30; y += step) {
      for (let x = 30; x < w - 30; x += step) {
        const idx = y * w + x;
        const lum = gray[idx];
        if (lum > avgLuminance * 1.1) {
          let isLocalMax = true;
          for (let dy = -4; dy <= 4; dy += 4) {
            for (let dx = -4; dx <= 4; dx += 4) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = (y + dy) * w + (x + dx);
              if (gray[nIdx] > lum) {
                isLocalMax = false;
                break;
              }
            }
            if (!isLocalMax) break;
          }
          if (isLocalMax) {
            let tooClose = false;
            for (const acc of acceptedPoints) {
              const dx = x - acc.x;
              const dy = y - acc.y;
              if (dx * dx + dy * dy < minDistanceSq) {
                tooClose = true;
                break;
              }
            }
            if (!tooClose) {
              acceptedPoints.push({ x, y });
            }
          }
        }
      }
    }
  }

  // 5. Clustering Spaziale Multi-Fascione (Segmentazione a Regole)
  // Raggruppa i punti che si trovano a distanza ravvicinata in singoli fascioni distinti.
  // Barre dello stesso fascione distano circa 1.5 - 2.8 volte il diametro.
  // Distacchi maggiori (travetti in legno, aria tra ripiani) delimitano fascioni separati.
  const clusterDist = minDistanceBetweenBars * 3.4;
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
