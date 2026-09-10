import { db } from './firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, query, where, 
  onSnapshot, deleteDoc, updateDoc, writeBatch 
} from 'firebase/firestore';
import { 
  Company, UserAccount, Cantiere, Personale, Mezzo, 
  Rapportino, ContabilitaEntry, Materiale 
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
      await setDoc(doc(db, 'companies', company.id), company);
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
      await setDoc(doc(db, 'companies', companyId, 'users', user.id), user);
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
      await setDoc(doc(db, 'companies', companyId, 'cantieri', cantiere.id), cantiere);
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
      await setDoc(doc(db, 'companies', companyId, 'personale', p.id), p);
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
      await setDoc(doc(db, 'companies', companyId, 'mezzi', m.id), m);
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
      await setDoc(doc(db, 'companies', companyId, 'materiali', m.id), m);
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
      await setDoc(doc(db, 'companies', companyId, 'rapportini', r.id), r);
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
      await setDoc(doc(db, 'companies', companyId, 'contabilita', entry.id), entry);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }
};
