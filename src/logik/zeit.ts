import type { Faelligkeit, Zeitstempel } from '../modell/typen';

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function zwei(n: number): string {
  return String(n).padStart(2, '0');
}

/** Aktueller Zeitpunkt als Zeitstempel (UTC, sekundengenau). */
export function jetztStempel(d: Date = new Date()): Zeitstempel {
  return d.toISOString().slice(0, 19) + 'Z';
}

/** Ortsdatum "2026-11-15" eines Zeitpunkts. */
export function lokalesDatum(d: Date = new Date()): string {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/** Ortsdatum eines Zeitstempels. */
export function datumVon(stempel: Zeitstempel): string {
  return lokalesDatum(new Date(stempel));
}

/** Ganze Tage von `von` bis `bis` (beides Ortsdaten), z. B. morgen = 1, gestern = -1. */
export function tageZwischen(von: string, bis: string): number {
  const ms = (datum: string) => {
    const [j, m, t] = datum.split('-').map(Number);
    return Date.UTC(j, m - 1, t);
  };
  return Math.round((ms(bis) - ms(von)) / 86_400_000);
}

/** Verschiebt ein Ortsdatum um eine Anzahl Tage (negativ = zurück). */
export function verschiebeDatum(datum: string, tage: number): string {
  const [j, m, t] = datum.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t + tage));
  return `${d.getUTCFullYear()}-${zwei(d.getUTCMonth() + 1)}-${zwei(d.getUTCDate())}`;
}

/** "15. Nov", bei anderen Jahren "15. Nov 2024". Erwartet ein Ortsdatum. */
export function formatOrtsdatum(datum: string, heute: string = lokalesDatum()): string {
  const [j, m, t] = datum.split('-').map(Number);
  const basis = `${t}. ${MONATE[m - 1]}`;
  return datum.slice(0, 4) === heute.slice(0, 4) ? basis : `${basis} ${j}`;
}

/** Erstelldatum einer Notiz in Kurzform. */
export function formatStempel(stempel: Zeitstempel, heute: string = lokalesDatum()): string {
  return formatOrtsdatum(datumVon(stempel), heute);
}

/** Kopfzeile der Startseite: "Sonntag, 15. Nov 2026". */
export function formatKopfdatum(d: Date = new Date()): string {
  return `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

export function faelligDatum(faellig: Faelligkeit): string {
  return faellig.slice(0, 10);
}

export function faelligUhrzeit(faellig: Faelligkeit): string | null {
  return faellig.length > 10 ? faellig.slice(11, 16) : null;
}

/** "heute", "morgen 18:00", "20. Nov" … */
export function formatFaellig(faellig: Faelligkeit, heute: string = lokalesDatum()): string {
  const datum = faelligDatum(faellig);
  const uhrzeit = faelligUhrzeit(faellig);
  let tag: string;
  if (datum === heute) tag = 'heute';
  else if (datum === verschiebeDatum(heute, 1)) tag = 'morgen';
  else if (datum === verschiebeDatum(heute, -1)) tag = 'gestern';
  else tag = formatOrtsdatum(datum, heute);
  return uhrzeit ? `${tag} ${uhrzeit}` : tag;
}

/** Ortszeit als Text "2026-11-16T10:30" – so, wie auch Fälligkeiten mit Uhrzeit gespeichert sind. */
export function lokalJetzt(d: Date = new Date()): string {
  return `${lokalesDatum(d)}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}
