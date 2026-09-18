import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const app = express();

// Support high payload size for high-res photo uploads (photos from smartphones can be 5-15MB base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini client lazy initializer
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY non configurata sul server.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

function parseItalianNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    let s = val.replace(/[€$\sEUR]/gi, '').trim();
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
      if (s.indexOf('.') < s.indexOf(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// AI Multimodal OCR & Document Extraction for Bolle, DDT and Fatture
app.post('/api/analyze-bolla', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', text, fileName = 'documento' } = req.body;

    if (!imageBase64 && !text) {
      return res.status(400).json({ error: 'Nessuna immagine o testo fornito.' });
    }

    const ai = getGeminiClient();

    const systemPrompt = `Sei un esperto geometra e contabile di cantieri edili italiani.
Il tuo compito è analizzare il documento (Bolla, DDT, Fattura accompagnatoria di vendita, Ricevuta di consegna) di materiali edili (ad es. emesso da rivendite edili come SARDARES, BigMat, Kerakoll, Mapei, ecc.).

STRUTTURA TIPICA DELLE COLONNE NELLE FATTURE E BOLLE EDILI ITALIANE:
Tipicamente le righe articoli hanno queste colonne:
CODICE ITEMCODE | DESCRIZIONE DESCRIPTION | U.M. UNIT | QUANTITA' QUANTITY | PREZZO PRICE | SCONTO DISCOUNT | IMP. NETTO NET AMOUNT | IVA VAT

REGOLE TASSATIVE PER L'ESTRAZIONE DI OGNI RIGA ARTICOLO:
1. "code": Codice articolo se presente (es. "CEUC325025", "KEK07202", "WEB5200778823", "EEDSABBIA03").
2. "materialeName": Descrizione completa del materiale (es. "CEMENTO 32,5R 25kg", "H40 NO LIMITS 25 KG BIANCO").
3. "unit": Unità di misura (es. "nr", "ql", "kg", "pz", "m", "mc").
4. "quantity": Quantità numerica riportata (es. 15, 10, 5, 112, 1).
5. "unitPrice": PREZZO UNITARIO DI LISTINO riportato nella colonna PREZZO / PRICE (es. 9.45000 per il cemento, 31.45000 per H40, 25.14000 per Webertherm, 5.50000 per la sabbia).
6. "discount": SCONTO DI RIGA riportato nella colonna SCONTO / DISCOUNT (es. "-28%", "-22%", "-19%", "-40%", "-49%"). Riporta sempre la percentuale di sconto se presente nel documento (es. "-28%" o "28%"), oppure "" se non c'è sconto.
7. "totalPrice": IMPORTO NETTO TOTALE DELL'ARTICOLO riportato nella colonna IMP. NETTO / NET AMOUNT.
   ATTENZIONE CRUCIALE:
   * NON METTERE MAI IL PREZZO UNITARIO COME TOTALE DELL'ARTICOLO QUANDO LA QUANTITÀ È MAGGIORE DI UNO O QUANDO C'È UNO SCONTO!
   * Esempi reali:
     - CEMENTO: Q.tà 15, Prezzo Unitario 9.45, Sconto -28% -> "totalPrice" deve essere 102.06 (ovvero 15 * 9.45 * 0.72 = 102.06), NON 9.45!
     - H40 NO LIMITS: Q.tà 10, Prezzo Unitario 31.45, Sconto -22% -> "totalPrice" deve essere 245.31, NON 31.45!
     - WEBERTHERM AP60: Q.tà 5, Prezzo Unitario 25.14, Sconto -19% -> "totalPrice" deve essere 101.82, NON 25.14!
     - SABBIA LAVATA: Q.tà 112, Prezzo Unitario 5.50, Sconto -40% -> "totalPrice" deve essere 369.60, NON 5.50!
     - RACCORDO: Q.tà 3, Prezzo Unitario 4.675, Sconto 0% -> "totalPrice" deve essere 14.03, NON 4.68!
8. "vatRate": Aliquota IVA (es. "22%").

REGOLE PER IL TOTALE GENERALE DEL DOCUMENTO:
- "totalAmount" e "imponibile": Estrai il TOTALE IMPONIBILE / TAX BASE / TOTALE NETTO DEL DOCUMENTO SENZA IVA (come riportato nei riquadri di riepilogo in calce alla fattura, ad es. 3427.07 o 3416.75).

Restituisci ESCLUSIVAMENTE un JSON valido con questa struttura esatta:
{
  "supplier": "Nome del fornitore (es. SARDARES S.p.A.)",
  "type": "bolla" | "fattura" | "ddt",
  "number": "Numero documento (es. FVDO / 4149)",
  "date": "YYYY-MM-DD",
  "destinationCantiere": "Indirizzo o cantiere di destinazione (es. CUGNANA PORTO ROTONDO)",
  "totalAmount": 3427.07,
  "imponibile": 3427.07,
  "summaryDescription": "Sintesi dei materiali (es. Cemento, H40, Guaine, Raccordi)",
  "items": [
    {
      "code": "CEUC325025",
      "materialeName": "CEMENTO 32,5R 25kg",
      "unit": "nr",
      "quantity": 15.0,
      "unitPrice": 9.45,
      "discount": "-28%",
      "totalPrice": 102.06,
      "vatRate": "22%"
    }
  ],
  "vettore": "Nome vettore se presente",
  "notes": ""
}`;

    // Multi-model resilience: try primary model, fall back gracefully if 503/429
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        if (imageBase64) {
          const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: `${systemPrompt}\n\nNome file caricato: ${fileName}. Analizza il documento ed estrai il JSON completo.`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
            },
          });
        } else {
          response = await ai.models.generateContent({
            model: modelName,
            contents: `${systemPrompt}\n\nEcco il testo estratto dal documento PDF:\n\n${text}`,
            config: {
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
            },
          });
        }

        if (response && response.text) {
          break; // Success!
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed, trying next fallback:`, err.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Tutti i modelli AI sono momentaneamente non disponibili.');
    }

    const responseText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(responseText);

    // Map extracted items with strict math checks and discount preservation
    if (parsedData.items && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
      parsedData.items = parsedData.items.map((it: any) => {
        const qty = parseItalianNumber(it.quantity) || 1;
        let uPrice = parseItalianNumber(it.unitPrice);
        let lineTot = parseItalianNumber(it.totalPrice);
        let disc = it.discount ? String(it.discount).trim() : '';
        const vat = it.vatRate ? String(it.vatRate).trim() : '22%';

        // Extract numeric discount value if present (e.g. "-28%", "28%", "-28")
        let discountPercent = 0;
        if (disc) {
          const numMatch = disc.match(/([0-9]+(?:[.,][0-9]+)?)/);
          if (numMatch) {
            discountPercent = parseFloat(numMatch[1].replace(',', '.'));
            if (!disc.includes('%')) {
              disc = `${disc}%`;
            }
          }
        }

        // Mathematical safeguard:
        // 1. If unitPrice is 0 and lineTot > 0, deduce unitPrice
        if (uPrice === 0 && lineTot > 0) {
          if (qty > 0) {
            const undiscounted = discountPercent > 0 && discountPercent < 100 
              ? lineTot / (1 - discountPercent / 100) 
              : lineTot;
            uPrice = parseFloat((undiscounted / qty).toFixed(4));
          } else {
            uPrice = lineTot;
          }
        }

        // 2. If lineTot is 0 OR lineTot was mistakenly set equal to unitPrice when quantity > 1:
        // Recalculate the true net total!
        const isSuspiciousLineTot = lineTot === 0 || (qty > 1 && Math.abs(lineTot - uPrice) < 0.01);
        if (isSuspiciousLineTot && uPrice > 0) {
          const gross = qty * uPrice;
          lineTot = discountPercent > 0 
            ? parseFloat((gross * (1 - discountPercent / 100)).toFixed(2)) 
            : parseFloat(gross.toFixed(2));
        } else if (qty === 1 && discountPercent > 0 && Math.abs(lineTot - uPrice) < 0.01) {
          // If qty is 1 but discount was not applied to lineTot
          lineTot = parseFloat((uPrice * (1 - discountPercent / 100)).toFixed(2));
        }

        return {
          code: it.code ? String(it.code).trim() : '',
          materialeName: it.materialeName ? String(it.materialeName).trim() : 'Materiale',
          quantity: qty,
          unit: it.unit ? String(it.unit).trim().toLowerCase() : 'nr',
          unitPrice: uPrice,
          discount: disc,
          totalPrice: lineTot,
          vatRate: vat,
        };
      });
    }

    if (parsedData.totalAmount !== undefined) {
      parsedData.totalAmount = parseItalianNumber(parsedData.totalAmount);
    }
    if (parsedData.imponibile !== undefined) {
      parsedData.imponibile = parseItalianNumber(parsedData.imponibile);
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('API /api/analyze-bolla error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Errore durante l\'analisi con intelligenza artificiale.',
    });
  }
});

// Standalone server launcher (Cloud Run / Local Dev)
async function startServer() {
  const PORT = 3000;

  // Vite middleware setup (development) vs Static files (production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
