import { Timesheet } from '../stores/timesheetStore.supabase';

/**
 * Détecte un pointage saisi en mode "durée directe" (vs "heures début/fin").
 *
 * Heuristique stricte : le mode durée directe synthétise systématiquement
 * `arrival = 09:00:00.000` local + `departure = arrival + duration*1h`
 * sur une seule journée. Voir TimesheetsTab.tsx (commit e5d9bff).
 *
 * Un pointage horaires démarrant pile à 09:00 sera classé durée directe à tort
 * (faux positif assumé — saisie horaires à 9:00 = ressemble à une durée directe).
 *
 * À remplacer par une vraie colonne `entry_mode` en BDD une fois le BLOCKER
 * (Cathy avril non validée + backup) levé.
 */
export function isDureeDirecte(
  ts: Pick<Timesheet, 'date_arrival' | 'date_departure'>
): boolean {
  const arr = new Date(ts.date_arrival);
  const dep = new Date(ts.date_departure);
  return (
    arr.getHours() === 9 &&
    arr.getMinutes() === 0 &&
    arr.getSeconds() === 0 &&
    arr.getMilliseconds() === 0 &&
    arr.getFullYear() === dep.getFullYear() &&
    arr.getMonth() === dep.getMonth() &&
    arr.getDate() === dep.getDate()
  );
}
