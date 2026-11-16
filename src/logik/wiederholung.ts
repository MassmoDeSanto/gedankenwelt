/**
 * Wiederkehrende Aufgaben (PHASE-3.md, Abschnitt 2).
 *
 * Alles hier rechnet mit reinen Kalenderdaten ("2026-11-23") und Uhrzeiten als Text
 * ("09:00") in Ortszeit. Es gibt keine Umrechnung in Weltzeit – darum bleibt eine
 * Aufgabe um 9:00 auch nach der Zeitumstellung um 9:00.
 *
 * Die Funktionen sind „rein“: Sie bekommen Daten und geben neue Daten zurück.
 */
import type {
  Aufgabe,
  Faelligkeit,
  Wiederholung,
  WiederholungsEnde,
  Wochentag,
  Zeitstempel,
} from '../modell/typen';
import { faelligDatum, faelligUhrzeit, verschiebeDatum } from './zeit';

export const WOCHENTAGE: Wochentag[] = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const WOCHENTAG_KURZ: Record<Wochentag, string> = { MO: 'Mo', DI: 'Di', MI: 'Mi', DO: 'Do', FR: 'Fr', SA: 'Sa', SO: 'So' };
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
/** Wie viele Abhak-Zeitpunkte höchstens aufgehoben werden (die neuesten) */
export const VERLAUF_MAX = 12;

// ───────────────────────── Rechnen mit Kalenderdaten ─────────────────────────

const zwei = (n: number) => String(n).padStart(2, '0');
const datum = (jahr: number, monat: number, tag: number) => `${jahr}-${zwei(monat)}-${zwei(tag)}`;

function teile(d: string): [number, number, number] {
  const [j, m, t] = d.split('-').map(Number);
  return [j, m, t];
}

export function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

export function wochentagVon(d: string): Wochentag {
  const [j, m, t] = teile(d);
  return WOCHENTAGE[(new Date(Date.UTC(j, m - 1, t)).getUTCDay() + 6) % 7];
}

/** Monat um `n` Monate weiterzählen (über Jahresgrenzen hinweg). */
function plusMonate(jahr: number, monat: number, n: number): [number, number] {
  const null_basiert = jahr * 12 + (monat - 1) + n;
  return [Math.floor(null_basiert / 12), (null_basiert % 12) + 1];
}

/** Der Tag im Monat – gibt es ihn nicht (31. im Februar), gilt der letzte Tag des Monats. */
function tagImMonat(jahr: number, monat: number, tag: number): string {
  return datum(jahr, monat, Math.min(tag, tageImMonat(jahr, monat)));
}

/** Der n-te (1–4) oder letzte (−1) Wochentag eines Monats, z. B. erster Montag. */
function wochentagImMonat(jahr: number, monat: number, woche: number, wochentag: Wochentag): string {
  if (woche === -1) {
    let d = datum(jahr, monat, tageImMonat(jahr, monat));
    while (wochentagVon(d) !== wochentag) d = verschiebeDatum(d, -1);
    return d;
  }
  let d = datum(jahr, monat, 1);
  while (wochentagVon(d) !== wochentag) d = verschiebeDatum(d, 1);
  return verschiebeDatum(d, (woche - 1) * 7);
}

// ───────────────────────── Termine einer Regel ─────────────────────────

/** Der nächste Termin der Regel, der echt nach `anker` liegt. */
export function naechsterTermin(w: Wiederholung, anker: string): string {
  const [j, m] = teile(anker);
  const n = Math.max(1, w.intervall);

  switch (w.art) {
    case 'taeglich':
      return verschiebeDatum(anker, n);

    case 'woechentlich': {
      const tage = w.tage.length > 0 ? w.tage : [wochentagVon(anker)];
      const stelle = WOCHENTAGE.indexOf(wochentagVon(anker));
      // Zuerst: ein späterer gewählter Tag in derselben Woche
      for (let i = stelle + 1; i < 7; i++) if (tage.includes(WOCHENTAGE[i])) return verschiebeDatum(anker, i - stelle);
      // Sonst: n Wochen weiter, der erste gewählte Tag jener Woche
      const montag = verschiebeDatum(anker, -stelle + n * 7);
      return verschiebeDatum(montag, WOCHENTAGE.findIndex((tag) => tage.includes(tag)));
    }

    case 'monatlich': {
      const dieser = tagImMonat(j, m, w.tag);
      if (dieser > anker) return dieser;
      const [nj, nm] = plusMonate(j, m, n);
      return tagImMonat(nj, nm, w.tag);
    }

    case 'monatlich-wochentag': {
      const dieser = wochentagImMonat(j, m, w.woche, w.wochentag);
      if (dieser > anker) return dieser;
      const [nj, nm] = plusMonate(j, m, n);
      return wochentagImMonat(nj, nm, w.woche, w.wochentag);
    }

    case 'jaehrlich': {
      const dieses = tagImMonat(j, w.monat, w.tag);
      if (dieses > anker) return dieses;
      return tagImMonat(j + n, w.monat, w.tag);
    }
  }
}

