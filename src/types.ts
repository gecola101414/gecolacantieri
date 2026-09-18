export type UserRole = 
  | 'admin' 
  | 'dirigente' 
  | 'capo_cantiere' 
  | 'geometra_contabile' 
  | 'amministrativo_contabile' 
  | 'operativo';

export interface UserPermissions {
  rapportini: boolean;     // Capacità di creare/vedere/compilare rapportini per i cantieri
  documentale: boolean;    // Capacità di gestire/consultare bolle, DDT e documenti tecnici
  chatta: boolean;         // Accesso alla chat di cantiere e invio scatti/messaggi
  amministrativo: boolean; // Accesso alla contabilità, prezzi, SAL e fatturazione
  tecnico: boolean;        // Accesso e interventi sul modulo tecnico
  canEdit: boolean;        // Se false (es. Dirigente), l'utente è in SOLA LETTURA (visiona tutto, non modifica nulla)
}

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    rapportini: true,
    documentale: true,
    chatta: true,
    amministrativo: true,
    tecnico: true,
    canEdit: true,
  },
  dirigente: {
    rapportini: true,
    documentale: true,
    chatta: true,
    amministrativo: true,
    tecnico: true,
    canEdit: false, // Può visionare TUTTO ma non può modificare nulla
  },
  capo_cantiere: {
    rapportini: true,
    documentale: true,
    chatta: true,
    amministrativo: false,
    tecnico: true,
    canEdit: true,
  },
  geometra_contabile: {
    rapportini: true,
    documentale: true,
    chatta: true,
    amministrativo: true,
    tecnico: true,
    canEdit: true,
  },
  amministrativo_contabile: {
    rapportini: true,
    documentale: true,
    chatta: true,
    amministrativo: true,
    tecnico: false,
    canEdit: true,
  },
  operativo: {
    rapportini: true,
    documentale: false,
    chatta: true,
    amministrativo: false,
    tecnico: false,
    canEdit: true,
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Amministratore Server',
  dirigente: 'Dirigente (Supervisione Sola Lettura)',
  capo_cantiere: 'Capo Cantiere',
  geometra_contabile: 'Geometra Contabile',
  amministrativo_contabile: 'Amministrativo Contabile',
  operativo: 'Operatore / Operaio',
};

export interface Company {
  id: string;
  name: string;
  code: string; // Codice aziendale fornito dal sistema (es. CANT-9821)
  adminName: string;
  createdAt: string;
  magazzinoCentrale?: StockItem[]; // Giacenza nel magazzino principale
}

export interface UserAccount {
  id: string;
  companyCode: string;
  name: string;
  username: string;
  password: string; // password iniziale '1234' o personalizzata
  role: UserRole;
  permissions?: UserPermissions; // Permessi specifici assegnati dal responsabile del server
  mustChangePassword: boolean;
  cantiereId?: string; // Optional assignment for site operatives
  phone: string;
  active: boolean;
  deviceId?: string; // ID del dispositivo legato al primo login mobile
  pairingCode?: string; // Codice a 4 cifre per accoppiamento rapido
  pairingCodeExpiresAt?: string;
  cantieriAccreditati?: string[]; // Cantieri a cui l'utente può inviare rapportini
}

export interface TransferCode {
  id: string;
  code: string;
  userId: string;
  expiresAt: string;
  used: boolean;
}

export interface Cantiere {
  id: string;
  code: string;
  name: string;
  client: string;
  address: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: 'in_corso' | 'completato' | 'sospeso';
  notes?: string;
  stock?: StockItem[]; // Giacenza specifica del cantiere
  totalMaterialCost?: number; // Costo totale materiali impiegati
  totalWorkHours?: number; // Ore totali lavorate (aggiornate dai rapportini)
  totalPersonnelCost?: number; // Costo totale personale (ore * hourlyRate)
}

export interface Personale {
  id: string;
  name: string;
  role: 'Capocantiere' | 'Muratore Specializzato' | 'Operaio Generico' | 'Gruista' | 'Tecnico';
  hourlyRate: number; // costo orario aziendale (es. 25€/h)
  phone: string;
}

export interface Mezzo {
  id: string;
  name: string;
  plate: string;
  type: 'Escavatore' | 'Furgone' | 'Autocarro' | 'Piattaforma' | 'Bettoniera' | 'Altro';
  hourlyRate: number; // costo orario ammortamento/utilizzo (es. 35€/h)
  fuelEfficiency?: string; // es. 10L/h o 12km/L
}

export interface PersonaleRapportino {
  personaleId: string;
  nome: string; // Adding name for easier display in lists without full joins
  ore: number;
}

export interface MaterialeRapportino {
  materialeId: string;
  materialeName: string;
  quantity: number;
  unit: string;
}

export interface MezzoRapportino {
  mezzoId: string;
  nome: string;
  ore: number;
}

export interface Materiale {
  id: string;
  name: string;
  unit: string;
  defaultPrice: number;
  category?: string;
}

