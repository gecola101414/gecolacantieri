import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import defaultConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(defaultConfig);
export const db = getFirestore(app, defaultConfig.firestoreDatabaseId || '(default)');

export { collection, getDocs, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot };
export default app;
