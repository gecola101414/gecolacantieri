export const APP_VERSION = "2.8.2";
export const APP_BUILD = "20260921.1110";
export const APP_LAST_UPDATE_DATE = "21/09/2026";
export const APP_LAST_UPDATE_TIME = "11:10";
export const APP_LAST_UPDATE = "21/09/2026 ore 11:10";
export const APP_VERSION_STRING = "v2.8.2 (21/09/2026 11:10)";

export const APP_RELEASE_NOTES = [
  "Motore Visione Locale nel Browser (100% Offline a Regole): Riconoscimento geometrico basato su Fast Radial Symmetry Transform (FRST) e contrasto di luminanza delle teste di taglio senza dipendenza da API esterne",
  "Selettore Motore: possibilità di scegliere tra Motore Locale Browser (immediato e a costo zero) e Visione AI Neurale Cloud (Google Gemini)",
  "Regolazione Sensibilità in Tempo Reale: slider a 3 livelli (Bassa, Media, Alta) con ricalcolo immediato sulla foto senza ri-caricamento",
  "Ottimizzazione Vercel & Mobile: compressione automatica foto client-side sotto i 4.5MB per evitare errori 413 Payload Too Large",
  "Supporto routing flessibile Serverless per Vercel su /api/analyze-ferri con maxDuration esteso a 60s in vercel.json"
];
