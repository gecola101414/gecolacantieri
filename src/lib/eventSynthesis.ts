import { 
  CompanyEvent, MaterialRequest, TimbraturaBadge, MaterialDocument, 
  Rapportino, CantiereDocumentoTecnico, ContabilitaEntry, StockMovement, Cantiere 
} from '../types';

export interface RhythmAnalytics {
  status: 'calma_piatta' | 'avvio' | 'regolare' | 'intenso';
  statusLabel: string;
  statusColor: string;
  statusBadgeBg: string;
  statusDescription: string;
  todayCount: number;
  lastHourCount: number;
  lastEvent: CompanyEvent | null;
  activeCantieriToday: string[]; // names of active cantieri
  activeCantieriCount: number;
  hourlyDistribution: { hour: number; count: number }[];
}

/**
 * Sintetizza e unifica tutte le attività e sorgenti dati della piattaforma
 * in un tracciato cronologico organico per la "Centrale Eventi".
 */
export function synthesizeAllEvents({
  explicitEvents = [],
  materialRequests = [],
  timbrature = [],
  documents = [],
  rapportini = [],
  technicalDocs = [],
  contabilita = [],
  cantieri = [],
}: {
  explicitEvents?: CompanyEvent[];
  materialRequests?: MaterialRequest[];
  timbrature?: TimbraturaBadge[];
  documents?: MaterialDocument[];
  rapportini?: Rapportino[];
  technicalDocs?: CantiereDocumentoTecnico[];
  contabilita?: ContabilitaEntry[];
  cantieri?: Cantiere[];
}): CompanyEvent[] {
  const cantiereMap = new Map<string, string>();
  (cantieri || []).forEach(c => cantiereMap.set(c.id, c.name));

  const events: CompanyEvent[] = [];

  // 1. Explicit logged events
  (explicitEvents || []).forEach(e => {
    events.push({
      ...e,
      cantiereName: e.cantiereName || (e.cantiereId ? cantiereMap.get(e.cantiereId) : undefined)
    });
  });

  // 2. Ordini e Richieste Materiali (MaterialRequest)
  (materialRequests || []).forEach(req => {
    const cName = req.cantiereName || (req.cantiereId ? cantiereMap.get(req.cantiereId) : 'Cantiere');
    const itemsCount = (req.items || []).length;
    const itemsPreview = (req.items || [])
      .slice(0, 2)
      .map(i => `${i.quantity} ${i.unit || ''} ${i.materialeName}`)
      .join(', ');
    const fullPreview = itemsCount > 2 ? `${itemsPreview} (+${itemsCount - 2} altri)` : itemsPreview;

    const isApproved = req.status === 'approvata';
    const statusNote = isApproved ? 'Approvato dal Capocantiere' : 'Inviato in Ufficio';

    events.push({
      id: `ev-ord-${req.id}`,
      type: 'ordine',
      title: isApproved ? 'Ordine Approvato dal Capocantiere' : 'Richiesta Materiali Inviata',
      summary: `Caricato ordine: ${fullPreview || `${itemsCount} materiali`}`,
      cantiereId: req.cantiereId,
      cantiereName: cName,
      userId: req.userId,
      userName: req.userName || 'Capo Cantiere',
      timestamp: req.createdAt || `${req.date}T12:00:00.000Z`,
      details: `Stato: ${statusNote} • ${itemsCount} articoli ordinati${req.notes ? ` • Note: ${req.notes}` : ''}`,
      entityId: req.id,
      badgeLabel: isApproved ? 'Ordine Approvato' : 'Nuovo Ordine'
    });
  });

  // 3. Beggiature / Presenze GPS (TimbraturaBadge)
  (timbrature || []).forEach(tb => {
    const cName = tb.cantiereName || (tb.cantiereId ? cantiereMap.get(tb.cantiereId) : 'Cantiere');
    const isEntrata = tb.type === 'entrata';
    const timeStr = tb.time ? tb.time.substring(0, 5) : '';

    events.push({
      id: `ev-badge-${tb.id}`,
      type: 'badge',
      title: isEntrata ? 'Beggiatura Entrata Cantiere' : 'Beggiatura Uscita Cantiere',
      summary: `${isEntrata ? 'Entrata' : 'Uscita'} registrata alle ${timeStr || 'orario non def.'}: ${tb.userName}`,
      cantiereId: tb.cantiereId,
      cantiereName: cName,
      userId: tb.userId,
      userName: tb.userName,
      userRole: tb.userRole,
      timestamp: tb.timestamp || `${tb.date}T${tb.time || '08:00:00'}.000Z`,
      details: tb.location?.address ? `Posizione GPS: ${tb.location.address}` : undefined,
      entityId: tb.id,
      badgeLabel: isEntrata ? 'Badge IN' : 'Badge OUT'
    });
  });

  // 4. Caricamento / Accettazione Bolle Fornitori (MaterialDocument)
  (documents || []).forEach(doc => {
    if (doc.status === 'annullato') return;
    const cName = doc.destinationCantiereId ? cantiereMap.get(doc.destinationCantiereId) : undefined;
    const itemsCount = (doc.items || []).length;
    const isCaricata = doc.status === 'accettata';
    const amountStr = doc.totalAmount ? `€ ${doc.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '';

    events.push({
      id: `ev-doc-${doc.id}`,
      type: 'bolla',
      title: isCaricata ? 'Bolla DDT Accettata in Cantiere' : 'Caricamento Documento di Trasporto',
      summary: `Bolla DDT N. ${doc.number || 's/n'} - ${doc.supplier || 'Fornitore'}${amountStr ? ` (${amountStr})` : ''}`,
      cantiereId: doc.destinationCantiereId,
      cantiereName: cName,
      userName: doc.acceptedBy || 'Ufficio Acquisti',
      timestamp: doc.createdAt || `${doc.date}T10:00:00.000Z`,
      details: `${itemsCount} materiali • ${isCaricata ? 'Caricata e disponibile in cantiere' : 'In attesa di ricezione'}`,
      amount: doc.totalAmount,
      entityId: doc.id,
      badgeLabel: isCaricata ? 'Bolla Caricata' : 'Bolla Emessa'
    });
  });

  // 5. Rapportini Giornalieri dal Campo (Rapportino)
  (rapportini || []).forEach(rap => {
    if (rap.status === 'annullato') return;
    const cName = cantiereMap.get(rap.cantiereId) || 'Cantiere';
    const numProg = rap.numeroProgressivo ? `N° ${rap.numeroProgressivo}` : '';
    const operaiCount = (rap.personnelHours || rap.personale || []).length;
    const totalHours = (rap.personnelHours || []).reduce((acc, p) => acc + (Number(p.hours) || 0), 0);

    const matCount = (rap.materialiUsed || rap.materiali || []).length;

    events.push({
      id: `ev-rap-${rap.id}`,
      type: 'rapportino',
      title: `Rapportino Giornaliero ${numProg}`,
      summary: `Trasmesso rapportino: ${totalHours} ore (${operaiCount} operai)${matCount > 0 ? ` • ${matCount} materiali consumati` : ''}`,
      cantiereId: rap.cantiereId,
      cantiereName: cName,
      userId: rap.userId,
      userName: rap.userName || 'Operatore di Cantiere',
      timestamp: rap.submittedAt || (rap.ora ? `${rap.date}T${rap.ora}.000Z` : `${rap.date}T17:30:00.000Z`),
      details: rap.note ? `Note di cantiere: "${rap.note}"` : undefined,
      entityId: rap.id,
      badgeLabel: numProg || 'Rapportino'
    });
  });

  // 6. Documenti Tecnici e Foto (CantiereDocumentoTecnico)
  (technicalDocs || []).forEach(td => {
    const cName = td.cantiereId ? cantiereMap.get(td.cantiereId) : 'Cantiere';
    events.push({
      id: `ev-tech-${td.id}`,
      type: 'documento',
      title: 'Caricamento Fascicolo Tecnico',
      summary: `Caricato documento: "${td.name}" (${td.category})`,
      cantiereId: td.cantiereId,
      cantiereName: cName,
      userName: td.uploadedBy || 'Ufficio Tecnico',
      timestamp: td.uploadedAt || new Date().toISOString(),
      details: td.notes || undefined,
      entityId: td.id,
      badgeLabel: td.category || 'Doc Tecnico'
    });
  });

  // 7. Contabilità e SAL (ContabilitaEntry)
  (contabilita || []).forEach(cb => {
    const cName = cb.cantiereId ? cantiereMap.get(cb.cantiereId) : 'Cantiere';
    const isSAL = cb.type === 'sal';
    events.push({
      id: `ev-sal-${cb.id}`,
      type: 'contabilita',
      title: isSAL ? 'Registrazione Emissione SAL' : 'Registrazione Costo Cantiere',
      summary: `${cb.description || 'Registrazione contabile'} - € ${cb.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      cantiereId: cb.cantiereId,
      cantiereName: cName,
      userName: 'Amministrazione',
      timestamp: `${cb.date}T11:00:00.000Z`,
      amount: cb.amount,
      entityId: cb.id,
      badgeLabel: isSAL ? 'SAL Emesso' : 'Costo'
    });
  });

  // Sort strictly by timestamp descending (newest first)
  return events.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeB - timeA;
  });
}

