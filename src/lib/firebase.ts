import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import defaultConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(defaultConfig);
export const db = getFirestore(app, defaultConfig.firestoreDatabaseId || '(default)');
export const storage = getStorage(app);

export { collection, getDocs, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot };
export default app;
