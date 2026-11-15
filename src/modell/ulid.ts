/**
 * ULID: 26 Zeichen lange ID. Die ersten 10 Zeichen sind die Uhrzeit, die
 * restlichen 16 Zufall. Dadurch sind IDs eindeutig und nach Zeit sortierbar.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let letzteZeit = -1;
let letzterZufall: number[] = [];

function zufall(): number[] {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 32);
}

export function neueId(zeit: number = Date.now()): string {
  if (zeit <= letzteZeit) {
    // Gleiche Millisekunde: Zufallsteil um eins erhöhen, damit die Reihenfolge stimmt.
    zeit = letzteZeit;
    for (let i = letzterZufall.length - 1; i >= 0; i--) {
      if (letzterZufall[i] < 31) {
        letzterZufall[i]++;
        break;
      }
      letzterZufall[i] = 0;
    }
  } else {
    letzteZeit = zeit;
    letzterZufall = zufall();
  }

  let zeitTeil = '';
  let rest = zeit;
  for (let i = 0; i < 10; i++) {
    zeitTeil = ALPHABET[rest % 32] + zeitTeil;
    rest = Math.floor(rest / 32);
  }
  return zeitTeil + letzterZufall.map((z) => ALPHABET[z]).join('');
}

export function istUlid(wert: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(wert);
}

/**
 * Macht aus einem Text immer dieselbe ID (26 gültige Zeichen).
 * Gebraucht für Absätze, die jemand von Hand in Drive geschrieben hat: Sie haben
 * noch keine ID, sollen aber bei jedem Einlesen als dieselbe Notiz erkannt werden.
 */
export function festeId(hinweis: string): string {
  let id = '';
  for (let stelle = 0; stelle < 26; stelle++) {
    let h = 0x811c9dc5 ^ (stelle * 0x9e3779b1);
    for (let i = 0; i < hinweis.length; i++) {
      h ^= hinweis.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    // Das erste Zeichen einer ULID darf höchstens „7“ sein.
    id += ALPHABET[(h >>> 0) % (stelle === 0 ? 8 : 32)];
  }
  return id;
}
