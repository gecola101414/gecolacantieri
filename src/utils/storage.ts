import { Cantiere, Personale, Mezzo, Rapportino, ContabilitaEntry, UserAccount, Company } from '../types';
import { INITIAL_CANTIERI, INITIAL_PERSONALE, INITIAL_MEZZI, INITIAL_CONTABILITA, INITIAL_RAPPORTINI, INITIAL_USERS, INITIAL_COMPANY } from '../data/mockData';

const STORAGE_KEYS = {
  COMPANY: 'cantieri_cloud_company',
  CANTIERI: 'cantieri_cloud_cantieri',
  PERSONALE: 'cantieri_cloud_personale',
  MEZZI: 'cantieri_cloud_mezzi',
  CONTABILITA: 'cantieri_cloud_contabilita',
  RAPPORTINI: 'cantieri_cloud_rapportini',
  USERS: 'cantieri_cloud_users',
  CURRENT_USER: 'cantieri_cloud_current_user',
};

export const getStoredData = <T>(key: string, initial: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initial;
  } catch (e) {
    console.error('Error reading localStorage key', key, e);
    return initial;
  }
};

export const setStoredData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error writing localStorage key', key, e);
  }
};

export const loadAppData = () => {
  const company = getStoredData<Company | null>(STORAGE_KEYS.COMPANY, INITIAL_COMPANY);

  // Se non c'è alcuna azienda registrata, azzeriamo totalmente qualsiasi dato residuo in localStorage
  if (!company) {
    localStorage.removeItem(STORAGE_KEYS.CANTIERI);
    localStorage.removeItem(STORAGE_KEYS.PERSONALE);
    localStorage.removeItem(STORAGE_KEYS.MEZZI);
    localStorage.removeItem(STORAGE_KEYS.CONTABILITA);
    localStorage.removeItem(STORAGE_KEYS.RAPPORTINI);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  return {
    company,
    cantieri: company ? getStoredData<Cantiere[]>(STORAGE_KEYS.CANTIERI, INITIAL_CANTIERI) : [],
    personale: company ? getStoredData<Personale[]>(STORAGE_KEYS.PERSONALE, INITIAL_PERSONALE) : [],
    mezzi: company ? getStoredData<Mezzo[]>(STORAGE_KEYS.MEZZI, INITIAL_MEZZI) : [],
    contabilita: company ? getStoredData<ContabilitaEntry[]>(STORAGE_KEYS.CONTABILITA, INITIAL_CONTABILITA) : [],
    rapportini: company ? getStoredData<Rapportino[]>(STORAGE_KEYS.RAPPORTINI, INITIAL_RAPPORTINI) : [],
    users: company ? getStoredData<UserAccount[]>(STORAGE_KEYS.USERS, INITIAL_USERS) : [],
    currentUser: company ? getStoredData<UserAccount | null>(STORAGE_KEYS.CURRENT_USER, null) : null,
  };
};

export const saveCompany = (company: Company | null) => setStoredData(STORAGE_KEYS.COMPANY, company);
export const saveCantieri = (data: Cantiere[]) => setStoredData(STORAGE_KEYS.CANTIERI, data);
export const savePersonale = (data: Personale[]) => setStoredData(STORAGE_KEYS.PERSONALE, data);
export const saveMezzi = (data: Mezzo[]) => setStoredData(STORAGE_KEYS.MEZZI, data);
export const saveContabilita = (data: ContabilitaEntry[]) => setStoredData(STORAGE_KEYS.CONTABILITA, data);
export const saveRapportini = (data: Rapportino[]) => setStoredData(STORAGE_KEYS.RAPPORTINI, data);
export const saveUsers = (data: UserAccount[]) => setStoredData(STORAGE_KEYS.USERS, data);
export const saveCurrentUser = (user: UserAccount | null) => setStoredData(STORAGE_KEYS.CURRENT_USER, user);
