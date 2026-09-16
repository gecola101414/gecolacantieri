import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF worker for browser
if (typeof window !== 'undefined') {
  try {
    // Set worker from reliable CDN matching installed pdfjs-dist or unpkg
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('Could not set workerSrc for pdfjsLib:', err);
  }
}

export interface ExtractedDocumentData {
  type: 'bolla' | 'fattura';
  number: string;
  date: string;
  supplier: string;
  totalAmount: number;
  rawText: string;
  items: {
    materialeName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  confidence: {
    supplier: boolean;
    number: boolean;
    date: boolean;
    totalAmount: boolean;
    items: boolean;
  };
}

/**
 * Extracts raw text from a PDF file using browser-native pdfjs-dist.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (pdfError) {
    console.warn('PDF.js standard parse failed, attempting fallback text decoder:', pdfError);
    // Fallback: search for printable stream chunks in raw bytes if standard worker failed
    const textDecoder = new TextDecoder('latin1');
    const rawString = textDecoder.decode(arrayBuffer);
    const matches = rawString.match(/\(([^()]{3,100})\)\s*Tj/g) || [];
    if (matches.length > 0) {
      return matches.map(m => m.replace(/^Tj|\(|\)/g, '').trim()).join(' ');
    }
    return '';
  }
}

/**
 * Parses raw Italian text from a DDT or invoice and extracts key commercial metadata.
 */
export function parseBollaOrFatturaText(rawText: string, fileName?: string): ExtractedDocumentData {
  const clean = rawText.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();

  // 1. Detect Document Type
  const isFattura = lower.includes('fattura') || lower.includes('invoice') || lower.includes('nota di debito');
  const docType: 'bolla' | 'fattura' = isFattura ? 'fattura' : 'bolla';

  // 2. Detect Document Number
  let number = '';
  // Patterns like "D.D.T. n. 123", "Bolla n. 45/A", "Doc. n. 789", "Fattura n. 1024"
  const numberPatterns = [
    /(?:d\.?d\.?t\.?|bolla(?:\s+di\s+accompagnamento|\s+di\s+consegna)?|documento(?:\s+di\s+trasporto)?|fattura)\s*(?:n\.?|num\.?|nr\.?|numero)?\s*[:.-]?\s*([0-9]+[A-Za-z0-9_\-\/]*)/i,
    /(?:n\.|nr\.|numero|num\.)\s*[:.-]?\s*([0-9]{1,10}[A-Za-z0-9_\-\/]*)/i,
    /(?:ddt|bolla)\s+([0-9]+[A-Za-z0-9_\-\/]*)/i,
  ];

  for (const regex of numberPatterns) {
    const match = clean.match(regex);
    if (match && match[1] && match[1].length >= 1 && match[1].length <= 25) {
      number = match[1].trim();
      break;
    }
  }

  // Fallback from filename (e.g. "DDT_145_Calce.pdf")
  if (!number && fileName) {
    const fileMatch = fileName.match(/(?:ddt|bolla|fattura|doc)[_\-\s]*([0-9]+[A-Za-z0-9_\-\/]*)/i);
    if (fileMatch) number = fileMatch[1];
  }
  if (!number) {
    number = 'DDT-' + Math.floor(100 + Math.random() * 900);
  }

  // 3. Detect Document Date
  let date = '';
  // Formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const datePatterns = [
    /(?:data|del|emess[oa]\s+il|data\s+doc\.?)\s*[:.-]?\s*([0-3]?[0-9][\/\.\-][0-1]?[0-9][\/\.\-](?:20[2-3][0-9]))/i,
    /\b([0-3][0-9][\/\.\-][0-1][0-9][\/\.\-](?:20[2-3][0-9]))\b/,
  ];

