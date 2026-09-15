export type UserRole = 'admin' | 'dirigente' | 'operativo';

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
}

export interface Rapportino {
  id: string;
  cantiereId: string;
  userId: string;
  userName: string;
  date: string;
  note: string;
  personale: PersonaleRapportino[];
  materiali: MaterialeRapportino[]; // This was MaterialsRapportino in some parts
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

export type MovementType = 'carico_magazzino' | 'trasferimento_cantiere' | 'scarico_rapportino' | 'reso_magazzino';

export interface StockMovement {
  id: string;
  materialeId: string;
  materialeName: string;
  quantity: number;
  type: MovementType;
  date: string;
  fromId?: string; // 'centrale' o cantiereId
  toId?: string;   // 'centrale' o cantiereId
  costoUnitario?: number;
  rapportinoId?: string; // Se tipo 'scarico_rapportino'
  photoUrl?: string; // Foto della bolla o materiale
}
