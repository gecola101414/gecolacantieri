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

// AI Multimodal OCR & Document Extraction for Bolle, DDT and Fatture
app.post('/api/analyze-bolla', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', text, fileName = 'documento' } = req.body;

    if (!imageBase64 && !text) {
      return res.status(400).json({ error: 'Nessuna immagine o testo fornito.' });
    }

    const ai = getGeminiClient();

    const systemPrompt = `Sei un esperto geometra e contabile di cantieri edili italiani.
Il tuo compito è analizzare il testo o l'immagine di un documento (Bolla, DDT, Fattura accompagnatoria, Ricevuta di consegna) di materiali edili.

REGOLE TASSATIVE E MASTER PER L'ANALISI DEI DATI IN BOLLA / FATTURA:
1. RILEVAZIONE DELLE COLONNE DI RIGA (ESTRAI SOLTANTO I DATI DIRETTI RILEVATI DALLA BOLLA/FATTURA, SENZA FARE NESSUNA OPERAZIONE NÉ DI SOMMA NÉ DI MOLTIPLICAZIONE):
   - "code": CODICE / ITEMCODE articolo se presente sul documento (es. "EEDSABBIA02").
   - "materialeName": DESCRIZIONE / DESCRIPTION completa del materiale.
   - "unit": U.M. / UNIT di misura (es. "ql", "mc", "pz", "kg", "m").
   - "quantity": QUANTITA' / QUANTITY riportata sul documento.
   - "unitPrice": PREZZO / PRICE unitario riportato sulla colonna del documento.
   - "discount": SCONTO / DISCOUNT di riga (es. "10%", "5%+3%", "15" o "" se assente).
   - "totalPrice": IMP. NETTO / NET AMOUNT (l'importo totale netto di riga situato nell'ultima colonna prima dell'IVA).
   - "vatRate": IVA / VAT (aliquota o importo IVA di riga es. "22%", "10%", "0%").

   ATTENZIONE: NON fare alcuna operazione matematica, moltiplicazione o applicazione di sconti sulle righe. Registra esattamente i valori scritti nelle colonne del documento.

2. TOTALE GENERALE DEL DOCUMENTO (TOTALE IMPONIBILE / TAX BASE / SENZA IVA):
   - "totalAmount" e "imponibile": PRENDI SEMPRE E DIRETTAMENTE IL TOTALE DEL DOCUMENTO SENZA IVA (come riportato nel riquadro 'TOTALE IMPONIBILE - TAX BASE', 'TOTALE SENZA IVA' o 'TAX FREE' in calce al documento, es. EUR 3.427,07).
   - NON fare MAI operazioni di somma delle righe per calcolare il totale. Il totale del documento dev'essere esattamente quello stampato nel box del totale imponibile / senza IVA del documento.

Restituisci ESCLUSIVAMENTE un JSON valido con questa struttura esatta:
{
  "supplier": "Nome completo del fornitore",
  "type": "bolla" | "fattura" | "ddt",
  "number": "Numero documento",
  "date": "YYYY-MM-DD",
  "destinationCantiere": "Cantiere o indirizzo di destinazione",
  "totalAmount": 3427.07,
  "imponibile": 3427.07,
  "summaryDescription": "Sintesi materiali",
  "items": [
    {
      "code": "codice articolo (es. EEDSABBIA02)",
      "materialeName": "Descrizione materiale (es. SABBIA FINE LAVATA 0/2)",
      "quantity": 16.0,
      "unit": "ql",
      "unitPrice": 3.48,
      "discount": "10%",
      "totalPrice": 55.62,
      "vatRate": "22%"
    }
  ],
  "vettore": "Nome del vettore se visibile",
  "notes": "Eventuali annotazioni"
}`;

    let response;

    if (imageBase64) {
      // Strip data:image/...;base64, prefix if present
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
        model: 'gemini-3.6-flash',
        contents: `${systemPrompt}\n\nEcco il testo estratto dalla bolla/DDT/Fattura PDF:\n\n${text}`,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      });
    }

    const responseText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(responseText);

    // Map extracted items preserving all raw columns without altering unitPrice, discount, totalPrice or calculating sums
    if (parsedData.items && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
      parsedData.items = parsedData.items.map((it: any) => {
        const qty = Number(it.quantity) || 0;
        const uPrice = Number(it.unitPrice) || 0;
        const lineTot = Number(it.totalPrice) || 0;
        const disc = it.discount ? String(it.discount).trim() : '';
        return {
          code: it.code ? String(it.code).trim() : '',
          materialeName: it.materialeName ? String(it.materialeName).trim() : 'Materiale',
          quantity: qty,
          unit: it.unit ? String(it.unit).trim() : 'pz',
          unitPrice: uPrice,
          discount: disc,
          totalPrice: lineTot,
        };
      });
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