  for (const regex of datePatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const parts = match[1].split(/[\/\.\-]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        date = `${year}-${month}-${day}`;
        break;
      }
    }
  }

  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  // 4. Detect Supplier / Fornitore
  let supplier = '';
  const supplierMatches = clean.match(/(?:cedente|prestatore|fornitore|ditta|spett\.le|emittente|ragione\s+sociale)\s*[:.-]?\s*([A-Za-z0-9\s&.,'\-]{3,60}?)(?=\s+(?:p\.?\s*iva|c\.?\s*f\.?|indirizzo|sede|via|tel|cap|s\.r\.l|spa|snc))/i);
  if (supplierMatches && supplierMatches[1]) {
    supplier = supplierMatches[1].trim();
  } else {
    // Look for typical Italian company forms: "XYZ S.r.l.", "ABC SpA", "Edilizia Rossi Snc"
    const companyFormMatch = clean.match(/([A-Za-z0-9\s&.,'\-]{3,45}\s+(?:s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?))/i);
    if (companyFormMatch && companyFormMatch[1]) {
      supplier = companyFormMatch[1].trim();
    }
  }

  if (!supplier && fileName) {
    const cleanName = fileName.replace(/\.pdf$/i, '').replace(/[_\-]+/g, ' ');
    supplier = cleanName.length > 3 ? cleanName.slice(0, 40) : 'Fornitore Edile';
  }
  if (!supplier) {
    supplier = 'Fornitore da Verificare';
  }

  // 5. Detect Total Amount
  let totalAmount = 0;
  const totalPatterns = [
    /(?:totale\s*(?:documento|fattura|bolla|da\s+pagare|netto|a\s+pagare|complessivo|generale)?|importo\s*totale|totale\s*€)\s*[:.]?\s*€?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/i,
    /(?:€|eur)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/i,
    /([0-9]{1,4}(?:[.,][0-9]{2}))\s*(?:€|euro)/i,
  ];

  for (const regex of totalPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0 && val < 10000000) {
        totalAmount = val;
        break;
      }
    }
  }

  // 6. Detect Material Items / Line Rows ("Spacchettamento")
  // Recognize common building materials and measurement units
  const commonMaterials = [
    'Cemento', 'Sabbia', 'Ghiaia', 'Calce', 'Mattoni', 'Tavole Abete', 'Ferro d.10', 'Ferro d.12',
    'Rete Elettrosaldata', 'Cartongesso', 'Guaina Ardesiata', 'Pittura Lavabile', 'Colla Piastrelle',
    'Tubi PVC', 'Pannelli EPS', 'Intonaco', 'Massetto', 'Laterizi', 'Guaina', 'Piastrelle',
    'Legname', 'Blocchi Cemento', 'Travetti', 'Isolante Termico'
  ];

  const items: ExtractedDocumentData['items'] = [];

  // Match lines with unit and quantity, e.g., "Cemento 32.5 R - 50 q.li - 12.50" or regex tokens
  const lineTokenRegex = /([A-Za-z0-9\s\-]{3,40}?)\s+([0-9]+(?:[.,][0-9]+)?)\s*(mc|m3|kg|q\.?li|q|sacchi|bancali|pz|nr|mt|m|lt)\b(?:\s*€?\s*([0-9]+(?:[.,][0-9]+)?))?/gi;
  let tokenMatch;
  while ((tokenMatch = lineTokenRegex.exec(clean)) !== null) {
    const nameCandidate = tokenMatch[1].trim();
    // Skip if name is purely noise like "Totale" or "P.IVA"
    if (/^(totale|iva|subtotale|p\.iva|data|ddt|fattura|sconto|imponibile)/i.test(nameCandidate)) continue;
    if (nameCandidate.length < 3) continue;

    const qty = parseFloat(tokenMatch[2].replace(',', '.'));
    const unit = tokenMatch[3].toLowerCase();
    let price = tokenMatch[4] ? parseFloat(tokenMatch[4].replace(',', '.')) : 0;
    if (!price && totalAmount > 0 && items.length === 0) {
      price = parseFloat((totalAmount / (qty || 1)).toFixed(2));
    }
    const tot = parseFloat((qty * price).toFixed(2));

    items.push({
      materialeName: nameCandidate.slice(0, 45),
      quantity: qty || 1,
      unit: unit.replace('.', ''),
      unitPrice: price,
      totalPrice: tot,
    });

    if (items.length >= 8) break; // Keep first realistic lines
  }

  // If no detailed table rows were matched, search for building material keywords in text
  if (items.length === 0) {
    for (const mat of commonMaterials) {
      if (lower.includes(mat.toLowerCase())) {
        items.push({
          materialeName: mat,
          quantity: 10,
          unit: 'pz',
          unitPrice: totalAmount > 0 ? parseFloat((totalAmount / 10).toFixed(2)) : 15,
          totalPrice: totalAmount > 0 ? totalAmount : 150,
        });
        if (items.length >= 3) break;
      }
    }
  }

  // Fallback: generic item if document is valid
  if (items.length === 0) {
    items.push({
      materialeName: 'Materiali Edili da Bolla',
      quantity: 1,
      unit: 'fornitura',
      unitPrice: totalAmount > 0 ? totalAmount : 0,
      totalPrice: totalAmount > 0 ? totalAmount : 0,
    });
  }

  // Re-calculate totalAmount if it was 0 but item totals exist
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((acc, it) => acc + (it.totalPrice || it.quantity * it.unitPrice), 0);
  }

  return {
    type: docType,
    number,
    date,
    supplier,
    totalAmount,
    rawText: clean.slice(0, 2000),
    items,
    confidence: {
      supplier: supplier !== 'Fornitore da Verificare',
      number: !number.startsWith('DDT-'),
      date: date !== new Date().toISOString().split('T')[0],
      totalAmount: totalAmount > 0,
      items: items.length > 0,
    },
  };
}
