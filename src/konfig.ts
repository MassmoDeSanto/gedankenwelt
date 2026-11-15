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