/** Der erste Termin der Regel am oder nach `ab` – für eine neue Wiederholung ohne Datum. */
export function ersterTermin(w: Wiederholung, ab: string): string {
  if (w.art === 'taeglich' || w.ab === 'erledigung') return ab;
  if (w.art === 'woechentlich' && w.tage.length === 0) return ab;
  // „ein Intervall von 1“ genügt für die Suche nach dem ersten passenden Tag
  return naechsterTermin({ ...w, intervall: 1 }, verschiebeDatum(ab, -1));
}

/** „ab Erledigung“: ein Abstand ab dem Tag des Abhakens. */
function nachErledigung(w: Wiederholung, heute: string): string {
  const [j, m, t] = teile(heute);
  const n = Math.max(1, w.intervall);
  switch (w.art) {
    case 'taeglich':
      return verschiebeDatum(heute, n);
    case 'woechentlich':
      return verschiebeDatum(heute, n * 7);
    case 'monatlich': {
      const [nj, nm] = plusMonate(j, m, n);
      return tagImMonat(nj, nm, t);
    }
    case 'monatlich-wochentag': {
      const [nj, nm] = plusMonate(j, m, n);
      return wochentagImMonat(nj, nm, w.woche, w.wochentag);
    }
    case 'jaehrlich':
      return tagImMonat(j + n, m, t);
  }
}

/**
 * Die nächste Fälligkeit nach dem Abhaken – immer in der Zukunft. Verpasste Termine
 * werden übersprungen, nicht nachgeholt.
 * `jetztLokal` ist die Ortszeit des Abhakens, z. B. "2026-11-16T10:30".
 */
export function naechsteFaelligkeit(w: Wiederholung, faellig: Faelligkeit | null, jetztLokal: string): Faelligkeit {
  const heute = jetztLokal.slice(0, 10);
  const uhrzeit = faellig ? faelligUhrzeit(faellig) : null;
  const mitUhrzeit = (d: string) => (uhrzeit ? `${d}T${uhrzeit}` : d);

  if (w.ab === 'erledigung') return mitUhrzeit(nachErledigung(w, heute));

  let d = faellig ? faelligDatum(faellig) : heute;
  const inZukunft = (kandidat: string) => (uhrzeit ? mitUhrzeit(kandidat) > jetztLokal : kandidat > heute);
  for (let runden = 0; runden < 20_000; runden++) {
    d = naechsterTermin(w, d);
    if (inZukunft(d)) break;
  }
  return mitUhrzeit(d);
}

// ───────────────────────── Abhaken ─────────────────────────

export interface AbhakErgebnis {
  aufgabe: Aufgabe;
  /** Die neue Fälligkeit – oder null, wenn die Aufgabe jetzt endgültig erledigt ist. */
  naechste: Faelligkeit | null;
}

/**
 * Hakt eine Aufgabe ab.
 *  - Ohne Wiederholung: erledigt.
 *  - Mit Wiederholung: Sie bleibt offen und springt auf die nächste Fälligkeit; der Zeitpunkt
 *    des Abhakens kommt in den Verlauf. Ist das Ende der Wiederholung erreicht, wird sie
 *    normal erledigt.
 */
export function hakeAb(aufgabe: Aufgabe, jetztLokal: string, stempel: Zeitstempel): AbhakErgebnis {
  const w = aufgabe.wiederholung;
  if (!w) return { aufgabe: { ...aufgabe, erledigt: true, erledigt_am: stempel }, naechste: null };

  const erledigt_verlauf = [...aufgabe.erledigt_verlauf, stempel].slice(-VERLAUF_MAX);
  const fertig: AbhakErgebnis = {
    aufgabe: { ...aufgabe, erledigt: true, erledigt_am: stempel, erledigt_verlauf },
    naechste: null,
  };

  if (w.ende.art === 'anzahl' && w.ende.anzahl <= 1) return fertig;
  const naechste = naechsteFaelligkeit(w, aufgabe.faellig, jetztLokal);
  if (w.ende.art === 'datum' && faelligDatum(naechste) > w.ende.datum) return fertig;

  const ende: WiederholungsEnde = w.ende.art === 'anzahl' ? { art: 'anzahl', anzahl: w.ende.anzahl - 1 } : w.ende;
  return {
    aufgabe: {
      ...aufgabe,
      erledigt: false,
      erledigt_am: null,
      faellig: naechste,
      wiederholung: { ...w, ende },
      erledigt_verlauf,
    },
    naechste,
  };
}

