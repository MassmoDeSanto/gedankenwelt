/**
 * Einstellungen, die für alle Geräte gleich sind.
 *
 * Die Google-Client-ID ist kein Geheimnis: Bei Apps, die komplett im Browser
 * laufen, ist sie ohnehin für jeden sichtbar. Sie sagt Google nur, welche App
 * gerade um Zugriff bittet. Wie du sie bekommst, steht in der README.
 */
export const GOOGLE_CLIENT_ID: string = '';

/** Nur Dateien, die die App selbst angelegt hat – nicht der ganze Drive. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Für die Erinnerungen: Die App darf damit nur eigene, zusätzliche Kalender anlegen und deren
 * Termine verwalten. Deine übrigen Kalender kann sie weder lesen noch ändern – nicht einmal die
 * Liste deiner Kalender. (Geprüft in Googles Dokumentation am 16. Nov 2026.)
 */
export const KALENDER_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

/** Zeitzone der Termine. Sommer- und Winterzeit regelt Google anhand dieses Namens. */
export const ZEITZONE = 'Europe/Berlin';

/** Adresse der veröffentlichten App – für den Link im Termin, der die App bei der Aufgabe öffnet. */
export const APP_ADRESSE = 'https://massmodesanto.github.io/gedankenwelt/';
