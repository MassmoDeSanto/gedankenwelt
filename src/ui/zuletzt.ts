/**
 * Merkt sich die zuletzt geöffnete Liste – nur auf diesem Gerät
 * (im einfachen Schlüssel-Wert-Speicher des Browsers, „localStorage“).
 */
const SCHLUESSEL = 'gedankenwelt.zuletzt';

export function merkeZuletzt(liste_id: string): void {
  try {
    localStorage.setItem(SCHLUESSEL, liste_id);
  } catch {
    // Speicher gesperrt (z. B. privates Fenster): dann eben ohne Merken
  }
}

export function zuletztGeoeffnet(): string | null {
  try {
    return localStorage.getItem(SCHLUESSEL);
  } catch {
    return null;
  }
}
