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

// Helper for resilient Gemini API calls with automatic retry and model fallback
async function generateContentWithRetry(ai: GoogleGenAI, params: any) {
  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini API call failed with model ${model} (attempt ${attempt + 1}):`, err?.message || err);
        const status = err?.status || err?.code;
        if (status === 503 || status === 429 || status === 500 || (err?.message && err.message.includes('503'))) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        } else {
          break;
        }
      }
    }
  }
  throw lastError;
}

// Helper to safely parse potentially truncated JSON responses
function parseJsonSafely(rawStr: string): any {
  let cleaned = rawStr.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    console.warn('JSON parsing failed, attempting repair of truncated JSON stream...', firstErr);

    // Try finding the last completed object in items array
    const lastObjectEnd = cleaned.lastIndexOf('}');
    if (lastObjectEnd > 0) {
      let snippet = cleaned.substring(0, lastObjectEnd + 1);
      
      // Close open arrays and objects if missing
      if (!snippet.endsWith(']}')) {
        if (!snippet.endsWith(']')) snippet += ']';
        if (!snippet.endsWith('}')) snippet += '}';
      }

      try {
        return JSON.parse(snippet);
      } catch (e2) {
        // Try trimming to last comma before last object
        const lastComma = snippet.lastIndexOf('},');
        if (lastComma > 0) {
          const cutSnippet = snippet.substring(0, lastComma + 1) + ']}';
          try {
            return JSON.parse(cutSnippet);
          } catch (e3) {
            // Fallthrough
          }
        }
      }
    }

    throw firstErr;
  }
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
Il tuo compito è analizzare il testo estratto da un documento PDF (Bolla, DDT, Fattura accompagnatoria, Ricevuta di consegna) di materiali edili.

REGOLE TASSATIVE PER L'ANALISI PDF MULTI-PAGINA:
1. ESTRAI TUTTI GLI ARTICOLI / MATERIALI: Leggi attentamente tutte le pagine del documento. NON OMETTERE O SALTARE NESSUN ARTICOLO O RIGA, anche se il documento si sviluppa su 2, 3, 5 o più pagine con 50 o 100+ articoli. Includi ciascuna riga nel vettore "items".
2. INTESTAZIONE E CANTIERI: Rileva con precisione il Fornitore (Cedente), Destinatario (Cessionario), Cantiere di consegna / Destinazione, Numero Documento e Data.
3. TOTALE IVA ESCLUSA (IMPONIBILE): Calcola "totalAmount" e "imponibile" come ESATTAMENTE la somma degli importi totali di tutte le righe articoli estratte ("items").
4. REGOLA TASSATIVA ED ESCLUSIVA SUI PREZZI E QUANTITÀ:
   - PER "totalPrice", DEVI LEGGERE ESCLUSIVAMENTE L'IMPORTO FINALE NETTO DELLA RIGA (situato nell'ULTIMA COLONNA A DESTRA della riga del documento, ad es. "Importo Netto", "Totale Riga", "Importo Finale").
   - NON GUARDARE E NON LEGGERE MAI IL PREZZO DI LISTINO O IL PREZZO UNITARIO INIZIALE stampato a sinistra della colonna sconti!
   - NON MOLTIPLICARE MAI "Quantità * Prezzo Listino"! Se sul documento c'è un prezzo di listino di 9.45 e uno sconto del 20%, il prezzo finale netto nella colonna di destra sarà ad esempio 113.40. Prendi SEMPRE e SOLTANTO il valore dell'ULTIMA COLONNA A DESTRA per "totalPrice".
   - "unitPrice" NON DEVE ESSERE LETTO DAL DOCUMENTO. L'applicazione lo calcolerà automaticamente dividendo totalPrice / quantity.

Restituisci ESCLUSIVAMENTE un JSON valido con questa struttura esatta:
{
  "supplier": "Nome completo del fornitore (es. SARDARES S.p.A., ITALCEMENTI, BETONVAL)",
  "type": "bolla" | "fattura" | "ddt",
  "number": "Numero identificativo completo del documento (es. BC04/2026/16804, DDT 124/26)",
  "date": "Data del documento nel formato AAAA-MM-GG (YYYY-MM-DD)",
  "destinationCantiere": "Cantiere o indirizzo di destinazione specificato nella bolla (es. CANTIERE CUGNANA, PORTO ROTONDO)",
  "totalAmount": 132.08,
  "imponibile": 132.08,
  "summaryDescription": "Breve frase riassuntiva dei materiali consegnati con quantità",
  "items": [
    {
      "code": "codice articolo se presente (es. EEDSABBIA02)",
      "materialeName": "Nome completo e chiaro del materiale (es. SABBIA FINE LAVATA 0/2)",
      "quantity": 16.0,
      "unit": "ql",
      "unitPrice": 4.40,
      "discount": "-21%",
      "totalPrice": 55.62
    }
  ],
  "vettore": "Nome del vettore/autista o annotazioni di ritiro se visibili",
  "notes": "Eventuali annotazioni aggiuntive"
}`;

    let response;

    if (imageBase64) {
      // Strip data:image/...;base64, prefix if present
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

      response = await generateContentWithRetry(ai, {
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
      response = await generateContentWithRetry(ai, {
        contents: `${systemPrompt}\n\nEcco il testo estratto dalla bolla/DDT/Fattura PDF:\n\n${text}`,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      });
    }

    const responseText = response.text?.trim() || '{}';
    const parsedData = parseJsonSafely(responseText);

    // Force items to have net totalPrice as primary ground truth, and calculate net unitPrice as ratio
    if (parsedData.items && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
      let totalItemsSum = 0;
      parsedData.items = parsedData.items.map((it: any) => {
        const qty = Number(it.quantity) || 1;
        let lineTot = Number(it.totalPrice) || 0;
        if (lineTot <= 0 && Number(it.unitPrice) > 0) {
          lineTot = qty * Number(it.unitPrice);
        }
        lineTot = parseFloat(lineTot.toFixed(2));
        totalItemsSum += lineTot;
        const netUnitPrice = qty > 0 ? parseFloat((lineTot / qty).toFixed(4)) : (Number(it.unitPrice) || 0);
        return {
          ...it,
          quantity: qty,
          unitPrice: netUnitPrice,
          totalPrice: lineTot,
        };
      });

      if (totalItemsSum > 0) {
        parsedData.totalAmount = parseFloat(totalItemsSum.toFixed(2));
        parsedData.imponibile = parseFloat(totalItemsSum.toFixed(2));
      }
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
