// Utility per calcoli tecnici barre di ferro d'armatura (tondi B450C)
// e integrazione con inventario, bolle e schede di scarico cantiere.

import { MaterialDocument, Materiale, UserAccount } from '../types';

export interface FascioneRilevato {
  id_fascione: string;
  posizione: string;
  quantita_barre: number;
  diametro_mm: number;
  peso_stimato_kg: number;
  livello_confidenza: 'alta' | 'media' | 'bassa';
  box_percentuale?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  coordinate_punti?: Array<{
    x: number;
    y: number;
  }>;
}

export interface RiconoscimentoFerriResult {
  totale_ferri: number;
  numero_fascioni: number;
  peso_totale_kg: number;
  lunghezza_barre_metri: number;
  fascioni: FascioneRilevato[];
  qualita_foto: {
    illuminazione: 'buona' | 'sufficiente' | 'scarsa';
    note: string;
  };
  sintesi_tecnica?: string;
  cantiereId?: string;
  cantiereName?: string;
  dataRilievo?: string;
  operatore?: string;
  imageUrl?: string;
}

// Pesi lineari nominali standard UNI EN 10080 per barre di ferro B450C (kg/m)
export const PESI_LINEARI_FERRO: Record<number, number> = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  14: 1.208,
  16: 1.578,
  18: 1.998,
  20: 2.466,
  22: 2.984,
  24: 3.551,
  26: 4.168,
  28: 4.834,
  30: 5.549,
  32: 6.313,
};

export const DIAMETRI_DISPONIBILI = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];

export const LUNGHEZZE_DISPONIBILI = [6, 12, 14];

export function getPesoLineareFerro(diametro: number): number {
  return PESI_LINEARI_FERRO[diametro] || ((diametro / 2) ** 2 * Math.PI * 0.00785);
}

export function calcolaPesoFascione(quantita: number, diametro: number, lunghezzaMetri: number): number {
  const lineare = getPesoLineareFerro(diametro);
  return Math.round(quantita * lineare * lunghezzaMetri * 100) / 100;
}

// Crea una Bolla di Scarico / Trasporto automatica a partire dal rilievo ferri
export function generaBollaScaricoDaRilievo(
  rilievo: RiconoscimentoFerriResult,
  currentUser: UserAccount,
  cantiereId: string,
  cantiereName: string,
  fornitoreName: string = 'Acciaieria / Fornitore Ferro',
  prezzoAlKgMedio: number = 0.95
): MaterialDocument {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeCode = now.getTime().toString().slice(-5);
  const docNumber = `SCARICO-FERRO-${dateStr.replace(/-/g, '')}-${timeCode}`;

  const items = rilievo.fascioni.map((f, idx) => {
    const pesoKg = f.peso_stimato_kg || calcolaPesoFascione(f.quantita_barre, f.diametro_mm, rilievo.lunghezza_barre_metri);
    const totalPrice = Math.round(pesoKg * prezzoAlKgMedio * 100) / 100;

    return {
      code: `FE-B450C-D${f.diametro_mm}-L${rilievo.lunghezza_barre_metri}`,
      materialeId: `mat-fe-${f.diametro_mm}`,
      materialeName: `Ferro tondo B450C Ø${f.diametro_mm}mm (L=${rilievo.lunghezza_barre_metri}m) - ${f.id_fascione}`,
      quantity: pesoKg,
      unit: 'kg',
      unitPrice: prezzoAlKgMedio,
      totalPrice: totalPrice,
      destinationCantiereId: cantiereId,
      notes: `${f.quantita_barre} barre contate (${f.posizione}) - Confidenza: ${f.livello_confidenza}`
    };
  });

  const totaleValore = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    id: `doc-fe-${Date.now()}`,
    type: 'bolla',
    number: docNumber,
    date: dateStr,
    supplier: fornitoreName,
    items,
    status: 'in_attesa_accettazione',
    summaryDescription: `Rilievo fotografico AI: ${rilievo.totale_ferri} barre (${rilievo.numero_fascioni} fascioni, ${rilievo.peso_totale_kg.toLocaleString()} kg)`,
    acceptanceNote: `Scarico verificato con visione computerizzata AI da ${currentUser.name}. Totale: ${rilievo.totale_ferri} barre, peso stimato ${rilievo.peso_totale_kg} kg.`,
    totalAmount: Math.round(totaleValore * 1.22 * 100) / 100, // IVA inclusa 22%
    imponibile: Math.round(totaleValore * 100) / 100,
    documentTotalOriginal: Math.round(totaleValore * 1.22 * 100) / 100,
    destinationCantiereId: cantiereId,
    photoUrl: rilievo.imageUrl,
    createdAt: now.toISOString(),
  };
}

// Crea articoli materiale per l'inventario del cantiere
export function generaMaterialiDaRilievo(
  rilievo: RiconoscimentoFerriResult,
  cantiereId: string
): Materiale[] {
  // Raggruppa per diametro
  const diametriMap: Record<number, { count: number; pesoKg: number }> = {};

  rilievo.fascioni.forEach(f => {
    if (!diametriMap[f.diametro_mm]) {
      diametriMap[f.diametro_mm] = { count: 0, pesoKg: 0 };
    }
    diametriMap[f.diametro_mm].count += f.quantita_barre;
    diametriMap[f.diametro_mm].pesoKg += f.peso_stimato_kg;
  });

  return Object.entries(diametriMap).map(([diamStr, data]) => {
    const diam = Number(diamStr);
    return {
      id: `mat-fe-b450c-d${diam}-${cantiereId}`,
      name: `Ferro Tondo B450C Ø ${diam} mm (Barre ${rilievo.lunghezza_barre_metri}m)`,
      category: 'Ferro & Armature',
      unit: 'kg',
      currentStock: Math.round(data.pesoKg * 100) / 100,
      minStock: 500,
      assignedCantiereId: cantiereId,
      defaultPrice: 0.95,
      notes: `${data.count} barre rilevate da foto AI (tot. ${data.pesoKg.toLocaleString()} kg)`
    };
  });
}