/**
 * Calcola l'indice di ritmo e salute operativa della manovra giornaliera
 * per il Dirigente e la Direzione d'Impresa.
 */
export function calculateOperationalRhythm(events: CompanyEvent[]): RhythmAnalytics {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const oneHourAgoTime = now.getTime() - (60 * 60 * 1000);

  const todayEvents = events.filter(e => {
    if (!e.timestamp) return false;
    return e.timestamp.startsWith(todayStr);
  });

  const lastHourEvents = events.filter(e => {
    if (!e.timestamp) return false;
    const t = new Date(e.timestamp).getTime();
    return t >= oneHourAgoTime;
  });

  const activeCantieriSet = new Set<string>();
  todayEvents.forEach(e => {
    if (e.cantiereName) activeCantieriSet.add(e.cantiereName);
  });
  const activeCantieriToday = Array.from(activeCantieriSet);

  const hourlyDistribution: { hour: number; count: number }[] = [];
  for (let h = 6; h <= 20; h++) {
    const count = todayEvents.filter(e => {
      try {
        const d = new Date(e.timestamp);
        return d.getHours() === h;
      } catch {
        return false;
      }
    }).length;
    hourlyDistribution.push({ hour: h, count });
  }

  const todayCount = todayEvents.length;
  const lastHourCount = lastHourEvents.length;
  const lastEvent = events.length > 0 ? events[0] : null;

  let status: 'calma_piatta' | 'avvio' | 'regolare' | 'intenso' = 'calma_piatta';
  let statusLabel = 'Calma Piatta';
  let statusColor = 'text-rose-600';
  let statusBadgeBg = 'bg-rose-50 border-rose-200 text-rose-700';
  let statusDescription = 'Nessun movimento o timbratura registrata oggi nei cantieri. L\'attività è ferma o non ancora avviata.';

  if (todayCount === 0) {
    status = 'calma_piatta';
    statusLabel = 'Calma Piatta';
    statusColor = 'text-rose-600';
    statusBadgeBg = 'bg-rose-50 border-rose-200 text-rose-700';
    statusDescription = 'Attenzione: nessun movimento o timbratura registrata oggi nei cantieri. Se la giornata lavorativa è in corso, verificare con i capicantiere.';
  } else if (todayCount <= 3) {
    status = 'avvio';
    statusLabel = 'Avvio Manovra';
    statusColor = 'text-amber-600';
    statusBadgeBg = 'bg-amber-50 border-amber-200 text-amber-800';
    statusDescription = 'Primi movimenti registrati della giornata: timbrature di inizio turno o primi ordini in caricamento.';
  } else if (todayCount <= 10) {
    status = 'regolare';
    statusLabel = 'Ritmo Regolare';
    statusColor = 'text-emerald-600';
    statusBadgeBg = 'bg-emerald-50 border-emerald-200 text-emerald-800';
    statusDescription = 'Flusso operativo costante: i cantieri stanno operando regolarmente con carichi, ordini e presenze sincronizzate.';
  } else {
    status = 'intenso';
    statusLabel = 'Ritmo Intenso (Pieno Regime)';
    statusColor = 'text-indigo-600';
    statusBadgeBg = 'bg-indigo-50 border-indigo-200 text-indigo-800';
    statusDescription = 'Manovra aziendale al massimo regime: intenso flusso di bolle, ordini approvati, presenze e rapportini attivi.';
  }

  return {
    status,
    statusLabel,
    statusColor,
    statusBadgeBg,
    statusDescription,
    todayCount,
    lastHourCount,
    lastEvent,
    activeCantieriToday,
    activeCantieriCount: activeCantieriToday.length,
    hourlyDistribution,
  };
}