// ───────────────────────── Schnellwerte fürs Menü ─────────────────────────

const STANDARD = { intervall: 1, ab: 'faellig', ende: { art: 'nie' } } as const;

export type Schnellwert = 'taeglich' | 'werktags' | 'woechentlich' | 'monatlich' | 'monatsersten' | 'jaehrlich';

export const SCHNELLWERTE: { wert: Schnellwert; text: string }[] = [
  { wert: 'taeglich', text: 'Täglich' },
  { wert: 'werktags', text: 'Werktags' },
  { wert: 'woechentlich', text: 'Wöchentlich' },
  { wert: 'monatlich', text: 'Monatlich' },
  { wert: 'monatsersten', text: 'Jeden Monatsersten' },
  { wert: 'jaehrlich', text: 'Jährlich' },
];

/** Baut die Regel zu einem Schnellwert. Wochentag, Tag und Monat kommen vom Bezugsdatum. */
export function ausSchnellwert(wert: Schnellwert, bezug: string): Wiederholung {
  const [, m, t] = teile(bezug);
  switch (wert) {
    case 'taeglich':
      return { ...STANDARD, art: 'taeglich' };
    case 'werktags':
      return { ...STANDARD, art: 'woechentlich', tage: ['MO', 'DI', 'MI', 'DO', 'FR'] };
    case 'woechentlich':
      return { ...STANDARD, art: 'woechentlich', tage: [wochentagVon(bezug)] };
    case 'monatlich':
      return { ...STANDARD, art: 'monatlich', tag: t };
    case 'monatsersten':
      return { ...STANDARD, art: 'monatlich', tag: 1 };
    case 'jaehrlich':
      return { ...STANDARD, art: 'jaehrlich', monat: m, tag: t };
  }
}

/** Welchem Schnellwert entspricht die Regel? null = benutzerdefiniert. */
export function alsSchnellwert(w: Wiederholung, bezug: string): Schnellwert | null {
  for (const { wert } of SCHNELLWERTE) {
    if (schreibeRegel(ausSchnellwert(wert, bezug)) === schreibeRegel(w)) return wert;
  }
  return null;
}

// ───────────────────────── Kurztext für die Anzeige ─────────────────────────

const WOCHE_TEXT: Record<number, string> = { 1: '1.', 2: '2.', 3: '3.', 4: '4.', [-1]: 'letzter' };

/** Kurzer Text an der Aufgabe, z. B. „jeden So“, „1. im Monat“, „alle 3 Tage“. */
export function wiederholungKurz(w: Wiederholung): string {
  const n = Math.max(1, w.intervall);

  if (w.ab === 'erledigung') {
    const einheit =
      w.art === 'taeglich'
        ? n === 1 ? 'Tag' : 'Tage'
        : w.art === 'woechentlich'
          ? n === 1 ? 'Woche' : 'Wochen'
          : w.art === 'jaehrlich'
            ? n === 1 ? 'Jahr' : 'Jahre'
            : n === 1 ? 'Monat' : 'Monate';
    return `${n} ${einheit} nach Erledigung`;
  }

  switch (w.art) {
    case 'taeglich':
      return n === 1 ? 'täglich' : `alle ${n} Tage`;
    case 'woechentlich': {
      const tage = WOCHENTAGE.filter((t) => w.tage.includes(t));
      const istWerktags = tage.join() === 'MO,DI,MI,DO,FR';
      const liste = istWerktags ? 'werktags' : tage.map((t) => WOCHENTAG_KURZ[t]).join(', ');
      if (n > 1) return liste ? `alle ${n} Wochen: ${liste}` : `alle ${n} Wochen`;
      if (istWerktags) return 'werktags';
      if (tage.length === 0) return 'wöchentlich';
      return tage.length === 1 ? `jeden ${liste}` : liste;
    }
    case 'monatlich':
      return n === 1 ? `${w.tag}. im Monat` : `alle ${n} Monate am ${w.tag}.`;
    case 'monatlich-wochentag': {
      const text = `${WOCHE_TEXT[w.woche] ?? `${w.woche}.`} ${WOCHENTAG_KURZ[w.wochentag]}`;
      return n === 1 ? `${text} im Monat` : `alle ${n} Monate: ${text}`;
    }
    case 'jaehrlich': {
      const text = `${w.tag}. ${MONATE[w.monat - 1]}`;
      return n === 1 ? `jährlich ${text}` : `alle ${n} Jahre: ${text}`;
    }
  }
}

/** Zusatz zum Ende, z. B. „bis 31. Jan 2027“ oder „noch 3 Mal“. Leer, wenn die Regel nie endet. */
export function endeKurz(ende: WiederholungsEnde): string {
  if (ende.art === 'datum') {
    const [j, m, t] = teile(ende.datum);
    return `bis ${t}. ${MONATE[m - 1]} ${j}`;
  }
  if (ende.art === 'anzahl') return `noch ${ende.anzahl} Mal`;
  return '';
}

