import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const NOTIFICATION_ID = 21000; // ID fixe pour le rappel quotidien
const REMINDER_HOUR = 21;
const REMINDER_MINUTE = 0;

/**
 * Vérifie les permissions et programme les notifications de rappel
 * pour les 30 prochains jours ouvrables.
 */
export async function setupDailyReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Demander la permission
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      console.log('[Notifications] Permission refusée');
      return;
    }

    // Annuler les anciennes notifications programmées
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    // Programmer pour les 30 prochains jours ouvrables
    const notifications = [];
    const now = new Date();
    let count = 0;

    for (let i = 0; i < 45 && count < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      date.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);

      // Ignorer si c'est dans le passé
      if (date.getTime() <= Date.now()) continue;

      // Jours ouvrables uniquement (lundi=1 à vendredi=5)
      const day = date.getDay();
      if (day === 0 || day === 6) continue;

      notifications.push({
        id: NOTIFICATION_ID + count,
        title: 'DomiTemps — Rappel pointage',
        body: 'Avez-vous pensé à saisir votre pointage aujourd\'hui ?',
        schedule: { at: date },
        sound: 'default',
        smallIcon: 'ic_stat_icon_config_sample',
        actionTypeId: '',
        extra: { type: 'daily_reminder' },
      });
      count++;
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log(`[Notifications] ${notifications.length} rappels programmés`);
    }
  } catch (err) {
    console.error('[Notifications] Erreur setup:', err);
  }
}

/**
 * Annule un rappel pour aujourd'hui (appelé quand un pointage est créé)
 */
export async function cancelTodayReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const toCancel = pending.notifications.filter((n) => {
      if (!n.schedule?.at) return false;
      const schedTime = new Date(n.schedule.at).getTime();
      return schedTime >= today.getTime() && schedTime < tomorrow.getTime();
    });

    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
      console.log('[Notifications] Rappel du jour annulé (pointage effectué)');
    }
  } catch (err) {
    console.error('[Notifications] Erreur cancel:', err);
  }
}
