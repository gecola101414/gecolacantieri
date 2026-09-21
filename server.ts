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
Il tuo compito è analizzare il documento (Bolla, DDT, Fattura accompagnatoria di vendita, Ricevuta di consegna) di materiali edili.

REGOLE CRUCIALI DI ESTRAZIONE:
1. DISTINGUI TRA DESCRIZIONE E QUANTITÀ: Molti materiali hanno numeri nella descrizione (es. "KERAKOLL H40 25 KG"). Quel "25" fa parte del NOME, NON è la quantità. La quantità vera è in una colonna separata (es. 125,000).
2. PREZZO UNITARIO (CRITICO): Cerca sempre il prezzo unitario di riga (es. 0,806 o 0,90). Se la colonna PREZZO mostra un valore, estrailo come "unitPrice". NON ARROTONDARE A ZERO i prezzi piccoli. Se vedi "0,90" estrai 0.90, NON 0.
3. IMPORTO NETTO DI RIGA: È il valore totale della riga (es. 100,80). Deve corrispondere a (Quantità * Prezzo Unitario) - Sconto. Se la colonna IMPORTO mostra un valore, estrailo con precisione.
4. RIGHE VUOTE: Ignora le righe di solo testo descrittivo che non hanno quantità o prezzi.

REGOLE DI PRECISIONE:
* Se la descrizione dice "KG 25", è solo il formato del sacco. Guarda le altre colonne per la QUANTITÀ TOTALE (es. 125) e il PREZZO UNITARIO (es. 0,806).
* Il totale della riga (100,80) diviso la quantità (125) deve dare il prezzo unitario (0,806). Usa questa logica per verificare i dati.

STRUTTURA DELLE COLONNE:
Tipicamente: CODICE | DESCRIZIONE | U.M. | QUANTITÀ | PREZZO UNITARIO | SCONTO | IMPORTO NETTO | IVA

ESTRAZIONE JSON (REGOLE PER CAMPI):
- "code": Codice articolo.
- "materialeName": Descrizione completa (es. "KERAKOLL H40 NO LIMTS KG 25 BIANCA").
- "unit": Unità di misura (es. "KG", "NR", "ML").
- "quantity": Quantità numerica (es. 125.0).
- "unitPrice": Prezzo unitario (es. 0.806).
- "discount": Sconto (es. "" o "10%").
- "totalPrice": Importo netto totale della riga (es. 100.80).
- "vatRate": Aliquota IVA (es. "22%").

REGOLE MATEMATICHE:
* Se estrai Quantity 25 e Unit Price 0.806, il Total Price DEVE essere 20.15.
* Se il documento dice Total Price 100.80 e Quantity 125, allora il Prezzo Unitario è 0.806.
* Sii estremamente preciso con i decimali.

Restituisci ESCLUSIVAMENTE un JSON valido con questa struttura esatta:
{
  "supplier": "Nome del fornitore",
  "type": "bolla" | "fattura" | "ddt",
  "number": "Numero documento",
  "date": "YYYY-MM-DD",
  "destinationCantiere": "Cantiere di destinazione",
  "totalAmount": 207.89,
  "imponibile": 170.40,
  "summaryDescription": "Sintesi materiali",
  "items": [
    {
      "code": "C20120",
      "materialeName": "KERAKOLL H40 NO LIMTS KG 25 BIANCA",
      "unit": "KG",
      "quantity": 125.0,
      "unitPrice": 0.806,
      "discount": "",
      "totalPrice": 100.80,
      "vatRate": "22%"
    }
  ],
  "vettore": "Nome vettore",
  "notes": ""
}`;

    // Multi-model resilience: try primary model, fall back gracefully if 503/429
    const candidateModels = ['gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
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

// Linear weight table for B450C construction rebar (kg per linear meter)
const PESI_LINEARI_FERRO: Record<number, number> = {
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

function getPesoLineare(diametro: number): number {
  return PESI_LINEARI_FERRO[diametro] || ((diametro / 2) ** 2 * Math.PI * 0.00785);
}

// AI Computer Vision: Rebar & Steel Bundles Detection & Counting (Riconoscimento Ferri)
app.post('/api/analyze-ferri', async (req, res) => {
  try {
    const { 
      imageBase64, 
      mimeType = 'image/jpeg', 
      diametroSelezionato,
      lunghezzaMetri = 12,
      cantiereName = '',
      noteOperatore = ''
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nessuna fotografia fornita per il riconoscimento.' });
    }

    const ai = getGeminiClient();
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const systemPrompt = `Sei un modulo di Visione Computazionale avanzato integrato in un software professionale per la Gestione Cantieri e Inventario Materiali Edili (CantieriCloud Pro).

OBIETTIVO:
Analizzare la foto frontale ad alta risoluzione fornita dall'operatore di cantiere, individuare i fascioni di ferri d'armatura (tondi per cemento armato B450C) ed eseguire il conteggio preciso delle barre visibili sfruttando la lucentezza metallica e il contrasto delle teste di taglio del ferro tagliato rispetto al resto dello sfondo.

