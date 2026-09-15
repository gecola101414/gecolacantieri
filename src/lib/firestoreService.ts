import { db } from './firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, query, where, 
  onSnapshot, deleteDoc, updateDoc, writeBatch, orderBy 
} from 'firebase/firestore';
import { 
  Company, UserAccount, Cantiere, Personale, Mezzo, 
  Rapportino, ContabilitaEntry, Materiale, TransferCode, StockMovement
} from '../types';

// Generic error handler as required by skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {}, // No Firebase Auth used yet as per user custom flow
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeData<T>(data: T): T {
  const result = { ...data } as any;
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
}

export const firestoreService = {
  // Companies
  async getCompanyByCode(code: string): Promise<Company | null> {
    const path = 'companies';
    try {
      const q = query(collection(db, path), where('code', '==', code));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as Company;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return null;
    }
  },

  async saveCompany(company: Company): Promise<void> {
    const path = `companies/${company.id}`;
    try {
      await setDoc(doc(db, 'companies', company.id), sanitizeData(company));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Users
  async getUsers(companyId: string): Promise<UserAccount[]> {
    const path = `companies/${companyId}/users`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => d.data() as UserAccount);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveUser(companyId: string, user: UserAccount): Promise<void> {
    const path = `companies/${companyId}/users/${user.id}`;
    try {
      const sanitizedUser = sanitizeData(user);
      await setDoc(doc(db, 'companies', companyId, 'users', user.id), sanitizedUser);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteUser(companyId: string, userId: string): Promise<void> {
    const path = `companies/${companyId}/users/${userId}`;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'users', userId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Cantieri
  async getCantieri(companyId: string): Promise<Cantiere[]> {
    const path = `companies/${companyId}/cantieri`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => d.data() as Cantiere);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveCantiere(companyId: string, cantiere: Cantiere): Promise<void> {
    const path = `companies/${companyId}/cantieri/${cantiere.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'cantieri', cantiere.id), sanitizeData(cantiere));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Personale
  async getPersonale(companyId: string): Promise<Personale[]> {
    const path = `companies/${companyId}/personale`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => d.data() as Personale);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async savePersonale(companyId: string, p: Personale): Promise<void> {
    const path = `companies/${companyId}/personale/${p.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'personale', p.id), sanitizeData(p));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Mezzi
  async getMezzi(companyId: string): Promise<Mezzo[]> {
    const path = `companies/${companyId}/mezzi`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => d.data() as Mezzo);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveMezzo(companyId: string, m: Mezzo): Promise<void> {
    const path = `companies/${companyId}/mezzi/${m.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'mezzi', m.id), sanitizeData(m));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Materiali
  async getMateriali(companyId: string): Promise<Materiale[]> {
    const path = `companies/${companyId}/materiali`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => d.data() as Materiale);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveMateriale(companyId: string, m: Materiale): Promise<void> {
    const path = `companies/${companyId}/materiali/${m.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'materiali', m.id), sanitizeData(m));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Rapportini
  async getRapportini(companyId: string): Promise<Rapportino[]> {
    const path = `companies/${companyId}/rapportini`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => d.data() as Rapportino);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveRapportino(companyId: string, r: Rapportino): Promise<void> {
    const path = `companies/${companyId}/rapportini/${r.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'rapportini', r.id), sanitizeData(r));
      
      // Update Cantiere Data (Stock and Hours)
      const cantiere = await this.getCantiereById(companyId, r.cantiereId);
      if (cantiere) {
        const stock = cantiere.stock || [];
        let addedMaterialCost = 0;
        
        // 1. Update Stock from used materials
        if (r.materialiUsed && r.materialiUsed.length > 0) {
          for (const mu of r.materialiUsed) {
            const itemIdx = stock.findIndex(i => i.materialeId === mu.materialeId);
            if (itemIdx >= 0) {
              const unitCost = stock[itemIdx].totalCost / stock[itemIdx].quantity;
              stock[itemIdx].quantity -= mu.quantity;
              stock[itemIdx].totalCost -= unitCost * mu.quantity;
              addedMaterialCost += unitCost * mu.quantity;
              
              // Log movement
              await this.addMovement(companyId, {
                id: `mov-${r.id}-${mu.materialeId}`,
                materialeId: mu.materialeId,
                materialeName: stock[itemIdx].materialeName,
                quantity: mu.quantity,
                type: 'scarico_rapportino',
                date: r.date,
                fromId: r.cantiereId,
                rapportinoId: r.id
              });
            }
          }
        }

        // 2. Update Work Hours
        const rapportinoHours = r.personnelHours.reduce((acc, ph) => acc + ph.hours, 0);
        
        await updateDoc(doc(db, `companies/${companyId}/cantieri`, r.cantiereId), {
          stock,
          totalMaterialCost: (cantiere.totalMaterialCost || 0) + addedMaterialCost,
          totalWorkHours: (cantiere.totalWorkHours || 0) + rapportinoHours
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Contabilita
  async getContabilita(companyId: string): Promise<ContabilitaEntry[]> {
    const path = `companies/${companyId}/contabilita`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(d => d.data() as ContabilitaEntry);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveContabilitaEntry(companyId: string, entry: ContabilitaEntry): Promise<void> {
    const path = `companies/${companyId}/contabilita/${entry.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'contabilita', entry.id), sanitizeData(entry));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Transfer Codes
  async saveTransferCode(companyId: string, code: TransferCode): Promise<void> {
    const path = `companies/${companyId}/transferCodes/${code.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'transferCodes', code.id), sanitizeData(code));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async getTransferCode(companyId: string, codeStr: string): Promise<TransferCode | null> {
    const path = `companies/${companyId}/transferCodes`;
    try {
      const q = query(
        collection(db, 'companies', companyId, 'transferCodes'), 
        where('code', '==', codeStr),
        where('used', '==', false)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as TransferCode;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return null;
    }
  },

  async markTransferCodeUsed(companyId: string, codeId: string): Promise<void> {
    const path = `companies/${companyId}/transferCodes/${codeId}`;
    try {
      await updateDoc(doc(db, 'companies', companyId, 'transferCodes', codeId), { used: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  // Pairing Codes
  async savePairingCode(code: string, companyId: string, userId: string): Promise<void> {
    const path = `pairingCodes/${code}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    try {
      await setDoc(doc(db, 'pairingCodes', code), { companyId, userId, expiresAt });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async resolvePairingCode(code: string): Promise<{ companyId: string, userId: string } | null> {
    const path = `pairingCodes/${code}`;
    try {
      const docSnap = await getDoc(doc(db, 'pairingCodes', code));
      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      if (new Date(data.expiresAt) < new Date()) {
        await deleteDoc(doc(db, 'pairingCodes', code));
        return null;
      }
      return data as { companyId: string, userId: string };
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
      return null;
    }
  },

  async getCompanyById(companyId: string): Promise<Company | null> {
    const path = `companies/${companyId}`;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId));
      return snap.exists() ? snap.data() as Company : null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
      return null;
    }
  },

  async getMovements(companyId: string): Promise<StockMovement[]> {
    const path = `companies/${companyId}/movements`;
    try {
      const q = query(collection(db, path), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
      return [];
    }
  },

  async addMovement(companyId: string, movement: StockMovement): Promise<void> {
    const path = `companies/${companyId}/movements`;
    try {
      await setDoc(doc(db, path, movement.id), sanitizeData(movement));
      
      // Update Stock
      if (movement.type === 'carico_magazzino') {
        await this.updateCompanyMagazzino(companyId, movement);
      } else if (movement.type === 'trasferimento_cantiere') {
        await this.updateTransferStock(companyId, movement);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async updateCompanyMagazzino(companyId: string, move: StockMovement): Promise<void> {
    const company = await this.getCompanyById(companyId);
    if (!company) return;
    
    const stock = company.magazzinoCentrale || [];
    const itemIdx = stock.findIndex(i => i.materialeId === move.materialeId);
    
    if (itemIdx >= 0) {
      stock[itemIdx].quantity += move.quantity;
      stock[itemIdx].totalCost += (move.costoUnitario || 0) * move.quantity;
    } else {
      stock.push({
        materialeId: move.materialeId,
        materialeName: move.materialeName,
        quantity: move.quantity,
        unit: 'u', // Placeholder, should get from material
        totalCost: (move.costoUnitario || 0) * move.quantity
      });
    }
    
    await updateDoc(doc(db, 'companies', companyId), { magazzinoCentrale: stock });
  },

  async updateTransferStock(companyId: string, move: StockMovement): Promise<void> {
    if (!move.toId || move.toId === 'centrale') return;
    
    // 1. Scalo da Magazzino Centrale
    const company = await this.getCompanyById(companyId);
    if (company && company.magazzinoCentrale) {
      const centralIdx = company.magazzinoCentrale.findIndex(i => i.materialeId === move.materialeId);
      if (centralIdx >= 0) {
        company.magazzinoCentrale[centralIdx].quantity -= move.quantity;
        await updateDoc(doc(db, 'companies', companyId), { magazzinoCentrale: company.magazzinoCentrale });
      }
    }

    // 2. Carico su Cantiere
    const cantiere = await this.getCantiereById(companyId, move.toId);
    if (cantiere) {
      const stock = cantiere.stock || [];
      const itemIdx = stock.findIndex(i => i.materialeId === move.materialeId);
      if (itemIdx >= 0) {
        stock[itemIdx].quantity += move.quantity;
        stock[itemIdx].totalCost += (move.costoUnitario || 0) * move.quantity;
      } else {
        stock.push({
          materialeId: move.materialeId,
          materialeName: move.materialeName,
          quantity: move.quantity,
          unit: 'u',
          totalCost: (move.costoUnitario || 0) * move.quantity
        });
      }
      await updateDoc(doc(db, `companies/${companyId}/cantieri`, move.toId), { 
        stock,
        totalMaterialCost: (cantiere.totalMaterialCost || 0) + ((move.costoUnitario || 0) * move.quantity)
      });
    }
  },

  async getCantiereById(companyId: string, cantiereId: string): Promise<Cantiere | null> {
    const path = `companies/${companyId}/cantieri/${cantiereId}`;
    try {
      const snap = await getDoc(doc(db, path));
      return snap.exists() ? { id: snap.id, ...snap.data() } as Cantiere : null;
    } catch (e) {
      return null;
    }
  },

  async getUserById(companyId: string, userId: string): Promise<UserAccount | null> {
    const path = `companies/${companyId}/users/${userId}`;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId, 'users', userId));
      return snap.exists() ? snap.data() as UserAccount : null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
      return null;
    }
  }
};
