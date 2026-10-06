import { TimbraturaBadge, UserAccount, PresenzaGiornaliera, Cantiere } from '../types';

/**
 * Calculates attendance records aggregated by user and day.
 */
export function calculateDailyPresenze(
  timbrature: TimbraturaBadge[],
  users: UserAccount[],
  cantieri: Cantiere[],
  filterDate?: string
): PresenzaGiornaliera[] {
  // Group by key: `${userId}_${date}`
  const map = new Map<string, TimbraturaBadge[]>();

  timbrature.forEach((t) => {
    if (filterDate && t.date !== filterDate) return;
    const key = `${t.userId}_${t.date}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(t);
  });

  const results: PresenzaGiornaliera[] = [];

  for (const [key, userDayTimbrature] of map.entries()) {
    const [userId, date] = key.split('_');
    const user = users.find((u) => u.id === userId);
    const sorted = [...userDayTimbrature].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstEntrata = sorted.find((t) => t.type === 'entrata');
    const lastUscita = [...sorted].reverse().find((t) => t.type === 'uscita');

    const primaryCantiereId = firstEntrata?.cantiereId || sorted[0]?.cantiereId || '';
    const primaryCantiere = cantieri.find((c) => c.id === primaryCantiereId);
    const cantiereName = primaryCantiere?.name || sorted[0]?.cantiereName || 'Cantiere';

    // Calculate total hours by pairing entrate & uscite
    let totalMinutes = 0;
    let currentInTime: Date | null = null;

    sorted.forEach((t) => {
      if (t.type === 'entrata') {
        currentInTime = new Date(t.timestamp);
      } else if (t.type === 'uscita' && currentInTime) {
        const outTime = new Date(t.timestamp);
        const diffMs = outTime.getTime() - currentInTime.getTime();
        if (diffMs > 0) {
          totalMinutes += diffMs / (1000 * 60);
        }
        currentInTime = null;
      }
    });

    // If currently still on site today
    const isCurrentlyIn = sorted[sorted.length - 1]?.type === 'entrata';
    if (isCurrentlyIn && currentInTime && date === new Date().toISOString().split('T')[0]) {
      const now = new Date();
      const diffMs = now.getTime() - (currentInTime as Date).getTime();
      if (diffMs > 0) {
        totalMinutes += diffMs / (1000 * 60);
      }
    }

    const oreTotali = Math.round((totalMinutes / 60) * 10) / 10;

    // Check if confirmed by capo cantiere
    const confirmedTimbratura = sorted.find((t) => t.confermatoDaCapo);
    const confermatoDaCapo = Boolean(confirmedTimbratura);

    let stato: 'presente' | 'completato' | 'incompleto' = 'completato';
    if (isCurrentlyIn) {
      stato = 'presente';
    } else if (!firstEntrata || !lastUscita) {
      stato = 'incompleto';
    }

    results.push({
      userId,
      userName: user?.name || sorted[0]?.userName || 'Operaio',
      userRole: user?.role || sorted[0]?.userRole || 'operativo',
      date,
      cantiereId: primaryCantiereId,
      cantiereName,
      entrataTime: firstEntrata?.time,
      uscitaTime: lastUscita?.time,
      oreTotali,
      timbrature: sorted,
      confermatoDaCapo,
      confermatoDaNome: confirmedTimbratura?.confermatoDaNome,
      confermatoIl: confirmedTimbratura?.confermatoIl,
      stato,
    });
  }

  // Sort by date desc, then by worker name
  return results.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.userName.localeCompare(b.userName);
  });
}

export interface WorkerMonthlySummary {
  userId: string;
  userName: string;
  userRole: string;
  totalGiornate: number;
  totalOre: number;
  giorniConfermati: number;
  dailyDetails: PresenzaGiornaliera[];
}

/**
 * Calculates monthly presence totals for each worker (total days worked, start & end times, total hours).
 */
export function calculateMonthlyWorkerSummaries(
  presenze: PresenzaGiornaliera[],
  yearMonth: string // e.g. "2026-10"
): WorkerMonthlySummary[] {
  const filtered = presenze.filter((p) => p.date.startsWith(yearMonth));
  const userMap = new Map<string, PresenzaGiornaliera[]>();

  filtered.forEach((p) => {
    if (!userMap.has(p.userId)) {
      userMap.set(p.userId, []);
    }
    userMap.get(p.userId)!.push(p);
  });

  const summaries: WorkerMonthlySummary[] = [];

  for (const [userId, userPresenze] of userMap.entries()) {
    const totalGiornate = userPresenze.length;
    const totalOre = Math.round(userPresenze.reduce((acc, cur) => acc + cur.oreTotali, 0) * 10) / 10;
    const giorniConfermati = userPresenze.filter((p) => p.confermatoDaCapo).length;

    summaries.push({
      userId,
      userName: userPresenze[0]?.userName || 'Operaio',
      userRole: userPresenze[0]?.userRole || 'operativo',
      totalGiornate,
      totalOre,
      giorniConfermati,
      dailyDetails: userPresenze.sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  return summaries.sort((a, b) => b.totalGiornate - a.totalGiornate);
}

/**
 * Returns ISO dates of the current week (Monday to Sunday) for a given date.
 */
export function getWeekDates(baseDateStr: string): string[] {
  const base = new Date(baseDateStr);
  const day = base.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}
