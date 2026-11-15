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
