/**
 * Schreibimpulse im Tagebuch (KONZEPT.md, Abschnitt 13.3): eine Frage pro Tag.
 *
 * Die Frage ergibt sich fest aus dem Datum. So zeigen alle Geräte dieselbe Frage, ohne dass
 * ein Verlauf abgeglichen werden muss. Die Fragen werden in Runden gemischt: Innerhalb einer
 * Runde (so viele Tage, wie es Fragen gibt) kommt keine doppelt.
 */

export const STANDARD_IMPULSE: string[] = [
  // Dankbarkeit
  'Wofür bist du heute dankbar?',
  'Was war heute ein kleiner Glücksmoment?',
  'Wer hat dir heute etwas Gutes getan?',
  'Was hast du heute genossen, ohne es zu planen?',
  'Welche Kleinigkeit hat deinen Tag besser gemacht?',
  'Worüber hast du heute gelacht?',
  'Was an deinem Alltag nimmst du zu oft als selbstverständlich?',
  'Welcher Ort hat dir heute gutgetan?',
  'Was ist heute leichter gefallen als erwartet?',
  'Wofür bist du dir selbst heute dankbar?',
  'Welches Geräusch, welcher Geruch oder Anblick ist dir heute angenehm aufgefallen?',
  'Was besitzt du, über das du dich heute gefreut hast?',
  // Rückblick
  'Was war heute das Wichtigste?',
  'Was hast du heute gelernt?',
  'Worauf bist du heute stolz?',
  'Was würdest du an diesem Tag anders machen?',
  'Welcher Moment von heute soll dir in Erinnerung bleiben?',
  'Was hat dich heute überrascht?',
  'Was hat dich heute geärgert, und was steckt dahinter?',
  'Welche Entscheidung hast du heute getroffen?',
  'Was hast du heute zu Ende gebracht?',
  'Womit hast du heute mehr Zeit verbracht als gedacht?',
  'Welcher Gedanke ging dir heute nicht aus dem Kopf?',
  'Was hat heute nicht geklappt, und was nimmst du daraus mit?',
  // Ausblick
  'Worauf freust du dich morgen?',
  'Was möchtest du morgen auf jeden Fall erledigen?',
  'Was willst du diese Woche anders machen?',
  'Welches Vorhaben schiebst du schon zu lange vor dir her?',
  'Was wäre ein guter erster Schritt für etwas, das du dir wünschst?',
  'Wie soll sich der nächste Monat anfühlen?',
  'Was möchtest du in einem Jahr über diese Zeit sagen können?',
  'Welche Idee willst du weiterverfolgen?',
  'Wem möchtest du bald wieder schreiben oder anrufen?',
  'Was kannst du morgen weglassen?',
  'Was würde den morgigen Tag leichter machen?',
  'Welche Gewohnheit möchtest du stärken?',
  // Energie
  'Was hat dir heute Energie gegeben?',
  'Was hat dir heute Kraft gekostet?',
  'Wie hast du heute geschlafen, und wie hat sich das angefühlt?',
  'Wann warst du heute ganz bei der Sache?',
  'Wie geht es deinem Körper heute?',
  'Was hat dich heute zur Ruhe kommen lassen?',
  'Wie war deine Stimmung am Morgen und wie am Abend?',
  'Wann hast du dich heute gehetzt gefühlt?',
  'Was brauchst du gerade mehr: Ruhe oder Bewegung?',
  'Was hat dir heute gefehlt?',
  'Wobei hast du heute die Zeit vergessen?',
  'Wie hast du heute für dich gesorgt?',
  // Begegnungen
  'Mit wem hast du heute ein gutes Gespräch geführt?',
  'Wen hast du heute vermisst?',
  'Wem hast du heute geholfen?',
  'Welcher Satz von jemand anderem ist dir hängen geblieben?',
  'Wen hast du heute neu kennengelernt oder neu gesehen?',
  'Mit wem möchtest du mehr Zeit verbringen?',
  'Wer hat dich heute zum Nachdenken gebracht?',
  'Was hast du heute über einen anderen Menschen erfahren?',
  'Wem schuldest du noch ein Dankeschön?',
  'Wie bist du heute mit anderen umgegangen?',
  'Wo hast du heute zugehört, statt zu reden?',
  'Welche Begegnung von heute hätte anders laufen können?',
];

/** Tage seit dem 1. Januar 2000 für ein Datum "2026-11-22". */
function tagNummer(datum: string): number {
  const [j, m, t] = datum.split('-').map(Number);
  return Math.floor((Date.UTC(j, m - 1, t) - Date.UTC(2000, 0, 1)) / 86_400_000);
}

/** Kleiner, fester Zufallsgenerator: gleicher Startwert → gleiche Zahlenfolge auf jedem Gerät. */
function zufall(startwert: number): () => number {
  let a = startwert >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reihenfolge der Fragen in einer Runde (gemischt, für jede Runde anders). */
function runde(anzahl: number, nummer: number): number[] {
  const reihe = Array.from({ length: anzahl }, (_, i) => i);
  const z = zufall(nummer * 2654435761 + anzahl);
  for (let i = anzahl - 1; i > 0; i--) {
    const k = Math.floor(z() * (i + 1));
    [reihe[i], reihe[k]] = [reihe[k], reihe[i]];
  }
  return reihe;
}

/**
 * Die Frage für einen Tag. `weiter` zählt, wie oft „↻ andere Frage“ getippt wurde:
 * Es geht dann in der gemischten Reihe dieser Runde weiter.
 */
export function impulsFuer(datum: string, fragen: string[], weiter = 0): string | null {
  const pool = fragen.map((f) => f.trim()).filter(Boolean);
  if (pool.length === 0) return null;
  const nummer = tagNummer(datum);
  const reihe = runde(pool.length, Math.floor(nummer / pool.length));
  return pool[reihe[(nummer + weiter) % pool.length]];
}

/** Fragen aus einem Textfeld: eine pro Zeile, leere Zeilen und doppelte fallen weg. */
export function fragenAusText(text: string): string[] {
  return [...new Set(text.split('\n').map((z) => z.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}
