import { db, storage } from './firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, query, where, 
  onSnapshot, deleteDoc, updateDoc, writeBatch, orderBy 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Company, UserAccount, Cantiere, Personale, Mezzo, 
  Rapportino, ContabilitaEntry, Materiale, TransferCode, StockMovement, MaterialDocument,
  CantiereChatMessage, CantiereDocumentoTecnico, Fornitore, TimbraturaBadge,
  MaterialRequest, MaterialRequestStatus
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
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[Firestore Error - ${operationType} on ${path}]:`, msg);
  throw new Error(msg);
}

function sanitizeData<T>(data: T, visited = new WeakSet()): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'number') {
    if (isNaN(data) || !isFinite(data)) {
      return 0 as any;
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  // Prevent infinite call stack from circular references
  if (visited.has(data as object)) {
    return undefined as any;
  }
  visited.add(data as object);

  if (data instanceof Date) {
    return data.toISOString() as any;
  }

  if (Array.isArray(data)) {
    return data
      .map(item => sanitizeData(item, visited))
      .filter(item => item !== undefined) as any;
  }

  // If not a plain object (e.g. custom class instances, events, etc.), omit it
  const isPlainObject =
    Object.prototype.toString.call(data) === '[object Object]' &&
    (!data.constructor || data.constructor.name === 'Object' || data.constructor.name === undefined);

  if (!isPlainObject) {
    return undefined as any;
  }

  const result: any = {};
  for (const key of Object.keys(data)) {
    const val = (data as any)[key];
    if (val !== undefined && typeof val !== 'function') {
      const cleaned = sanitizeData(val, visited);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
  }
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
    console.log(`Saving rapportino to ${path}`, r);
    try {
      // Security check: verify user is active before persisting rapportino
      if (r.userId) {
        try {
          const user = await this.getUserById(companyId, r.userId);
          if (user && user.active === false) {
            console.warn(`[SECURITY] Blocked rapportino submission: user ${r.userId} is deactivated.`);
            throw new Error('Account utente disattivato dall\'amministratore. Invio bloccato.');
          }
        } catch (err: any) {
          if (err?.message?.includes('disattivato')) throw err;
          // Non-blocking if getUserById fails due to offline/permission glitch
        }
      }

      // Ensure timestamp, time and status defaults
      const now = new Date();
      if (!r.ora) {
        r.ora = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (!r.date) {
        r.date = now.toISOString().split('T')[0];
      }
      if (!r.status) {
        r.status = 'valido';
      }

      // Ensure sequential progressive number per cantiere
      if (!r.numeroProgressivo || r.numeroProgressivo <= 0) {
        try {
          const existingRap = await this.getRapportini(companyId);
          const cantiereRap = existingRap.filter(ex => ex.cantiereId === r.cantiereId && ex.id !== r.id);
          const maxNum = cantiereRap.reduce((max, cur) => Math.max(max, Number(cur.numeroProgressivo) || 0), 0);
          r.numeroProgressivo = Math.max(maxNum, cantiereRap.length) + 1;
          r.codiceRapportino = `N° ${r.numeroProgressivo}`;
        } catch {
          r.numeroProgressivo = 1;
          r.codiceRapportino = `N° 1`;
        }
      }

      const sanitizedR = sanitizeData(r);
      await setDoc(doc(db, 'companies', companyId, 'rapportini', r.id), sanitizedR);
      
      // Update Cantiere Data (Stock and Hours) safely
      if (r.cantiereId) {
        try {
          const cantiere = await this.getCantiereById(companyId, r.cantiereId);
          if (cantiere) {
            const stock = Array.isArray(cantiere.stock) ? [...cantiere.stock] : [];
            let addedMaterialCost = 0;
            
            // 1. Update Stock from used materials
            if (r.materialiUsed && r.materialiUsed.length > 0) {
              for (const mu of r.materialiUsed) {
                const itemIdx = stock.findIndex(i => i.materialeId === mu.materialeId);
                if (itemIdx >= 0) {
                  const currentQty = Number(stock[itemIdx].quantity) || 0;
                  const currentTotalCost = Number(stock[itemIdx].totalCost) || 0;
                  const muQty = Number(mu.quantity) || 0;
                  const unitCost = currentQty > 0 ? currentTotalCost / currentQty : 0;
                  const safeUnitCost = isNaN(unitCost) ? 0 : unitCost;
                  
                  stock[itemIdx].quantity = Math.max(0, currentQty - muQty);
                  stock[itemIdx].totalCost = Math.max(0, currentTotalCost - (safeUnitCost * muQty));
                  addedMaterialCost += safeUnitCost * muQty;
                  
                  // Log movement
                  await this.addMovement(companyId, {
                    id: `mov-${r.id}-${mu.materialeId}`,
                    materialeId: mu.materialeId,
                    materialeName: stock[itemIdx].materialeName || 'Materiale',
                    quantity: muQty,
                    type: 'scarico_rapportino',
                    date: r.date,
                    fromId: r.cantiereId,
                    rapportinoId: r.id
                  });
                }
              }
            }

            // 2. Update Work Hours & Personnel Cost
            let addedPersonnelCost = 0;
            const personnelHours = r.personnelHours || [];
            const rapportinoHours = personnelHours.reduce((acc, ph) => acc + (Number(ph.hours) || 0), 0);
            
            // Get all personnel to find rates
            const allPersonale = await this.getPersonale(companyId);
            for (const ph of personnelHours) {
              const p = allPersonale.find(pers => pers.id === ph.personnelId);
              if (p) {
                addedPersonnelCost += (Number(ph.hours) || 0) * (Number(p.hourlyRate) || 0);
              }
            }
            
            const prevMaterialCost = Number(cantiere.totalMaterialCost) || 0;
            const prevWorkHours = Number(cantiere.totalWorkHours) || 0;
            const prevPersonnelCost = Number(cantiere.totalPersonnelCost) || 0;

            await updateDoc(doc(db, 'companies', companyId, 'cantieri', r.cantiereId), {
              stock: sanitizeData(stock),
              totalMaterialCost: prevMaterialCost + (isNaN(addedMaterialCost) ? 0 : addedMaterialCost),
              totalWorkHours: prevWorkHours + (isNaN(rapportinoHours) ? 0 : rapportinoHours),
              totalPersonnelCost: prevPersonnelCost + (isNaN(addedPersonnelCost) ? 0 : addedPersonnelCost)
            });
          }
        } catch (cantiereErr) {
          console.warn('Non-fatal error updating cantiere stats during rapportino save:', cantiereErr);
        }
      }
      console.log(`Rapportino ${r.id} saved successfully.`);
    } catch (e) {
      console.error(`Error saving rapportino ${r.id}:`, e);
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async cancelRapportino(companyId: string, rapportinoId: string, cancelledBy: string, motivo: string): Promise<void> {
    const path = `companies/${companyId}/rapportini/${rapportinoId}`;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId, 'rapportini', rapportinoId));
      if (!snap.exists()) return;
      const rap = snap.data() as Rapportino;
      if (rap.status === 'annullato') return; // Already cancelled

      const now = new Date();
      const annullatoIl = `${now.toLocaleDateString('it-IT')} ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;

      await updateDoc(doc(db, 'companies', companyId, 'rapportini', rapportinoId), {
        status: 'annullato',
        annullatoIl,
        annullatoDa: cancelledBy,
        motivoAnnullamento: motivo || 'Annullato dall\'operatore'
      });

      // Rollback hours from cantiere
      if (rap.cantiereId) {
        try {
          const cantiere = await this.getCantiereById(companyId, rap.cantiereId);
          if (cantiere) {
            const personnelHours = rap.personnelHours || [];
            const rapportinoHours = personnelHours.reduce((acc, ph) => acc + (Number(ph.hours) || 0), 0);
            const allPersonale = await this.getPersonale(companyId);
            let removedPersonnelCost = 0;
            for (const ph of personnelHours) {
              const p = allPersonale.find(pers => pers.id === ph.personnelId);
              if (p) {
                removedPersonnelCost += (Number(ph.hours) || 0) * (Number(p.hourlyRate) || 0);
              }
            }
            const prevWorkHours = Number(cantiere.totalWorkHours) || 0;
            const prevPersonnelCost = Number(cantiere.totalPersonnelCost) || 0;

            await updateDoc(doc(db, 'companies', companyId, 'cantieri', rap.cantiereId), {
              totalWorkHours: Math.max(0, prevWorkHours - (isNaN(rapportinoHours) ? 0 : rapportinoHours)),
              totalPersonnelCost: Math.max(0, prevPersonnelCost - (isNaN(removedPersonnelCost) ? 0 : removedPersonnelCost))
            });
          }
        } catch (rollbackErr) {
          console.warn('Non-fatal error rolling back cantiere stats on cancel:', rollbackErr);
        }
      }
      console.log(`Rapportino ${rapportinoId} successfully cancelled with audit trail.`);
    } catch (e) {
      console.error(`Error cancelling rapportino ${rapportinoId}:`, e);
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
  async saveTransferCode(companyOrId: Company | string, codeOrUser: TransferCode | UserAccount, maybeCode?: TransferCode): Promise<void> {
    let companyId: string;
    let companyData: Company | null = null;
    let userId: string;
    let userData: UserAccount | null = null;
    let code: TransferCode;

    if (typeof companyOrId === 'object') {
      companyData = companyOrId;
      companyId = companyOrId.id;
      userData = codeOrUser as UserAccount;
      userId = (codeOrUser as UserAccount).id;
      code = maybeCode!;
    } else {
      companyId = companyOrId;
      code = codeOrUser as TransferCode;
      userId = code.userId;
    }

    const path = `companies/${companyId}/transferCodes/${code.id}`;
    const cleanCode = code.code.trim().toUpperCase().replace(/\s+/g, '');
    try {
      const rootPayload: any = {
        id: code.id,
        code: cleanCode,
        companyId,
        userId,
        expiresAt: code.expiresAt,
        used: false,
        createdAt: new Date().toISOString()
      };
      if (companyData) {
        rootPayload.company = sanitizeData(companyData);
      }
      if (userData) {
        rootPayload.user = sanitizeData(userData);
      }

      await Promise.all([
        setDoc(doc(db, 'companies', companyId, 'transferCodes', code.id), sanitizeData(code)),
        setDoc(doc(db, 'transferCodes', cleanCode), rootPayload)
      ]);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async resolveTransferCode(codeStr: string): Promise<{ company: Company; user: UserAccount } | null> {
    const cleanCode = codeStr.trim().toUpperCase().replace(/\s+/g, '');
    const rootPath = `transferCodes/${cleanCode}`;
    try {
      const snap = await getDoc(doc(db, 'transferCodes', cleanCode));
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data.used) return null;

      // Code strictly expires according to expiresAt (+ 20s grace period for device clock discrepancies)
      const expTime = new Date(data.expiresAt).getTime();
      if (Date.now() > expTime + 20 * 1000) return null;

      // Mark used in root
      await updateDoc(doc(db, 'transferCodes', cleanCode), { used: true });

      // Mark used in company subcollection if present
      if (data.companyId && data.id) {
        try {
          await updateDoc(doc(db, 'companies', data.companyId, 'transferCodes', data.id), { used: true });
        } catch (_) {}
      }

      // If full company and user data were embedded, return them directly
      let company: Company | null = data.company || null;
      let user: UserAccount | null = data.user || null;

      if (!company && data.companyId) {
        company = await this.getCompanyById(data.companyId);
      }
      if (!user && data.companyId && data.userId) {
        user = await this.getUserById(data.companyId, data.userId);
      }

      if (company && user) {
        return { company, user };
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, rootPath);
      return null;
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

  // Pairing Codes & Mobile Device Registration (4 Cifre - 2 Minuti)
  async createMobilePairingRequest(code: string, deviceId: string, deviceInfo?: string): Promise<void> {
    const path = `pairingCodes/${code}`;
    const expiresAt = new Date(Date.now() + 120 * 1000).toISOString(); // 2 minuti esatti
    try {
      await setDoc(doc(db, 'pairingCodes', code), { 
        code, 
        deviceId, 
        deviceInfo: deviceInfo || '', 
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt,
        companyId: null, 
        userId: null 
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  listenMobilePairingRequest(code: string, onApproved: (companyId: string, userId: string) => void): () => void {
    const docRef = doc(db, 'pairingCodes', code);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'approved' && data.companyId && data.userId) {
          onApproved(data.companyId, data.userId);
        }
      }
    }, (err) => {
      console.error('Error listening to pairing code:', err);
    });
  },

  async approveMobilePairing(code: string, companyId: string, userId: string): Promise<{ deviceId: string } | null> {
    const cleanCode = code.trim().toUpperCase();
    const path = `pairingCodes/${cleanCode}`;
    try {
      const snap = await getDoc(doc(db, 'pairingCodes', cleanCode));
      if (!snap.exists()) return null;
      const data = snap.data();
      
      // Controlla scadenza dei 2 minuti (+ 20s di tolleranza per orologio di sistema)
      const expTime = new Date(data.expiresAt).getTime();
      if (Date.now() > expTime + 20 * 1000) {
        return null;
      }

      const deviceId = data.deviceId || '';
      await updateDoc(doc(db, 'pairingCodes', cleanCode), {
        status: 'approved',
        companyId,
        userId,
        approvedAt: new Date().toISOString()
      });

      return { deviceId };
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
      return null;
    }
  },

  async savePairingCode(code: string, companyId: string, userId: string): Promise<void> {
    const path = `pairingCodes/${code}`;
    const expiresAt = new Date(Date.now() + 120 * 1000).toISOString(); // 2 minuti
    try {
      await setDoc(doc(db, 'pairingCodes', code), { 
        code,
        companyId, 
        userId, 
        expiresAt,
        status: 'approved',
        createdAt: new Date().toISOString()
      });
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
      const expTime = new Date(data.expiresAt).getTime();
      if (Date.now() > expTime + 20 * 1000) {
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
      const sanitizedMove = sanitizeData({
        ...movement,
        status: movement.type === 'trasferimento_cantiere' ? 'pending' : movement.status
      });
      await setDoc(doc(db, path, movement.id), sanitizedMove);
      
      // Update Stock
      if (movement.type === 'carico_magazzino') {
        await this.updateCompanyMagazzino(companyId, movement);
      } else if (movement.type === 'trasferimento_cantiere') {
        await this.updateTransferStock(companyId, sanitizedMove);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async updateCompanyMagazzino(companyId: string, move: StockMovement): Promise<void> {
    try {
      const company = await this.getCompanyById(companyId);
      if (!company) {
        console.error(`Company ${companyId} not found during magazzino update`);
        return;
      }
      
      const stock = company.magazzinoCentrale || [];
      const itemIdx = stock.findIndex(i => i.materialeId === move.materialeId);
      
      if (itemIdx >= 0) {
        stock[itemIdx].quantity = (stock[itemIdx].quantity || 0) + move.quantity;
        stock[itemIdx].totalCost = (stock[itemIdx].totalCost || 0) + ((move.costoUnitario || 0) * move.quantity);
      } else {
        stock.push({
          materialeId: move.materialeId,
          materialeName: move.materialeName,
          quantity: move.quantity,
          unit: 'u',
          totalCost: (move.costoUnitario || 0) * move.quantity
        });
      }
      
      await updateDoc(doc(db, 'companies', companyId), { magazzinoCentrale: sanitizeData(stock) });
      console.log(`Magazzino Centrale updated for material ${move.materialeName}`);
    } catch (e) {
      console.error('Error updating company magazzino:', e);
      throw e;
    }
  },

  async updateTransferStock(companyId: string, move: StockMovement): Promise<void> {
    try {
      // SCALO dal punto di origine
      if (move.fromId === 'centrale') {
        const company = await this.getCompanyById(companyId);
        if (company && company.magazzinoCentrale) {
          const centralIdx = company.magazzinoCentrale.findIndex(i => i.materialeId === move.materialeId);
          if (centralIdx >= 0) {
            company.magazzinoCentrale[centralIdx].quantity = (company.magazzinoCentrale[centralIdx].quantity || 0) - move.quantity;
            // Calcoliamo il costo proporzionale scalo
            const unitCost = company.magazzinoCentrale[centralIdx].totalCost / (company.magazzinoCentrale[centralIdx].quantity + move.quantity);
            company.magazzinoCentrale[centralIdx].totalCost -= (unitCost * move.quantity);
            
            await updateDoc(doc(db, 'companies', companyId), { magazzinoCentrale: sanitizeData(company.magazzinoCentrale) });
          }
        }
      } else if (move.fromId) {
        const cantiere = await this.getCantiereById(companyId, move.fromId);
        if (cantiere && cantiere.stock) {
          const itemIdx = cantiere.stock.findIndex(i => i.materialeId === move.materialeId);
          if (itemIdx >= 0) {
            cantiere.stock[itemIdx].quantity -= move.quantity;
            const unitCost = cantiere.stock[itemIdx].totalCost / (cantiere.stock[itemIdx].quantity + move.quantity);
            cantiere.stock[itemIdx].totalCost -= (unitCost * move.quantity);
            await updateDoc(doc(db, `companies/${companyId}/cantieri`, move.fromId), { stock: sanitizeData(cantiere.stock) });
          }
        }
      }
      console.log(`Transfer initiated: Material scaled down from source ${move.fromId}`);
    } catch (e) {
      console.error('Error in transfer scale down:', e);
      throw e;
    }
  },

  async acceptTransfer(companyId: string, moveId: string, acceptedByName?: string): Promise<void> {
    const path = `companies/${companyId}/movements/${moveId}`;
    try {
      const moveSnap = await getDoc(doc(db, path));
      if (!moveSnap.exists()) return;
      const move = moveSnap.data() as StockMovement;
      if (move.status !== 'pending' || !move.toId) return;

      const nowIso = new Date().toISOString();

      // 1. Update Movement Status
      await updateDoc(doc(db, path), { 
        status: 'accepted',
        acceptedAt: nowIso,
        acceptedBy: acceptedByName || 'Capocantiere'
      });

      // 2. Carico su Cantiere di Destinazione - ONLY if not already charged from a Document
      // If it has a documentId, it was already charged in saveMaterialDocument
      if (!move.documentId) {
        const cantiere = await this.getCantiereById(companyId, move.toId);
        if (cantiere) {
          const stock = cantiere.stock || [];
          const itemIdx = stock.findIndex(i => i.materialeId === move.materialeId);
          const totalAddedCost = (move.costoUnitario || 0) * move.quantity;

          if (itemIdx >= 0) {
            stock[itemIdx].quantity = (stock[itemIdx].quantity || 0) + move.quantity;
            stock[itemIdx].totalCost = (stock[itemIdx].totalCost || 0) + totalAddedCost;
          } else {
            stock.push({
              materialeId: move.materialeId,
              materialeName: move.materialeName,
              quantity: move.quantity,
              unit: 'u',
              totalCost: totalAddedCost
            });
          }

          const newTotalMaterialCost = (cantiere.totalMaterialCost || 0) + totalAddedCost;

          await updateDoc(doc(db, `companies/${companyId}/cantieri`, move.toId), { 
            stock: sanitizeData(stock),
            totalMaterialCost: newTotalMaterialCost
          });
        }
      }

      // 3. Update related MaterialDocument if present
      if (move.documentId) {
        await this.syncDocumentAcceptanceState(companyId, move.documentId);
      }

      console.log(`Transfer/Delivery ${moveId} accepted and status updated.`);
    } catch (e) {
      console.error('Error accepting transfer:', e);
      throw e;
    }
  },

  async syncDocumentAcceptanceState(companyId: string, documentId: string): Promise<void> {
    const docRef = doc(db, 'companies', companyId, 'documents', documentId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const documentData = snap.data() as MaterialDocument;

    // Check movements linked to this document
    const movQuery = query(collection(db, `companies/${companyId}/movements`), where('documentId', '==', documentId));
    const movSnap = await getDocs(movQuery);
    const linkedMoves = movSnap.docs.map(d => d.data() as StockMovement);

    if (linkedMoves.length === 0) return;

    const allAccepted = linkedMoves.every(m => m.status === 'accepted');
    const someAccepted = linkedMoves.some(m => m.status === 'accepted');

    const updatedStatus = allAccepted ? 'accettata' : (someAccepted ? 'parzialmente_accettata' : 'in_attesa_accettazione');
    await updateDoc(docRef, { 
      status: updatedStatus,
      acceptedAt: allAccepted ? new Date().toISOString() : documentData.acceptedAt || ''
    });
  },

  async acceptEntireDocument(companyId: string, documentId: string, acceptedByName?: string): Promise<void> {
    try {
      const movQuery = query(
        collection(db, `companies/${companyId}/movements`), 
        where('documentId', '==', documentId),
        where('status', '==', 'pending')
      );
      const movSnap = await getDocs(movQuery);
      
      for (const mDoc of movSnap.docs) {
        await this.acceptTransfer(companyId, mDoc.id, acceptedByName || 'Amministratore');
      }

      await this.syncDocumentAcceptanceState(companyId, documentId);
    } catch (e) {
      console.error('Error accepting entire document:', e);
      throw e;
    }
  },

  async deleteMaterialDocument(companyId: string, documentId: string): Promise<void> {
    const path = `companies/${companyId}/documents/${documentId}`;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'documents', documentId));
      
      // Also cleanup associated movements if still pending
      const movQuery = query(collection(db, `companies/${companyId}/movements`), where('documentId', '==', documentId));
      const movSnap = await getDocs(movQuery);
      for (const d of movSnap.docs) {
        await deleteDoc(doc(db, `companies/${companyId}/movements`, d.id));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
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
  },

  // Documents (Bolle/Fatture)
  async getMaterialDocuments(companyId: string): Promise<MaterialDocument[]> {
    const path = `companies/${companyId}/documents`;
    try {
      const q = query(collection(db, path), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialDocument));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveMaterialDocument(companyId: string, docData: MaterialDocument): Promise<void> {
    const path = `companies/${companyId}/documents/${docData.id}`;
    try {
      let finalDoc: MaterialDocument = { ...docData };

      // Safe Base64 PDF/Image handling to prevent 1MB Firestore document size limit crash
      if (finalDoc.pdfDataUrl && typeof finalDoc.pdfDataUrl === 'string' && finalDoc.pdfDataUrl.startsWith('data:')) {
        try {
          // Attempt upload to Firebase Storage with a 3s timeout
          const fileRef = ref(storage, `companies/${companyId}/documents/${docData.id}_${docData.fileName || 'document.pdf'}`);
          const base64Parts = finalDoc.pdfDataUrl.split(',');
          if (base64Parts.length > 1) {
            const mimeMatch = base64Parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
            const bstr = atob(base64Parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            
            const uploadTask = uploadBytes(fileRef, blob).then(() => getDownloadURL(fileRef));
            const timeoutTask = new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Storage upload timeout')), 3000)
            );
            
            const downloadUrl = await Promise.race([uploadTask, timeoutTask]);
            finalDoc.pdfDataUrl = downloadUrl;
          }
        } catch (storageErr) {
          console.warn('Firebase Storage upload unavailable, timed out or bypassed:', storageErr);
          // If base64 string exceeds 300KB, strip it from the document payload to guarantee Firestore size < 1MB
          if (finalDoc.pdfDataUrl.length > 300000) {
            console.warn('pdfDataUrl exceeds 300KB and storage upload failed. Omitting raw Base64 string to prevent 1MB Firestore size limit error.');
            delete finalDoc.pdfDataUrl;
          }
        }
      }

      const cleanDoc = sanitizeData(finalDoc);
      await setDoc(doc(db, 'companies', companyId, 'documents', docData.id), cleanDoc);
      
      // Create movements for each spacchettamento item
      for (let idx = 0; idx < docData.items.length; idx++) {
        const item = docData.items[idx];
        const destination = item.destinationCantiereId || docData.destinationCantiereId || 'centrale';
        const isCentral = destination === 'centrale';
        const movId = `mov-${docData.id}-${item.materialeId || idx}-${idx}`;

        const movData: StockMovement = {
          id: movId,
          materialeId: item.materialeId || `mat-${idx}`,
          materialeName: item.materialeName,
          quantity: item.quantity,
          type: isCentral ? 'carico_magazzino' : 'trasferimento_cantiere',
          date: docData.date,
          fromId: isCentral ? 'centrale' : `Fornitore: ${docData.supplier}`,
          toId: destination,
          costoUnitario: item.unitPrice,
          documentId: docData.id,
          documentNumber: docData.number,
          supplier: docData.supplier,
          acceptanceNote: docData.acceptanceNote || '',
          photoUrl: docData.photoUrl || '',
          status: isCentral ? 'accepted' : (docData.status === 'accettata' ? 'accepted' : 'pending'),
          acceptedAt: isCentral || docData.status === 'accettata' ? new Date().toISOString() : undefined,
          acceptedBy: isCentral ? 'Sistema (Magazzino Centrale)' : (docData.status === 'accettata' ? 'Amministratore' : undefined)
        };

        await this.addMovement(companyId, movData);

      }

      // ASYNC CHARGE TO CANTIERE: hitting the account with the full sum of all assigned materials in this document
      const cantiereChargeMap = new Map<string, { totalAddedCost: number; items: typeof docData.items }>();
      for (const item of (docData.items || [])) {
        const dest = item.destinationCantiereId || docData.destinationCantiereId || 'magazzino_centrale';
        if (dest && dest !== 'magazzino_centrale') {
          const entry = cantiereChargeMap.get(dest) || { totalAddedCost: 0, items: [] };
          const itemCost = Number(item.totalPrice) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
          entry.totalAddedCost += itemCost;
          entry.items.push(item);
          cantiereChargeMap.set(dest, entry);
        }
      }

      for (const [cId, charge] of cantiereChargeMap.entries()) {
        try {
          const cantiere = await this.getCantiereById(companyId, cId);
          if (cantiere) {
            const stock = [...(cantiere.stock || [])];
            for (const item of charge.items) {
              const itemCost = Number(item.totalPrice) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
              const itemIdx = stock.findIndex(i => i.materialeId === item.materialeId);
              if (itemIdx >= 0) {
                stock[itemIdx].quantity = (Number(stock[itemIdx].quantity) || 0) + (Number(item.quantity) || 0);
                stock[itemIdx].totalCost = (Number(stock[itemIdx].totalCost) || 0) + itemCost;
              } else {
                stock.push({
                  materialeId: item.materialeId || `mat-${Date.now()}`,
                  materialeName: item.materialeName,
                  quantity: Number(item.quantity) || 0,
                  unit: item.unit || 'pz',
                  totalCost: itemCost
                });
              }
            }
            const prevCost = Number(cantiere.totalMaterialCost) || 0;
            await updateDoc(doc(db, `companies/${companyId}/cantieri`, cId), {
              stock: sanitizeData(stock),
              totalMaterialCost: prevCost + charge.totalAddedCost
            });
          }
        } catch (cantiereErr) {
          console.error('Error charging cantiere account from document:', cantiereErr);
        }
      }

      // CRITICAL: Automatically update or create Supplier in the Archivio Fornitori
      if (docData.supplier && docData.supplier.trim()) {
        try {
          await this.recordSupplierFromDocument(
            companyId,
            docData.supplier.trim(),
            docData.date || new Date().toISOString().split('T')[0],
            docData.totalAmount || 0
          );
        } catch (suppErr) {
          console.warn('[Archivio Fornitori] Non-blocking update error:', suppErr);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async uploadFile(companyId: string, path: string, file: File | Blob): Promise<string> {
    // Resilient file upload with 5s timeout & base64 fallback to prevent any network hangs
    try {
      const storageRef = ref(storage, `companies/${companyId}/${path}`);
      const uploadPromise = uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Storage upload timeout')), 5000)
      );
      return await Promise.race([uploadPromise, timeoutPromise]);
    } catch (e) {
      console.warn('Storage upload bypassed or failed, falling back to local data URL:', e);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }
  },

  // Cantieri Real-Time Chat (Text & Voice Messaging)
  async sendChatMessage(companyId: string, message: CantiereChatMessage): Promise<void> {
    const path = `companies/${companyId}/cantieriChat/${message.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'cantieriChat', message.id), sanitizeData(message));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Cantieri Technical Archive Documents
  async saveTechnicalDoc(companyId: string, docData: CantiereDocumentoTecnico): Promise<void> {
    const path = `companies/${companyId}/archivioTecnico/${docData.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'archivioTecnico', docData.id), sanitizeData(docData));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteTechnicalDoc(companyId: string, docId: string): Promise<void> {
    const path = `companies/${companyId}/archivioTecnico/${docId}`;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'archivioTecnico', docId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Archivio Fornitori (Suppliers Archive)
  async getFornitori(companyId: string): Promise<Fornitore[]> {
    const path = `companies/${companyId}/fornitori`;
    try {
      const q = query(collection(db, path), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Fornitore));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveFornitore(companyId: string, fornitore: Fornitore): Promise<void> {
    const path = `companies/${companyId}/fornitori/${fornitore.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'fornitori', fornitore.id), sanitizeData(fornitore));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteFornitore(companyId: string, fornitoreId: string): Promise<void> {
    const path = `companies/${companyId}/fornitori/${fornitoreId}`;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'fornitori', fornitoreId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Auto-record or update a supplier whenever a new document (bolla o fattura) is recorded
  async recordSupplierFromDocument(
    companyId: string,
    supplierName: string,
    docDate: string,
    docTotal: number,
    extra?: Partial<Fornitore>
  ): Promise<Fornitore> {
    const cleanName = supplierName.trim();
    if (!cleanName) {
      throw new Error('Nome fornitore non valido');
    }

    const path = `companies/${companyId}/fornitori`;
    const snapshot = await getDocs(collection(db, path));
    const existingDoc = snapshot.docs.find(d => {
      const data = d.data();
      return (data.name || '').trim().toLowerCase() === cleanName.toLowerCase();
    });

    const now = new Date().toISOString();

    if (existingDoc) {
      const existing = existingDoc.data() as Fornitore;
      const updated: Fornitore = {
        ...existing,
        name: existing.name || cleanName,
        totalOrdersCount: (existing.totalOrdersCount || 0) + 1,
        totalSpent: parseFloat(((existing.totalSpent || 0) + (docTotal || 0)).toFixed(2)),
        lastOrderDate: docDate || existing.lastOrderDate || now.split('T')[0],
        updatedAt: now,
        ...(extra || {})
      };
      await setDoc(doc(db, path, existingDoc.id), sanitizeData(updated));
      return updated;
    } else {
      // Create new supplier in archive
      const newId = `forn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newSupplier: Fornitore = {
        id: newId,
        name: cleanName,
        totalOrdersCount: 1,
        totalSpent: parseFloat((docTotal || 0).toFixed(2)),
        lastOrderDate: docDate || now.split('T')[0],
        createdAt: now,
        updatedAt: now,
        ...(extra || {})
      };
      await setDoc(doc(db, path, newId), sanitizeData(newSupplier));
      return newSupplier;
    }
  },

  // Timbrature / Badge Presenze (GPS Clock In/Out)
  async getTimbrature(companyId: string): Promise<TimbraturaBadge[]> {
    const path = `companies/${companyId}/timbrature`;
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TimbraturaBadge));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async saveTimbratura(companyId: string, timbratura: TimbraturaBadge): Promise<void> {
    const path = `companies/${companyId}/timbrature/${timbratura.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'timbrature', timbratura.id), sanitizeData(timbratura));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteTimbratura(companyId: string, timbraturaId: string): Promise<void> {
    const path = `companies/${companyId}/timbrature/${timbraturaId}`;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'timbrature', timbraturaId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Material Requests
  async saveMaterialRequest(companyId: string, request: MaterialRequest): Promise<void> {
    const path = `companies/${companyId}/materialRequests/${request.id}`;
    try {
      await setDoc(doc(db, 'companies', companyId, 'materialRequests', request.id), sanitizeData(request));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async getMaterialRequests(companyId: string): Promise<MaterialRequest[]> {
    const path = `companies/${companyId}/materialRequests`;
    try {
      const q = query(collection(db, path), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialRequest));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async updateMaterialRequestStatus(companyId: string, requestId: string, status: MaterialRequestStatus): Promise<void> {
    const path = `companies/${companyId}/materialRequests/${requestId}`;
    try {
      await updateDoc(doc(db, path), { 
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },
};

