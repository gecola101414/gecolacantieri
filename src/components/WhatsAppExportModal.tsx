import React, { useState } from 'react';
import { Cantiere, Rapportino, ContabilitaEntry } from '../types';
import { MessageSquare, Copy, Check, X, Share2, Building2, Smartphone, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WhatsAppExportModalProps {
  cantiere: Cantiere;
  rapportini: Rapportino[];
  contabilita: ContabilitaEntry[];
  onClose: () => void;
}

export const WhatsAppExportModal: React.FC<WhatsAppExportModalProps> = ({
  cantiere,
  rapportini,
  contabilita,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // Filter items for this cantiere
  const cantiereRapportini = rapportini.filter((r) => r.cantiereId === cantiere.id);
  const cantiereContab = contabilita.filter((c) => c.cantiereId === cantiere.id);

  const totalEntrate = cantiereContab
    .filter((c) => c.type === 'sal' || c.type === 'acconto')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalUscite = cantiereContab
    .filter((c) => c.type !== 'sal' && c.type !== 'acconto')
    .reduce((acc, curr) => acc + Math.abs(curr.amount), 0);

  const saldo = totalEntrate - totalUscite;

  const lastRapportino = cantiereRapportini[cantiereRapportini.length - 1];

  const whatsappText = `🏗️ *REPORT CANTIERE: ${cantiere.name.toUpperCase()}*
📍 Indirizzo: ${cantiere.address}
👤 Cliente: ${cantiere.client}
📊 Stato: ${cantiere.status.toUpperCase()}

💰 *SITUAZIONE CONTABILE:*
• Entrate (SAL/Acconti): €${totalEntrate.toLocaleString()}
• Costi & Uscite: €${totalUscite.toLocaleString()}
• Saldo Netto: €${saldo.toLocaleString()}

👷 *ULTIMO RAPPORTINO (${lastRapportino ? lastRapportino.date : 'N/D'}):*
${lastRapportino ? lastRapportino.note : 'Nessun rapportino recente'}

📱 *Generato con CantieriCloud Pro* (Cloud Firebase)
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsappText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[300] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl max-w-lg w-full p-10 border border-slate-200 overflow-hidden relative"
      >
        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3.5 rounded-2xl text-emerald-600">
              <MessageSquare className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Condividi Report</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Invia Situazione via WhatsApp</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-50 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-[28px] p-6 mb-8 shadow-inner overflow-hidden relative">
          <div className="absolute top-4 right-4 opacity-5">
            <Building2 className="w-20 h-20" />
          </div>
          <div className="relative z-10 font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            {whatsappText}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleCopy}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all text-xs border border-slate-200"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Testo Copiato!' : 'Copia Report'}
          </button>
          <button
            onClick={handleOpenWhatsApp}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all text-xs shadow-xl shadow-emerald-600/20"
          >
            <Share2 className="w-4 h-4" /> Apri WhatsApp
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Trasmissione Sicura Cloud
        </div>
      </motion.div>
    </div>
  );
};