export interface Rapportino {
  id: string;
  cantiereId: string;
  userId: string;
  userName: string;
  date: string;
  ora?: string; // Orario di emissione es. "14:35:10"
  numeroProgressivo?: number; // Numero progressivo sequenziale per cantiere (1, 2, 3...)
  codiceRapportino?: string; // Es. "N° 1" o "RAP-01"
  isNonLavorato?: boolean; // Se vero, il rapportino è segnato come "Non lavorato" (es. weekend o festivo)
  submittedAt?: string; // Timestamp ISO di quando è stato caricato
  status?: 'valido' | 'annullato'; // Stato tracciabilità (default 'valido')
  annullatoIl?: string; // Data e ora annullamento
  annullatoDa?: string; // Nome utente che ha annullato
  motivoAnnullamento?: string; // Motivazione obbligatoria dell'annullamento
  sostituisceRapportinoId?: string; // ID eventuale rapportino precedente rifatto
  sostituisceNumero?: number; // Numero progressivo del rapportino sostituito
  note: string;
  personale: PersonaleRapportino[];
  materiali: MaterialeRapportino[];
  mezzi: MezzoRapportino[];
  foto: string[]; // URLs or base64
  personnelHours: { personnelId: string; hours: number }[];
  mezziHours: { mezzoId: string; hours: number }[];
  materialiUsed: { materialeId: string; quantity: number; unit: string }[];
}

export type ContabilitaType = 'sal' | 'acconto' | 'spesa_materiale' | 'spesa_mezzo' | 'carburante' | 'manutenzione' | 'altro';

export interface ContabilitaEntry {
  id: string;
  cantiereId: string;
  type: ContabilitaType;
  amount: number; // positivo per entrate (SAL/Acconti), negativo o costo per uscite
  date: string;
  description: string;
  supplier?: string;
  invoiceNumber?: string;
  mezzoId?: string; // Se collegato ad un mezzo specifico (carburante/manutenzione)
}

export interface StockItem {
  materialeId: string;
  materialeName: string;
  quantity: number;
  unit: string;
  totalCost: number; // Valore economico della giacenza
}

export interface Fornitore {
  id: string;
  name: string; // Ragione Sociale / Nome Fornitore
  piva?: string; // Partita IVA
  codiceFiscale?: string;
  address?: string; // Sede legale / Indirizzo
  phone?: string;
  email?: string;
  pec?: string;
  sdi?: string; // Codice Univoco SDI
  category?: string; // Categoria (es. Materiali Edili, Calcestruzzo, Noleggio, ecc.)
  notes?: string;
  totalOrdersCount: number; // Numero totale bolle/fatture registrate
  totalSpent: number; // Totale spesa cumulativa (€)
  lastOrderDate?: string; // Data dell'ultima bolla/fattura
  createdAt: string;
  updatedAt: string;
}

export type DocumentType = 'bolla' | 'fattura';

export interface DocumentItem {
  code?: string;
  materialeId: string;
  materialeName: string;
  quantity: number;
  unit: string;
  unitPrice: number; // Prezzo unitario rilevato in bolla
  discount?: string; // Sconto rilevato in bolla (es. "20%" o "-15%")
  totalPrice: number; // Totale netto riga rilevato (dall'ultima colonna della bolla)
  vatRate?: string; // Aliquota IVA rilevata (es. "22%", "10%", "0%")
  destinationCantiereId?: string; // ID del cantiere di destinazione o 'centrale'
  status?: 'in_attesa' | 'accettata' | 'rifiutata';
  acceptedAt?: string;
  acceptedBy?: string;
}

export type MaterialDocumentStatus = 'registrato' | 'annullato' | 'in_attesa_accettazione' | 'accettata' | 'parzialmente_accettata';

export interface MaterialDocument {
  id: string;
  number: string;
  date: string;
  supplier: string;
  type: DocumentType;
  items: DocumentItem[];
  totalAmount: number;
  imponibile?: number;
  documentTotalOriginal?: number;
  summaryDescription?: string; // Breve sintesi riassuntiva dei materiali
  photoUrl?: string;
  pdfDataUrl?: string;
  fileName?: string;
  notes?: string;
  acceptanceNote?: string; // Nota inviata al capocantiere per la verifica/accettazione
  destinationCantiereId?: string; // Cantiere primario o 'misto' se spacchettato su più cantieri
  status: MaterialDocumentStatus;
  acceptedAt?: string;
  acceptedBy?: string;
  createdAt?: string;
}

export type MovementType = 'carico_magazzino' | 'trasferimento_cantiere' | 'scarico_rapportino' | 'reso_magazzino';

export interface StockMovement {
  id: string;
  materialeId: string;
  materialeName: string;
  quantity: number;
  type: MovementType;
  date: string;
  fromId?: string; // 'centrale', 'fornitore', o cantiereId
  toId?: string;   // 'centrale' o cantiereId
  costoUnitario?: number;
  rapportinoId?: string; // Se tipo 'scarico_rapportino'
  documentId?: string; // Link to MaterialDocument
  documentNumber?: string; // N. Bolla / Fattura per facilità di consultazione
  supplier?: string; // Fornitore della bolla
  photoUrl?: string; // Foto o link documento
  status?: 'pending' | 'accepted' | 'rejected';
  acceptanceNote?: string; // Nota di consegna o istruzioni per il capocantiere
  acceptedAt?: string;
  acceptedBy?: string;
}

export type TechnicalDocCategory = 
  | 'planimetria' 
  | 'computo' 
  | 'relazione' 
  | 'sicurezza' 
  | 'foto_tecnica' 
  | 'scheda_materiale' 
  | 'certificato' 
  | 'altro';

export interface CantiereDocumentoTecnico {
  id: string;
  cantiereId: string;
  name: string;
  category: TechnicalDocCategory;
  fileName: string;
  fileUrl: string; // base64 or storage url
  fileType: string;
  fileSize?: number; // in bytes
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export interface CantiereChatMessage {
  id: string;
  cantiereId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  createdAt: string;
  type: 'text' | 'voice';
  text?: string;
  audioUrl?: string; // base64 data url or storage url
  audioDurationSeconds?: number;
}

