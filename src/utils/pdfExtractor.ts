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
  destinationCantiere?: string;
  totalAmount: number;
  imponibile?: number;
  printedDocumentTotal?: number;
  summaryDescription?: string;
  rawText: string;
  items: {
    code?: string;
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
 * Parses Italian number format:
 * - "125,000" -> 125
 * - "1,000" -> 1
 * - "1,500" -> 1.5
 * - "0,806" -> 0.806
 * - "170,40" -> 170.4
 * - "1.250,50" -> 1250.5
 */
export function parseItalianNumber(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim().replace(/\s/g, '');
  if (!s) return 0;

  // Format: 1.250,50 with thousands dots and decimal comma
  if (/^[0-9]{1,3}(?:\.[0-9]{3})+,[0-9]+$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Format: 125,000 or 1,500 with comma as decimal
  if (/^[0-9]+,[0-9]+$/.test(s)) {
    return parseFloat(s.replace(',', '.'));
  }
  // Format: 125.000 or 1.500
  if (/^[0-9]+\.[0-9]+$/.test(s)) {
    return parseFloat(s);
  }
  return parseFloat(s) || 0;
}

/**
 * Extracts raw text from a PDF file preserving spatial line layouts.
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
      
      const validItems: any[] = (content.items as any[]).filter(item => item && typeof item.str === 'string');
      const hasTransform = validItems.length > 0 && validItems.every(it => Array.isArray(it.transform) && it.transform.length >= 6);

      if (hasTransform) {
        // Sort items by Y descending (top of page to bottom), then X ascending (left to right)
        const sorted = [...validItems].sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 3.5) return yDiff;
          return a.transform[4] - b.transform[4];
        });

        const lines: string[] = [];
        let currentLine: string[] = [];
        let currentY: number | null = null;

        for (const item of sorted) {
          const y = item.transform[5];
          if (currentY === null || Math.abs(y - currentY) <= 3.5) {
            currentLine.push(item.str);
            if (currentY === null) currentY = y;
          } else {
            lines.push(currentLine.join(' ').trim());
            currentLine = [item.str];
            currentY = y;
          }
        }
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' ').trim());
        }
        fullText += lines.filter(Boolean).join('\n') + '\n';
      } else {
        const pageText = validItems
          .map(item => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
    }

    return fullText;
  } catch (pdfError) {
    console.warn('PDF.js standard parse failed, attempting fallback text decoder:', pdfError);
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
 * Clean an extracted item name removing leading IVA rate, order refs, and code prefixes.
 */
function cleanItemName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[0-9]{1,2}\s+/, '') // leading IVA rate (e.g. "22 ")
    .replace(/^.*?(?:del\s+[0-9]{2}[\.\/][0-9]{2}[\.\/][0-9]{2,4}\s*)/i, '') // strip "Rif. BCV ... del DD.MM.YY"
    .replace(/^[A-Z0-9]*[0-9]+[A-Z0-9]*\s+/i, '') // strip leading article code with digits (e.g. "C20120", "I32702")
    .replace(/\s+[A-Z0-9]*[0-9]+[A-Z0-9]*$/i, '') // strip trailing article code with digits (e.g. "C00089")
    .trim();
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
  const numberPatterns = [
    /(?:numero\s+d\.?d\.?t\.?|d\.?d\.?t\.?\s*n\.?|bolla\s*n\.?)[\s\S]{0,50}?\b([A-Z0-9]{2,6}\s*\/\s*(?:20[2-3][0-9]\s*\/)?\s*[0-9]{1,8})\b/i,
    /(?:tipo,?\s*numero\s*e\s*data\s*documento|fattura(?:\s+di\s+vendita)?|d\.?d\.?t\.?|bolla(?:\s+di\s+accompagnamento|\s+di\s+consegna)?|documento(?:\s+di\s+trasporto)?)\s*(?:n\.?|num\.?|nr\.?|numero)?\s*[:.-]?\s*([0-9]{1,10}[A-Za-z0-9_\-\/]*)/i,
    /(?:n\.|nr\.|numero|num\.)\s*[:.-]?\s*([0-9]{1,10}[A-Za-z0-9_\-\/]*)/i,
    /([0-9]{1,8})\s+(?:del\s+)?[0-3][0-9][\/\.\-][0-1][0-9][\/\.\-](?:20[2-3][0-9])/,
    /(?:ddt|bolla)\s+([0-9]+[A-Za-z0-9_\-\/]*)/i,
  ];

  for (const regex of numberPatterns) {
    const match = rawText.match(regex) || clean.match(regex);
    if (match && match[1] && match[1].length >= 1 && match[1].length <= 25) {
      number = match[1].trim();
      break;
    }
  }

  // Fallback from filename
  if (!number && fileName) {
    const fileMatch = fileName.match(/(?:ddt|bolla|fattura|doc)[_\-\s]*([0-9]+[A-Za-z0-9_\-\/]*)/i);
    if (fileMatch) number = fileMatch[1];
  }
  if (!number) {
    number = 'DOC-' + Math.floor(100 + Math.random() * 900);
  }

  // 3. Detect Document Date
  let date = '';
  const datePatterns = [
    /(?:data\s+d\.?d\.?t\.?|data|del|emess[oa]\s+il|data\s+doc\.?)\s*[:.-]?\s*([0-3]?[0-9][\/\.\-][0-1]?[0-9][\/\.\-](?:20[2-3][0-9]))/i,
    /\b([0-3][0-9][\/\.\-][0-1][0-9][\/\.\-](?:20[2-3][0-9]))\b/,
  ];

  for (const regex of datePatterns) {
    const match = rawText.match(regex) || clean.match(regex);
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

  // 4. Detect Destination Cantiere (e.g. "DESTINAZIONE MERCE CANTIERE CUGNANA PORTO ROTONDO", "Da Consegnare a: CANTIERE VIA ALDO MORO")
  let destinationCantiere = '';
  const destMatch = rawText.match(/(?:destinazione\s+merce|da\s+consegnare\s+a|luogo\s+di\s+consegna|cantiere)\s*[:.-]?\s*([A-Za-z0-9\s,\.\-]{4,70}?)(?=\s+(?:porto|del|art|tipo|vettore|annotazioni|spett|\n\n|$))/i);
  if (destMatch && destMatch[1]) {
    destinationCantiere = destMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 5. Detect Supplier / Fornitore (Mittente)
  let supplier = '';
  // Check known brands or prominent company names
  const brandMatch = rawText.match(/\b(SARDARES(?:\s+S\.?p\.?A\.?)?|KERAKOLL|MAPEI|EDILIZIA\s+[A-Za-z]+)\b/i);
  if (brandMatch) {
    supplier = brandMatch[0].trim();
  }

  if (!supplier) {
    // Check explicit cedente / prestatore / fornitore
    const supplierMatches = rawText.match(/(?:cedente|prestatore|fornitore|ditta|emittente|ragione\s+sociale)\s*[:.-]?\s*([A-Za-z0-9\s&.,'\-]{3,60}?)(?=\s+(?:p\.?\s*iva|c\.?\s*f\.?|indirizzo|sede|via|tel|cap|s\.r\.l|spa|snc|\n|$))/i);
    if (supplierMatches && supplierMatches[1]) {
      supplier = supplierMatches[1].trim();
    }
  }

  if (!supplier) {
    // Check header section before "SPETT.LE" (so we do not pick the customer GP2 S.R.L.)
    const spettParts = rawText.split(/SPETT\.LE/i);
    const headerSection = spettParts[0] || rawText;
    const companyFormMatch = headerSection.match(/([A-Za-z0-9\s&.,'\-]{3,45}\s+(?:s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?n\.?c\.?|s\.?a\.?s\.?))/i);
    if (companyFormMatch && companyFormMatch[1]) {
      supplier = companyFormMatch[1].trim();
    }
  }

  if (!supplier && fileName) {
    const cleanName = fileName.replace(/\.pdf$/i, '').replace(/[_\-]+/g, ' ');
    supplier = cleanName.length > 3 ? cleanName.slice(0, 40) : 'Fornitore Edile';
  }
  if (!supplier) {
    supplier = 'Fornitore Materiali';
  }

  // 6. Detect Printed Document Totals directly from the page
  let printedDocumentTotal = 0;
  let imponibile = 0;

  // Search for printed Netto a pagare / Totale Fattura / Totale Bolla / Totale Documento
  const nettoMatch = rawText.match(/(?:netto\s*(?:a\s*pagare)?|totale\s*fattura|totale\s*documento|totale\s*bolla)[\s\S]{0,80}?\b([0-9]{1,5}[.,][0-9]{2})\b/i);
  if (nettoMatch) {
    printedDocumentTotal = parseItalianNumber(nettoMatch[1]);
  }

  // Detect Totale Merce Netto / Imponibile
  const impMatch = rawText.match(/(?:tot\.?\s*merce\s*netto|imponibile(?:\s+totale)?)\s*[:.]?\s*([0-9]{1,5}[.,][0-9]{2})/i);
  if (impMatch) {
    imponibile = parseItalianNumber(impMatch[1]);
  }

  // 7. Detect Material Items / Line Rows ("Spacchettamento")
  // Recognizes Italian construction measurement units: QL, Q.LI, Q, NR, PZ, KG, ML, MT, M, MC, M3, M2, MQ, LT, SACCHI, BANCALI, SET, ROTOLI, CONF, CF, PA, etc.
  const validUnits = 'KG|NR|PZ|ML|MC|M3|M2|MQ|LT|L|QL|Q\\.?LI|Q|SACCHI|BANCALI|MT|M|SET|ROTOLI|ROT|CONF|CF|PA|PZ\\.|NR\\.|MQ\\.|MC\\.';
  const items: ExtractedDocumentData['items'] = [];

  // Line-by-line scanning using spatial lines
  const lines = rawText.split('\n');

  // Pattern 1: [Optional Item Code] [Description] [Unit] [Qty] [Price] [Optional Discount] [Optional Total] [Optional VAT]
  const lineRegex1 = new RegExp(
    '^\\s*(?:([0-9]{1,2})\\s+)?(?:([A-Z0-9\\.\\-\\_]{3,30})\\s+)?(.{3,90}?)\\s+\\b(' +
    validUnits +
    ')\\b\\s+([0-9]+(?:[.,][0-9]{1,4})?)\\s+([0-9]+(?:[.,][0-9]{1,4})?)(?:\\s+([\\-0-9]+(?:[.,][0-9]+)?))?(?:\\s+([0-9]+(?:[.,][0-9]{1,2})?))?',
    'i'
  );

  // Pattern 2: [Optional Item Code] [Description] [Qty] [Unit] [Price] [Optional Discount] [Optional Total]
  const lineRegex2 = new RegExp(
    '^\\s*(?:([0-9]{1,2})\\s+)?(?:([A-Z0-9\\.\\-\\_]{3,30})\\s+)?(.{3,90}?)\\s+([0-9]+(?:[.,][0-9]{1,4})?)\\s+\\b(' +
    validUnits +
    ')\\b\\s+([0-9]+(?:[.,][0-9]{1,4})?)(?:\\s+([\\-0-9]+(?:[.,][0-9]+)?))?(?:\\s+([0-9]+(?:[.,][0-9]{1,2})?))?',
    'i'
  );

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(totale|iva|imponibile|descrizione|quantita|natura|articolo|prezzo|condizioni|causale|trasporto|vettore|spett|pag\\.|tipo|destinazione|indirizzo)/i.test(trimmed)) continue;

    let m = trimmed.match(lineRegex1);
    let isPattern1 = true;
    if (!m) {
      m = trimmed.match(lineRegex2);
      isPattern1 = false;
    }
    if (!m) continue;

    let code: string | undefined;
    let desc: string;
    let unit: string;
    let qty: number;
    let listPrice: number;
    let col7: string | undefined;
    let col8: string | undefined;

    if (isPattern1) {
      code = m[2];
      desc = m[3].trim().replace(/\s+/g, ' ');
      unit = m[4].toLowerCase();
      qty = parseItalianNumber(m[5]);
      listPrice = parseItalianNumber(m[6]);
      col7 = m[7];
      col8 = m[8];
    } else {
      code = m[2];
      desc = m[3].trim().replace(/\s+/g, ' ');
      qty = parseItalianNumber(m[4]);
      unit = m[5].toLowerCase();
      listPrice = parseItalianNumber(m[6]);
      col7 = m[7];
      col8 = m[8];
    }

    // Clean description: remove order refs like "Rif. BCV 14330 del 15.09.25"
    desc = desc.replace(/^.*?(?:del\s+[0-9]{2}[\.\/][0-9]{2}[\.\/][0-9]{2,4}\s*)/i, '').trim();

    if (desc.length < 3) continue;

    let rowImporto = 0;
    let finalUnitPrice = listPrice;

    if (col7 && col7.startsWith('-')) {
      // Sconto esplicito stampato (es. -28)
      if (col8 && parseItalianNumber(col8) > 0) {
        rowImporto = parseItalianNumber(col8);
        finalUnitPrice = parseFloat((rowImporto / (qty || 1)).toFixed(3));
      } else {
        const discPercent = Math.abs(parseItalianNumber(col7));
        rowImporto = parseFloat((qty * listPrice * (1 - discPercent / 100)).toFixed(2));
        finalUnitPrice = parseFloat((listPrice * (1 - discPercent / 100)).toFixed(3));
      }
    } else if (col7 && parseItalianNumber(col7) > 0) {
      // In assenza di colonna sconto, col7 è il totale effettivo di riga (es. 100,80)
      rowImporto = parseItalianNumber(col7);
      finalUnitPrice = listPrice;
    } else {
      rowImporto = parseFloat((qty * listPrice).toFixed(2));
    }

    if (qty > 0 && rowImporto > 0) {
      items.push({
        code,
        materialeName: desc,
        quantity: qty,
        unit,
        unitPrice: finalUnitPrice,
        totalPrice: rowImporto,
      });
    }
  }

  // Fallback: Layout 2 regex on whole text if line scanning matched nothing
  if (items.length === 0) {
    const layout2Regex = new RegExp(
      '(.{3,90}?)\\s+([0-9]+(?:[.,][0-9]+)?)\\s*\\b(' +
      validUnits +
      ')\\b(?:\\s*€?\\s*([0-9]+(?:[.,][0-9]+)?))?',
      'gi'
    );

    let match: RegExpExecArray | null;
    while ((match = layout2Regex.exec(clean)) !== null) {
      const nameCandidate = cleanItemName(match[1]);
      if (/^(totale|iva|subtotale|p\.iva|data|ddt|fattura|sconto|imponibile|quantita)/i.test(nameCandidate)) continue;
      if (nameCandidate.length < 3) continue;

      const qty = parseItalianNumber(match[2]);
      const unit = match[3].toLowerCase();
      let price = match[4] ? parseItalianNumber(match[4]) : 0;
      if (!price && printedDocumentTotal > 0 && items.length === 0) {
        price = parseFloat((printedDocumentTotal / (qty || 1)).toFixed(2));
      }
      const tot = parseFloat((qty * price).toFixed(2));

      if (qty > 0) {
        items.push({
          materialeName: nameCandidate.slice(0, 50),
          quantity: qty,
          unit: unit.replace('.', ''),
          unitPrice: price,
          totalPrice: tot,
        });
      }
    }
  }

  // Fallback: keyword search if still empty
  if (items.length === 0) {
    const commonMaterials = [
      'Cemento', 'Sabbia', 'Ghiaia', 'Calce', 'Mattoni', 'Tavole Abete', 'Ferro d.10', 'Ferro d.12',
      'Rete Elettrosaldata', 'Cartongesso', 'Guaina Ardesiata', 'Pittura Lavabile', 'Colla Piastrelle',
      'Tubi PVC', 'Pannelli EPS', 'Intonaco', 'Massetto', 'Laterizi', 'Guaina', 'Piastrelle',
    ];
    for (const mat of commonMaterials) {
      if (lower.includes(mat.toLowerCase())) {
        items.push({
          materialeName: mat,
          quantity: 1,
          unit: 'fornitura',
          unitPrice: printedDocumentTotal > 0 ? printedDocumentTotal : 100,
          totalPrice: printedDocumentTotal > 0 ? printedDocumentTotal : 100,
        });
        break;
      }
    }
  }

  if (items.length === 0) {
    items.push({
      materialeName: 'Materiali Edili da Bolla',
      quantity: 1,
      unit: 'fornitura',
      unitPrice: printedDocumentTotal > 0 ? printedDocumentTotal : 0,
      totalPrice: printedDocumentTotal > 0 ? printedDocumentTotal : 0,
    });
  }

  // Calculate sum of extracted items
  const itemsSum = parseFloat(items.reduce((acc, it) => acc + (it.totalPrice || it.quantity * it.unitPrice), 0).toFixed(2));

  // The value excl. VAT (imponibile / totale) must strictly be calculated by summing the detected line items
  let totalAmount = itemsSum > 0 ? itemsSum : (printedDocumentTotal > 0 ? printedDocumentTotal : 0);
  let finalImponibile = itemsSum > 0 ? itemsSum : (imponibile > 0 ? imponibile : printedDocumentTotal);

  // Generate a short, informative summary description of the materials
  const summaryDescription = items.map(it => `${it.materialeName} (${it.quantity} ${it.unit})`).join(', ');

  return {
    type: docType,
    number,
    date,
    supplier,
    destinationCantiere,
    totalAmount,
    imponibile: finalImponibile,
    printedDocumentTotal: printedDocumentTotal > 0 ? printedDocumentTotal : undefined,
    summaryDescription,
    rawText: rawText,
    items,
    confidence: {
      supplier: supplier !== 'Fornitore Materiali',
      number: !number.startsWith('DOC-'),
      date: date !== new Date().toISOString().split('T')[0],
      totalAmount: totalAmount > 0,
      items: items.length > 0,
    },
  };
}