ISTRUZIONI DI ANALISI:
1. RILEVAMENTO FASCIONI: Segmenta l'immagine identificando i singoli fascioni o lotti di barre presenti (es. distinguendo per livello superiore/inferiore, sinistra/destra, oppure fascione singolo).
2. CONTEGGIO TESTE DI TAGLIO: Identifica le sezioni trasversali circolari delle barre sfruttando il contrasto cromatico e i riflessi luminosi sulle teste di taglio lucide (che appaiono come pixel/cerchietti chiari e brillanti).
3. CONTEGGIO PUNTUALE: Conta ogni singolo cerchio/punto luminoso corrispondente a una barra all'interno di ciascun fascione.
4. GESTIONE OMBRE/COPERTURE: Se alcune barre sono parzialmente coperte o in ombra, stima il conteggio in base alla densità della sezione e indica un livello di confidenza ("alta", "media", "bassa").
5. PARAMETRI AGGIUNTIVI FORNITI DALL'OPERATORE:
   - Diametro impostato dall'operatore: ${diametroSelezionato ? diametroSelezionato + ' mm' : 'Non specificato (stima tu il diametro nominale più probabile tra 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32 mm)'}
   - Lunghezza barre nominale: ${lunghezzaMetri} metri
   - Cantiere: ${cantiereName || 'Cantiere generale'}
   - Note operatore: ${noteOperatore || 'Nessuna'}

6. CALCOLO PESO:
   Calcola il peso teorico in kg in base al diametro (in mm) e alla lunghezza (${lunghezzaMetri} metri):
   Peso barra = peso_unitario_kg_m * ${lunghezzaMetri} metri
   Peso fascione = quantita_barre * Peso barra
   Tabella pesi unitari: Ø6=0.222, Ø8=0.395, Ø10=0.617, Ø12=0.888, Ø14=1.208, Ø16=1.578, Ø18=1.998, Ø20=2.466, Ø22=2.984, Ø24=3.551, Ø26=4.168, Ø28=4.834, Ø30=5.549, Ø32=6.313 kg/m.

7. COORDINATE DEI PUNTI PER VERIFICA VISIVA:
   Per ciascun fascione, fornisci un box percentuale stimato (x, y, width, height in % da 0 a 100) e un elenco di coordinate percentuali (x, y da 0 a 100 rispetto all'immagine) che corrispondono alle teste delle barre contate (puoi includere fino a 250 coordinate significative per fascione per consentire all'app di disegnare i pallini luminosi sopra la foto).

FORMATO DI RISPOSTA:
Restituisci la risposta ESCLUSIVAMENTE in formato JSON valido, senza testo aggiuntivo prima o dopo, mantenendo la seguente struttura:
{
  "totale_ferri": 0,
  "numero_fascioni": 0,
  "peso_totale_kg": 0,
  "lunghezza_barre_metri": ${lunghezzaMetri},
  "fascioni": [
    {
      "id_fascione": "Fascione 1",
      "posizione": "Descrizione sintetica (es. Livello superiore - Sinistra)",
      "quantita_barre": 0,
      "diametro_mm": 12,
      "peso_stimato_kg": 0,
      "livello_confidenza": "alta|media|bassa",
      "box_percentuale": {
        "x": 10.5,
        "y": 15.0,
        "width": 35.0,
        "height": 40.0
      },
      "coordinate_punti": [
        { "x": 12.5, "y": 18.2 }
      ]
    }
  ],
  "qualita_foto": {
    "illuminazione": "buona|sufficiente|scarsa",
    "note": "Eventuali annotazioni su ombre o sfocature che riducono la precisione"
  },
  "sintesi_tecnica": "Breve commento tecnico di riscontro sul carico per la scheda di cantiere"
}`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
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
                text: systemPrompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
          },
        });

        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed for /api/analyze-ferri:`, err.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Nessuna risposta valida generata dal modello di visione.');
    }

    let parsedData: any;
    try {
      const cleanJson = response.text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('Failed to parse JSON response from Gemini:', response.text);
      throw new Error('La risposta dell\'intelligenza artificiale non contiene un JSON valido.');
    }

    // Mathematical verification and recalculation of weights and totals
    const nominalLength = Number(lunghezzaMetri) || 12;
    let computedTotalFerri = 0;
    let computedTotalWeight = 0;

    if (Array.isArray(parsedData.fascioni)) {
      parsedData.fascioni = parsedData.fascioni.map((f: any, idx: number) => {
        const qty = parseInt(f.quantita_barre, 10) || 0;
        const diam = Number(diametroSelezionato) || Number(f.diametro_mm) || 12;
        const pesoLineare = getPesoLineare(diam);
        const pesoFascione = Math.round(qty * pesoLineare * nominalLength * 100) / 100;

        computedTotalFerri += qty;
        computedTotalWeight += pesoFascione;

        return {
          id_fascione: f.id_fascione || `Fascione ${idx + 1}`,
          posizione: f.posizione || `Lotto ${idx + 1}`,
          quantita_barre: qty,
          diametro_mm: diam,
          peso_stimato_kg: pesoFascione,
          livello_confidenza: f.livello_confidenza || 'alta',
          box_percentuale: f.box_percentuale || undefined,
          coordinate_punti: Array.isArray(f.coordinate_punti) ? f.coordinate_punti : [],
        };
      });
    } else {
      parsedData.fascioni = [];
    }

    parsedData.totale_ferri = computedTotalFerri > 0 ? computedTotalFerri : (parseInt(parsedData.totale_ferri, 10) || 0);
    parsedData.numero_fascioni = parsedData.fascioni.length || parseInt(parsedData.numero_fascioni, 10) || 1;
    parsedData.peso_totale_kg = Math.round(computedTotalWeight * 100) / 100;
    parsedData.lunghezza_barre_metri = nominalLength;

    if (!parsedData.qualita_foto) {
      parsedData.qualita_foto = {
        illuminazione: 'buona',
        note: 'Foto nitida con buona distinzione delle sezioni trasversali.',
      };
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('API /api/analyze-ferri error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Errore durante l\'analisi del ferro con visione computazionale.',
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
