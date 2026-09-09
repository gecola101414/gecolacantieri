import React, { useState } from 'react';
import { Cantiere, Rapportino, ContabilitaEntry } from '../types';
import { MessageSquare, Copy, Check, X, Share2, Building2 } from 'lucide-react';

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
${lastRapportino ? lastRapportino.descrizione : 'Nessun rapportino recente'}

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Esportazione WhatsApp</h3>
              <p className="text-xs text-slate-500">Invia il riepilogo contabile e cantiere su WhatsApp</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-72 overflow-y-auto mb-4 leading-relaxed">
          {whatsappText}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiato negli Appunti!' : 'Copia Testo'}
          </button>
          <button
            onClick={handleOpenWhatsApp}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-md shadow-emerald-600/20"
          >
            <Share2 className="w-4 h-4" /> Apri WhatsApp Web
          </button>
        </div>
      </div>
    </div>
  );
};
