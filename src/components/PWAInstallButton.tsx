import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  if (isInstallable) {
    return (
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-24 left-4 right-4 z-[100] sm:bottom-8 sm:left-auto sm:right-8 sm:w-80"
      >
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Installa CantieriCloud</p>
              <p className="text-[10px] text-slate-400">Aggiungi l'icona sul tuo cellulare</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={install}
              className="bg-amber-500 text-slate-950 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Installa
            </button>
            <button onClick={() => setDismissed(true)} className="p-1.5 text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (isIOS) {
    return (
      <>
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-24 left-4 right-4 z-[100] sm:bottom-8 sm:left-auto sm:right-8 sm:w-80"
        >
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">CantieriCloud per iPhone</p>
                <p className="text-[10px] text-slate-400">Crea l'icona dell'app</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowIOSGuide(true)}
                className="bg-amber-500 text-slate-950 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
              >
                <Share className="w-3.5 h-3.5" /> Icona
              </button>
              <button onClick={() => setDismissed(true)} className="p-1.5 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showIOSGuide && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Share className="w-8 h-8 text-sky-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4 px-4">Aggiungi alla Schermata Home</h3>
                <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                  1. Tocca il tasto <strong>Condividi</strong> in basso nel browser.<br />
                  2. Scorri e tocca <strong>Aggiungi alla schermata Home</strong>.
                </p>
                <button 
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full bg-slate-950 text-white font-bold py-4 rounded-2xl text-xs shadow-xl"
                >
                  Ho capito
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
};
