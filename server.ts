import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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
Il tuo compito è analizzare questa foto, scansione o documento di trasporto (Bolla, DDT, Fattura accompagnatoria, Ricevuta di consegna) di materiali edili.

ATTENZIONE FOTO DA SMARTPHONE / CANTIERE:
- L'immagine potrebbe essere ruotata di 90° o 180°, oppure fotografata con ombre, riflessi o pieghe della carta.
- Leggi attentamente tutte le sezioni: Intestazione fornitore (Cedente), Destinatario (Cessionario), Luogo di Destinazione / Cantiere di consegna, Numero e Data del DDT, Tabella articoli/materiali e Totale a piè di pagina.
- ESTRAI IL TOTALE UFFICIALE: prendi il Totale Documento / Totale Merce / Totale DDT presente sulla bolla senza forzature o ricalcoli arbitrari. Se è visibile la somma delle righe o l'imponibile, riportali con precisione.
- ESTRAI LA LISTA COMPLETA DEI MATERIALI: per ciascuna riga, estrai il nome preciso, quantità, unità di misura (es. ql, nr, m2, mc, kg, sacchi), prezzo unitario, sconti applicati se presenti, e l'importo totale della riga.
- CREA UNA BREVE DESCRIZIONE RIASSUNTIVA: una frase sintetica ma completa con i materiali principali e le quantità (es: "SABBIA FINE LAVATA 0/2 (16 ql), CEMENTO 32,5R 25kg (10 nr), INTOPREM N2X kg 25 (1 nr), CENUPREM FINO KG 25 (1 nr)").

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
  "vettore": "Nome del vettore/autista o annotazioni di ritiro se visibili (es. MARIO, ritirato 10:00)",
  "notes": "Eventuali annotazioni aggiuntive, causale trasporto, presenza firme"
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
                text: `${systemPrompt}\n\nNome file caricato: ${fileName}. Analizza l'immagine ed estrai il JSON.`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
          },
        });
      } else {
        response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `${systemPrompt}\n\nEcco il testo estratto dalla bolla/DDT:\n\n${text}`,
          config: {
            responseMimeType: 'application/json',
          },
        });
      }

      const responseText = response.text?.trim() || '{}';
      const parsedData = JSON.parse(responseText);

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

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
