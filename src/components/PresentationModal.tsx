import React, { useState } from 'react';
import { 
  Building2, HardHat, Box, Fuel, DollarSign, Smartphone, MessageSquare, 
  FolderArchive, Share2, Cloud, ChevronRight, ChevronLeft, X, Sparkles, CheckCircle2, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Slide {
  number: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  bgGradient: string;
  badgeColor: string;
  description: string;
  bullets: string[];
}

const slides: Slide[] = [
  {
    number: 1,
    title: "Benvenuto in CantieriCloud Pro",
    subtitle: "Piattaforma Gestionale per l'Impresa Edile 4.0",
    icon: <Globe className="w-10 h-10 text-amber-400" />,
    bgGradient: "from-amber-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    description: "Soluzione cloud all-in-one pensata per connettere in tempo reale l'ufficio con i cantieri operativi e i cellulari della squadra.",
    bullets: [
      "Accesso multi-utente per Amministrazione, Tecnici e Operatori",
      "Sincronizzazione istantanea dei dati su Cloud Firebase",
      "Interfaccia ottimizzata sia per Desktop che per Smartphone"
    ]
  },
  {
    number: 2,
    title: "Gestione Cantieri & Hub di Controllo",
    subtitle: "Tutti i tuoi cantieri sotto controllo",
    icon: <Building2 className="w-10 h-10 text-blue-400" />,
    bgGradient: "from-blue-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    description: "L'Hub Cantiere raccoglie tutte le informazioni essenziali del cantiere in un unico pannello chiaro e reattivo.",
    bullets: [
      "Stato avanzamento lavori e localizzazione sulla mappa",
      "Storico cronologico di tutti i rapportini emessi",
      "Assegnazione immediata del personale e dei mezzi legati al cantiere"
    ]
  },
  {
    number: 3,
    title: "Presenze, Personale & Rapportini",
    subtitle: "Rapportini giornalieri in 30 secondi",
    icon: <HardHat className="w-10 h-10 text-emerald-400" />,
    bgGradient: "from-emerald-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    description: "Gli operatori in cantiere compilano i rapportini direttamente da cellulare, anche in modalità offline.",
    bullets: [
      "Registrazione ore lavorate, straordinari e trasferte",
      "Tracciabilità giorno per giorno senza dimenticanze",
      "Validazione ed eventuale storno controllato da parte dell'amministratore"
    ]
  },
  {
    number: 4,
    title: "Bolle, Materiali & AI Scanner",
    subtitle: "Scansione intelligente dei documenti",
    icon: <Box className="w-10 h-10 text-orange-400" />,
    bgGradient: "from-orange-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    description: "Fotografa la bolla cartacea: l'Intelligenza Artificiale legge fornitore, quantitativi e codici registrando il carico a magazzino.",
    bullets: [
      "Lettura OCR automatica di Bolle e DDT",
      "Monitoraggio giacenze e trasferimenti tra cantieri",
      "Avvisi automatici di sottoscorta e materiale in arrivo"
    ]
  },
  {
    number: 5,
    title: "Parco Mezzi, Carburante & Scadenze",
    subtitle: "Efficienza e gestione flotta aziendale",
    icon: <Fuel className="w-10 h-10 text-yellow-400" />,
    bgGradient: "from-yellow-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    description: "Controlla l'utilizzo di scavatori, autocarri e furgoni garantendo la manutenzione tempestiva del parco veicoli.",
    bullets: [
      "Tracciamento rifornimenti di carburante e costi per chilometro",
      "Pianificazione tagliandi, revisioni e polizze assicurative",
      "Assegnazione veicoli agli operatori di cantiere"
    ]
  },
  {
    number: 6,
    title: "Contabilità, Fatture & Prima Nota",
    subtitle: "Salute finanziaria in tempo reale",
    icon: <DollarSign className="w-10 h-10 text-teal-400" />,
    bgGradient: "from-teal-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    description: "Pannello economico per registrare ricavi, costi diretti di cantiere e monitorare il margine di profitto effettivo.",
    bullets: [
      "Gestione Entrate, Uscite e Prima Nota cassa/banca",
      "Scomposizione costi per materiale, manodopera e noli",
      "Scadenziario pagamenti fornitori e fatture clienti"
    ]
  },
  {
    number: 7,
    title: "Collegamento Cellulare Aziendale",
    subtitle: "Massima sicurezza senza password complesse",
    icon: <Smartphone className="w-10 h-10 text-purple-400" />,
    bgGradient: "from-purple-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    description: "Associa gli smartphone degli operai al server aziendale tramite chiave temporanea a 4 cifre monouso.",
    bullets: [
      "Chiave a 4 cifre con scadenza 2 minuti inviata all'amministratore",
      "Riconoscimento hardware univoco del dispositivo",
      "Protezione totale da accessi non autorizzati"
    ]
  },
  {
    number: 8,
    title: "Chat di Cantiere & Invio Foto",
    subtitle: "Comunicazione continua con la squadra",
    icon: <MessageSquare className="w-10 h-10 text-sky-400" />,
    bgGradient: "from-sky-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    description: "Invia foto delle lavorazioni e aggiornamenti al gruppo di lavoro direttamente dalla scheda del cantiere.",
    bullets: [
      "Scatto foto con compressione e invio veloce",
      "Storico fotografico avanzamento stato lavori",
      "Canale dedicato per ogni cantiere attivo"
    ]
  },
  {
    number: 9,
    title: "Archivio Documenti Tecnici",
    subtitle: "Documentazione sempre a portata di mano",
    icon: <FolderArchive className="w-10 h-10 text-rose-400" />,
    bgGradient: "from-rose-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    description: "Conserva POS, DVR, certificati di conformità e schede tecniche consultabili istantaneamente dagli operatori.",
    bullets: [
      "Consultazione immediata dei documenti durante le ispezioni",
      "Suddivisione per cantiere e categorie di sicurezza",
      "Upload veloce da mobile o da PC"
    ]
  },
  {
    number: 10,
    title: "Export WhatsApp & Sync Cloud",
    subtitle: "Reportistica professionale con un click",
    icon: <Share2 className="w-10 h-10 text-emerald-400" />,
    bgGradient: "from-emerald-500/20 via-slate-900 to-slate-950",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    description: "Invia resoconti dettagliati dei rapportini o della contabilità direttamente via WhatsApp al cliente o alla direzione lavori.",
    bullets: [
      "Formattazione automatica pronta per l'invio su WhatsApp",
      "Esportazione file e dati sincronizzati su Cloud Firebase",
      "2026 @ AETERNA - MILANO: Tecnologia al servizio dell'edilizia"
    ]
  }
];

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({ isOpen, onClose }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  if (!isOpen) return null;

  const currentSlide = slides[currentSlideIndex];

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-6 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-[36px] shadow-2xl overflow-hidden flex flex-col relative"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${currentSlide.badgeColor}`}>
              Slide {currentSlide.number} / {slides.length}
            </span>
            <span className="text-xs font-bold text-slate-400">Guida CantieriCloud Pro</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Progress Indicator Bar */}
        <div className="w-full bg-slate-800/50 h-1.5 flex">
          {slides.map((s, idx) => (
            <div 
              key={s.number}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`flex-1 h-full cursor-pointer transition-all duration-300 ${
                idx === currentSlideIndex 
                  ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' 
                  : idx < currentSlideIndex 
                  ? 'bg-amber-500/40' 
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Slide Content */}
        <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.number}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Icon & Title */}
              <div className="flex items-start gap-4">
                <div className={`p-4 rounded-3xl bg-gradient-to-br ${currentSlide.bgGradient} border border-slate-700/50 shadow-lg shrink-0`}>
                  {currentSlide.icon}
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                    {currentSlide.title}
                  </h3>
                  <p className="text-xs font-semibold text-amber-400 mt-1">
                    {currentSlide.subtitle}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-300 font-medium leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                {currentSlide.description}
              </p>

              {/* Bullet Points */}
              <div className="space-y-2.5 pt-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Caratteristiche Chiave:
                </h4>
                <div className="space-y-2">
                  {currentSlide.bullets.map((bullet, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="font-medium">{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer Navigation Buttons */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentSlideIndex === 0}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Precedente</span>
            </button>

            <div className="flex items-center gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentSlideIndex 
                      ? 'w-6 bg-amber-500' 
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>{currentSlideIndex === slides.length - 1 ? 'Fine Presentation' : 'Avanti'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer branding */}
        <div className="px-6 py-3 bg-slate-950 text-left border-t border-slate-800/60">
          <span className="text-[10px] font-bold text-slate-500 tracking-wider">
            2026 @ AETERNA - MILANO
          </span>
        </div>
      </motion.div>
    </div>
  );
};