/** „Mo, 23. Nov“ – für die Rückmeldung nach dem Abhaken. */
export function formatNaechste(faellig: Faelligkeit, heute: string): string {
  const d = faelligDatum(faellig);
  const [j, m, t] = teile(d);
  const uhrzeit = faelligUhrzeit(faellig);
  const jahr = d.slice(0, 4) === heute.slice(0, 4) ? '' : ` ${j}`;
  return `${WOCHENTAG_KURZ[wochentagVon(d)]}, ${t}. ${MONATE[m - 1]}${jahr}${uhrzeit ? ` ${uhrzeit}` : ''}`;
}

// ───────────────────────── Format im Metadaten-Kommentar ─────────────────────────
//
//   wiederholung:taeglich;ab=faellig
//   wiederholung:taeglich;alle=3;ab=erledigung
//   wiederholung:woechentlich;tage=MO,DO;ab=faellig
//   wiederholung:monatlich;tag=15;ab=faellig
//   wiederholung:monatlich;am=1.MO;ab=faellig          (erster Montag; „letzter.FR“ = letzter Freitag)
//   wiederholung:jaehrlich;datum=03-15;ab=faellig
//   … optional am Ende:  ;ende=2027-01-31   oder   ;noch=3
//
// Keine Leerzeichen, damit die Regel im Kommentar ein einziges Wort bleibt.

export function schreibeRegel(w: Wiederholung | null): string {
  if (!w) return 'keine';
  const teile: string[] = [];
  switch (w.art) {
    case 'taeglich':
      teile.push('taeglich');
      break;
    case 'woechentlich':
      teile.push('woechentlich');
      if (w.tage.length > 0) teile.push(`tage=${WOCHENTAGE.filter((t) => w.tage.includes(t)).join(',')}`);
      break;
    case 'monatlich':
      teile.push('monatlich', `tag=${w.tag}`);
      break;
    case 'monatlich-wochentag':
      teile.push('monatlich', `am=${w.woche === -1 ? 'letzter' : w.woche}.${w.wochentag}`);
      break;
    case 'jaehrlich':
      teile.push('jaehrlich', `datum=${zwei(w.monat)}-${zwei(w.tag)}`);
      break;
  }
  if (w.intervall > 1) teile.push(`alle=${w.intervall}`);
  teile.push(`ab=${w.ab}`);
  if (w.ende.art === 'datum') teile.push(`ende=${w.ende.datum}`);
  if (w.ende.art === 'anzahl') teile.push(`noch=${w.ende.anzahl}`);
  return teile.join(';');
}

const istWochentag = (wert: string): wert is Wochentag => (WOCHENTAGE as string[]).includes(wert);

/** Liest eine Regel. Unbekanntes oder Kaputtes ergibt null (= keine Wiederholung). */
export function leseRegel(text: string | undefined): Wiederholung | null {
  if (!text || text === 'keine') return null;
  const [art, ...rest] = text.split(';');
  const felder = new Map(rest.map((paar) => paar.split('=') as [string, string]));

  const zahl = (schluessel: string, min: number, max: number): number | null => {
    const n = Number(felder.get(schluessel));
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const basis = {
    intervall: zahl('alle', 1, 999) ?? 1,
    ab: felder.get('ab') === 'erledigung' ? ('erledigung' as const) : ('faellig' as const),
    ende: ((): WiederholungsEnde => {
      const ende = felder.get('ende');
      if (ende && /^\d{4}-\d{2}-\d{2}$/.test(ende)) return { art: 'datum', datum: ende };
      const noch = zahl('noch', 1, 9999);
      return noch ? { art: 'anzahl', anzahl: noch } : { art: 'nie' };
    })(),
  };

  if (art === 'taeglich') return { ...basis, art };
  if (art === 'woechentlich') {
    return { ...basis, art, tage: (felder.get('tage') ?? '').split(',').filter(istWochentag) };
  }
  if (art === 'monatlich') {
    const tag = zahl('tag', 1, 31);
    if (tag) return { ...basis, art, tag };
    const [woche, wochentag] = (felder.get('am') ?? '').split('.');
    const nummer = woche === 'letzter' ? -1 : Number(woche);
    if ([1, 2, 3, 4, -1].includes(nummer) && istWochentag(wochentag)) {
      return { ...basis, art: 'monatlich-wochentag', woche: nummer, wochentag };
    }
    return null;
  }
  if (art === 'jaehrlich') {
    const [monat, tag] = (felder.get('datum') ?? '').split('-').map(Number);
    if (monat >= 1 && monat <= 12 && tag >= 1 && tag <= 31) return { ...basis, art, monat, tag };
  }
  return null;
}
