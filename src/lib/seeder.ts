import { firestoreService } from './firestoreService';
import { Materiale, Personale, MaterialDocument } from '../types';

export const seedSimulationData = async (companyId: string) => {
  const materials: Materiale[] = [
    { id: 'mat-1', name: 'Cemento RCK 325 (25kg)', unit: 'sacchi', defaultPrice: 6.50, category: 'Edili' },
    { id: 'mat-2', name: 'Cemento RCK 425 (25kg)', unit: 'sacchi', defaultPrice: 7.20, category: 'Edili' },
    { id: 'mat-3', name: 'Sabbia Vagliata', unit: 'mc', defaultPrice: 22.00, category: 'Edili' },
    { id: 'mat-4', name: 'Ghiaia 15-30', unit: 'mc', defaultPrice: 18.50, category: 'Edili' },
    { id: 'mat-5', name: 'Mattoni Pieni (UNI)', unit: 'cad', defaultPrice: 0.45, category: 'Edili' },
    { id: 'mat-6', name: 'Forati 8x25x25', unit: 'cad', defaultPrice: 0.65, category: 'Edili' },
    { id: 'mat-7', name: 'Forati 12x25x25', unit: 'cad', defaultPrice: 0.85, category: 'Edili' },
    { id: 'mat-8', name: 'Tavelloni 100cm', unit: 'cad', defaultPrice: 3.20, category: 'Edili' },
    { id: 'mat-9', name: 'Rete Elettrosaldata 20x20 Ø6', unit: 'fogli', defaultPrice: 12.00, category: 'Edili' },
    { id: 'mat-10', name: 'Ferro Ø10 (6mt)', unit: 'barre', defaultPrice: 5.40, category: 'Edili' },
    { id: 'mat-11', name: 'Ferro Ø12 (6mt)', unit: 'barre', defaultPrice: 7.80, category: 'Edili' },
    { id: 'mat-12', name: 'Calce Idrata (25kg)', unit: 'sacchi', defaultPrice: 5.10, category: 'Edili' },
    { id: 'mat-13', name: 'Premiscelato Intonaco (25kg)', unit: 'sacchi', defaultPrice: 4.80, category: 'Edili' },
    { id: 'mat-14', name: 'Guaina Ardesiata (10mq)', unit: 'rotoli', defaultPrice: 45.00, category: 'Edili' },
    { id: 'mat-15', name: 'Pannelli XPS 5cm', unit: 'mq', defaultPrice: 11.50, category: 'Edili' },
    { id: 'mat-16', name: 'Pannelli Lana di Roccia 8cm', unit: 'mq', defaultPrice: 14.20, category: 'Edili' },
    { id: 'mat-17', name: 'Tubo PVC Ø100', unit: 'mt', defaultPrice: 3.80, category: 'Idraulici' },
    { id: 'mat-18', name: 'Tubo Corrugato Ø40', unit: 'mt', defaultPrice: 1.20, category: 'Elettrici' },
    { id: 'mat-19', name: 'Chiodi Carpenteria', unit: 'kg', defaultPrice: 2.50, category: 'Edili' },
    { id: 'mat-20', name: 'Filo Cotto', unit: 'kg', defaultPrice: 1.80, category: 'Edili' },
  ];

  // 1. Save Materials Metadata
  for (const m of materials) {
    await firestoreService.saveMateriale(companyId, m);
  }

  // 2. Create a "Bolla di Carico Iniziale" to fill the warehouse
  const initialDoc: MaterialDocument = {
    id: 'doc-seed-' + Date.now(),
    number: 'BOLLA-SIM-001',
    date: new Date().toISOString().split('T')[0],
    supplier: 'Fornitore Generale Edilizia S.p.A.',
    type: 'bolla',
    items: materials.map(m => ({
      materialeId: m.id,
      materialeName: m.name,
      quantity: 100, // Load 100 of each
      unit: m.unit,
      unitPrice: m.defaultPrice,
      totalPrice: 100 * m.defaultPrice
    })),
    totalAmount: materials.reduce((acc, m) => acc + (100 * m.defaultPrice), 0),
    status: 'registrato'
  };

  await firestoreService.saveMaterialDocument(companyId, initialDoc);

  // 3. Update Personnel Hourly Rates if they exist
  const personnel = await firestoreService.getPersonale(companyId);
  const rates: Record<string, number> = {
    'Capocantiere': 35,
    'Muratore Specializzato': 28,
    'Operaio Generico': 22,
    'Gruista': 30,
    'Tecnico': 45
  };

  for (const p of personnel) {
    if (rates[p.role]) {
      await firestoreService.savePersonale(companyId, { ...p, hourlyRate: rates[p.role] });
    }
  }
};
