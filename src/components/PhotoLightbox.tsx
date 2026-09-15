import React from 'react';
import { X, Download, ZoomIn, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PhotoLightboxProps {
  photoUrl: string | null;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photoUrl,
  onClose,
  title = 'Foto Cantiere',
  subtitle
}) => {
  if (!photoUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `foto-cantiere-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[500] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
                {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                title="Scarica immagine"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Scarica</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
            <img
              src={photoUrl}
              alt="Dettaglio cantiere"
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg select-none"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
