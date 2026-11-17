/**
 * Zerlegt den Text einer Apple-Notiz in Notizen der App (PHASE-4.md, Abschnitt 4).
 *
 * Eingang ist bereinigter Text (siehe bereinigen.ts), egal ob er aus dem Markdown-Export,
 * aus einer Kurzbefehl-Datei oder aus dem Einfügefeld stammt. Ausgang sind „Abschnitte“:
 * die Notizen der Apple-Notiz selbst und – je Überschrift – die Notizen einer Unterliste.
 *
 * Alles hier ist „rein“: keine Datenbank, kein Browser.
 */
import { bereinigeName, vergleichsName } from './bereinigen';
import { leseAufgabe, lesePunkt } from './marker';

export type Trennmodus = 'automatisch' | 'leerzeilen' | 'zeilen';

export interface ZerlegeOptionen {
  /** Wo eine neue Notiz beginnt */
  trennmodus: Trennmodus;
  /** Jeder Aufzählungspunkt wird eine eigene Notiz (eingerückte Unterpunkte bleiben beim Elternpunkt) */
  punkteEinzeln: boolean;
  /** Überschriften werden Unterlisten; sonst bleiben sie als fett geschriebene Notiz stehen */
  ueberschriftenAlsListen: boolean;
}

export const STANDARD_ZERLEGUNG: ZerlegeOptionen = {
  trennmodus: 'automatisch',
  punkteEinzeln: true,
  ueberschriftenAlsListen: true,
};

export interface RohNotiz {
  text: string;
  aufgabe: 'offen' | 'erledigt' | null;
}

export interface Abschnitt {
  /** Überschriften von außen nach innen; leer = die Liste der Apple-Notiz selbst */
  pfad: string[];
  notizen: RohNotiz[];
}

export interface Zerlegung {
  /** Der erste Abschnitt hat immer den leeren Pfad. */
  abschnitte: Abschnitt[];
  /** Bilder, Zeichnungen und andere Anhänge, die nicht übernommen werden */
  anhaenge: number;
  /** Welcher Trennmodus tatsächlich benutzt wurde (bei „automatisch“ die getroffene Wahl) */
  modus: 'leerzeilen' | 'zeilen';
}

// ───────────────────────── Einzelne Zeile säubern ─────────────────────────

/** Bildverweis in Markdown: ![Beschreibung](Pfad) – im Pfad ist ein Klammerpaar erlaubt. */
const BILD = /!\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)/g;
const BILD_HTML = /<img\b[^>]*>/gi;
/** Platzhalter, den Apple im reinen Text an die Stelle eines Anhangs setzt (U+FFFC) */
const OBJEKT = /\uFFFC/g;
const LINK = /\[([^\]\n]+)\]\(((?:[^()\n]|\([^()\n]*\))*)\)/g;
const HAT_SCHEMA = /^[a-z][a-z0-9+.-]*:/i;

/** Entfernt Bilder und Anhänge aus einer Zeile und zählt sie. */
function entferneAnhaenge(zeile: string): { text: string; anzahl: number } {
  let anzahl = 0;
  const zaehle = () => {
    anzahl++;
    return '';
  };
  let text = zeile.replace(BILD, zaehle).replace(BILD_HTML, zaehle).replace(OBJEKT, zaehle);
  // Verweise auf mitgelieferte Dateien (PDF, Aufnahme …) haben keine Web-Adresse: nur der Name bleibt.
  // Besteht die Zeile nur aus solchen Verweisen, fällt sie ganz weg.
  const istAnhang = (ziel: string) => !HAT_SCHEMA.test(ziel.trim()) && !ziel.trim().startsWith('#');
  const ohneVerweise = text.replace(LINK, (ganz, _name: string, ziel: string) => (istAnhang(ziel) ? '' : ganz));
  text = text.replace(LINK, (ganz, name: string, ziel: string) => {
    if (!istAnhang(ziel)) return ganz;
    anzahl++;
    return name;
  });
  if (anzahl > 0 && ohneVerweise.trim() === '') text = '';
  return { text: anzahl > 0 ? text.replace(/ {2,}/g, ' ').trimEnd() : text, anzahl };
}

/** Macht aus der Markdown-Schreibweise von Apple die „Markdown light“-Schreibweise der App. */
function saeubereInhalt(text: string): string {
  return (
    text
      // Unterstrichen und erzwungene Umbrüche kennt die App nicht
      .replace(/<\/?u>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      // __fett__ → **fett**, _kursiv_ → *kursiv* (nur an Wortgrenzen, damit „datei_name“ unberührt bleibt)
      .replace(/(?<![\p{L}\p{N}_\\])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}_])/gu, '**$1**')
      .replace(/(?<![\p{L}\p{N}_*\\])_(?=\S)([^_\n]+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, '*$1*')
      // Maskierte Zeichen („\#“, „\.“, „\-“ …) wieder als normale Zeichen
      .replace(/\\([\\`*_{}[\]()#+\-.!>~|<])/g, '$1')
      .trim()
  );
}

/** Ein Name für eine Liste aus einer Überschrift oder einem Titel: ohne Auszeichnungszeichen, höchstens 100 Zeichen. */
export function listenName(text: string): string {
  const klar = saeubereInhalt(text.replace(LINK, '$1'))
    .replace(/\*\*|__|`/g, '')
    .replace(/(?<![\p{L}\p{N}])[*_](?=\S)|(?<=\S)[*_](?![\p{L}\p{N}])/gu, '');
  return bereinigeName(klar).slice(0, 100).trim();
}

// ───────────────────────── Titel abtrennen ─────────────────────────

const UEBERSCHRIFT = /^(#{1,6})[ \t]+(\S.*?)(?:[ \t]+#+)?$/;

/**
 * Bestimmt den Titel der Apple-Notiz und entfernt ihn aus dem Text, damit er nicht zusätzlich
 * als Notiz übernommen wird.
 *  - `bekannt`: Titel aus dem Kopf der Kurzbefehl-Datei oder aus dem Einfügefeld (kann fehlen)
 *  - `ersatz`: Dateiname ohne Endung
 * In Apple Notizen ist der Titel die erste Zeile. Steht sie noch im Text, fällt sie weg.
 */
export function trenneTitel(rumpf: string, bekannt: string | null, ersatz: string): { titel: string; rumpf: string } {
  const zeilen = rumpf.split('\n');
  let i = 0;
  while (i < zeilen.length && zeilen[i].trim() === '') i++;
  const erste = (zeilen[i] ?? '').trim();
  const h1 = /^#[ \t]+(\S.*?)(?:[ \t]+#+)?$/.exec(erste);
  const kandidat = listenName(h1 ? h1[1] : entferneAnhaenge(erste).text);
  const name = bereinigeName(bekannt ?? '') || bereinigeName(ersatz) || 'Ohne Titel';

  const a = vergleichsName(kandidat);
  const b = vergleichsName(name);
  // Dateinamen kürzt Apple nach etwa 75 Zeichen: Dann ist der eine der Anfang des anderen.
  const passt = a.length > 0 && (a === b || (Math.min(a.length, b.length) >= 20 && (a.startsWith(b) || b.startsWith(a))));
  const ohneErste = zeilen.slice(i + 1).join('\n');

  // Eine Überschrift erster Ordnung ganz oben ist der Titel – sie ist genauer als der Dateiname.
  if (h1 && kandidat && (!bekannt || passt)) return { titel: bekannt ? name : kandidat, rumpf: ohneErste };
  if (passt) return { titel: name, rumpf: ohneErste };
  return { titel: name, rumpf };
}

// ───────────────────────── Zeilen einordnen ─────────────────────────

type Zeile =
  | { art: 'leer' }
  | { art: 'ueberschrift'; stufe: number; text: string }
  | { art: 'aufgabe'; einzug: number; text: string; zustand: 'offen' | 'erledigt'; nurOhneEinzug: boolean }
  | { art: 'punkt'; einzug: number; text: string; nummer: string | null }
  | { art: 'tabelle'; text: string }
  | { art: 'code'; text: string }
  | { art: 'text'; text: string };

function ordneEin(rumpf: string): { zeilen: Zeile[]; anhaenge: number } {
  const zeilen: Zeile[] = [];
  let anhaenge = 0;
  let imCode = false;

  for (const roh of rumpf.split('\n')) {
    const getrimmt = roh.trim();

    // Code-Block zwischen ``` … ```: bleibt unverändert und zusammen, Leerzeilen darin entfallen.
    if (/^(```|~~~)/.test(getrimmt)) {
      imCode = !imCode;
      zeilen.push({ art: 'code', text: getrimmt });
      continue;
    }
    if (imCode) {
      if (getrimmt) zeilen.push({ art: 'code', text: roh.trimEnd() });
      continue;
    }

    const ohneAnhang = entferneAnhaenge(roh);
    anhaenge += ohneAnhang.anzahl;
    // Maskierte eckige Klammern („- \[ \] Milch“) schon jetzt auflösen, damit Checklisten erkannt werden.
    const zeile = ohneAnhang.text.replace(/\\([[\]])/g, '$1');
    const inhalt = zeile.trim();
    const einzug = zeile.length - zeile.trimStart().length;

    // Leerzeile oder Trennlinie (---, ***, ___)
    if (!inhalt || /^([-*_])(?:[ \t]*\1){2,}$/.test(inhalt)) {
      zeilen.push({ art: 'leer' });
      continue;
    }

    const kopf = einzug <= 3 ? UEBERSCHRIFT.exec(inhalt) : null;
    if (kopf) {
      const text = listenName(kopf[2]);
      if (text) zeilen.push({ art: 'ueberschrift', stufe: kopf[1].length, text });
      continue;
    }

    if (inhalt.startsWith('|') && inhalt.indexOf('|', 1) > 0) {
      zeilen.push({ art: 'tabelle', text: saeubereInhalt(inhalt) });
      continue;
    }

    const aufgabe = leseAufgabe(inhalt);
    if (aufgabe) {
      const text = saeubereInhalt(aufgabe.text);
      if (text) {
        zeilen.push({ art: 'aufgabe', einzug, text, zustand: aufgabe.zustand, nurOhneEinzug: !!aufgabe.marker.nurOhneEinzug });
      }
      continue;
    }

    const punkt = lesePunkt(inhalt);
    if (punkt) {
      const text = saeubereInhalt(punkt.text);
      if (text) zeilen.push({ art: 'punkt', einzug, text, nummer: punkt.nummer });
      continue;
    }

    const text = saeubereInhalt(inhalt);
    zeilen.push(text ? { art: 'text', text } : { art: 'leer' });
  }
  return { zeilen, anhaenge };
}

/**
 * Die Automatik (PHASE-4.md, Abschnitt 4): In Apple Notizen drückt man oft nur einmal Enter.
 * Betrachtet werden nur gewöhnliche Textzeilen (keine Aufzählungen, Überschriften, Tabellen).
 * Steht mehr als die Hälfte von ihnen direkt – ohne Leerzeile – bei einer anderen Textzeile,
 * gilt „jede Zeile eine Notiz“. Sonst gilt die Regel der App (Leerzeile trennt).
 */
export function waehleModus(zeilen: { art: string }[]): 'leerzeilen' | 'zeilen' {
  let textzeilen = 0;
  let inBloecken = 0;
  let lauf = 0;
  const schliesse = () => {
    if (lauf >= 2) inBloecken += lauf;
    lauf = 0;
  };
  for (const zeile of zeilen) {
    if (zeile.art === 'text') {
      textzeilen++;
      lauf++;
    } else schliesse();
  }
  schliesse();
  return textzeilen > 0 && inBloecken / textzeilen > 0.5 ? 'zeilen' : 'leerzeilen';
}

// ───────────────────────── Zerlegen ─────────────────────────

export function zerlege(rumpf: string, optionen: ZerlegeOptionen = STANDARD_ZERLEGUNG): Zerlegung {
  const { zeilen, anhaenge } = ordneEin(rumpf);
  const modus = optionen.trennmodus === 'automatisch' ? waehleModus(zeilen) : optionen.trennmodus;

  const abschnitte: Abschnitt[] = [{ pfad: [], notizen: [] }];
  let aktuell = abschnitte[0];
  /** Offene Überschriften von außen nach innen */
  const stapel: { stufe: number; name: string }[] = [];

  /** Die Zeilen der Notiz, die gerade entsteht */
  let puffer: string[] = [];
  /** 'punktnotiz' = ein einzelner Aufzählungspunkt oder eine Aufgabe, an die Unterpunkte angehängt werden */
  let pufferArt: 'text' | 'liste' | 'punktnotiz' | 'tabelle' | 'code' | null = null;
  let pufferAufgabe: RohNotiz['aufgabe'] = null;
  /** Einrückungen des offenen Listenpunkts und seiner Unterpunkte (zum Bestimmen der Stufe) */
  let einzuege: number[] = [];

  const schliesse = () => {
    const text = puffer.join('\n').trim();
    if (text) aktuell.notizen.push({ text, aufgabe: pufferAufgabe });
    puffer = [];
    pufferArt = null;
    pufferAufgabe = null;
    einzuege = [];
  };

  /** Wie tief liegt ein Punkt mit dieser Einrückung unter den bisher gesehenen? 0 = oberste Ebene. */
  const stufeVon = (einzug: number): number => {
    while (einzuege.length > 0 && einzuege[einzuege.length - 1] >= einzug) einzuege.pop();
    einzuege.push(einzug);
    return einzuege.length - 1;
  };

  const punktZeile = (stufe: number, nummer: string | null, text: string) =>
    `${'  '.repeat(stufe)}${nummer ? `${nummer} ` : '- '}${text}`;

  for (const z of zeilen) {
    if (z.art === 'leer') {
      schliesse();
      continue;
    }

    if (z.art === 'ueberschrift') {
      schliesse();
      if (!optionen.ueberschriftenAlsListen) {
        aktuell.notizen.push({ text: z.text.includes('*') ? z.text : `**${z.text}**`, aufgabe: null });
        continue;
      }
      while (stapel.length > 0 && stapel[stapel.length - 1].stufe >= z.stufe) stapel.pop();
      stapel.push({ stufe: z.stufe, name: z.text });
      const pfad = stapel.map((s) => s.name);
      const schluessel = pfad.map(vergleichsName).join('\n');
      // Gleichnamige Überschriften an derselben Stelle füllen dieselbe Unterliste.
      let abschnitt = abschnitte.find((a) => a.pfad.map(vergleichsName).join('\n') === schluessel);
      if (!abschnitt) {
        abschnitt = { pfad, notizen: [] };
        abschnitte.push(abschnitt);
      }
      aktuell = abschnitt;
      continue;
    }

    if (z.art === 'tabelle' || z.art === 'code') {
      if (pufferArt !== z.art) schliesse();
      pufferArt = z.art;
      puffer.push(z.text);
      continue;
    }

    if (z.art === 'text') {
      // Im Leerzeilen-Modus gehört die Zeile zum laufenden Absatz, sonst beginnt eine neue Notiz.
      const anhaengen = modus === 'leerzeilen' && (pufferArt === 'text' || pufferArt === 'liste');
      if (!anhaengen) schliesse();
      pufferArt = 'text';
      einzuege = [];
      puffer.push(z.text);
      continue;
    }

    // Ab hier: Aufzählungspunkt oder Checklisten-Eintrag.
    // Ein Kreis-Zeichen eingerückt unter einem Punkt ist ein Unterpunkt, keine Aufgabe (siehe marker.ts).
    const unterPunkt =
      (pufferArt === 'punktnotiz' || pufferArt === 'liste') && einzuege.length > 0 && z.einzug > einzuege[0];
    const alsAufgabe = z.art === 'aufgabe' && !(z.nurOhneEinzug && unterPunkt);
    const nummer = z.art === 'punkt' ? z.nummer : null;

    if (alsAufgabe) {
      // Jeder Checklisten-Eintrag ist eine eigene Aufgabe, auch ein eingerückter.
      schliesse();
      puffer = [z.text];
      pufferArt = 'punktnotiz';
      pufferAufgabe = z.zustand;
      einzuege = [z.einzug];
      continue;
    }

    if (pufferArt === 'punktnotiz') {
      const stufe = stufeVon(z.einzug);
      if (stufe >= 1) {
        puffer.push(punktZeile(stufe - 1, nummer, z.text));
        continue;
      }
      schliesse();
    }

    if (optionen.punkteEinzeln) {
      schliesse();
      puffer = [z.text];
      pufferArt = 'punktnotiz';
      einzuege = [z.einzug];
      continue;
    }

    // Aufzählungen bleiben zusammen: als eine Notiz (Zeilen-Modus) oder als Teil des Absatzes.
    const anhaengen = pufferArt === 'liste' || (modus === 'leerzeilen' && pufferArt === 'text');
    if (!anhaengen) schliesse();
    pufferArt = 'liste';
    puffer.push(punktZeile(stufeVon(z.einzug), nummer, z.text));
  }
  schliesse();

  return { abschnitte, anhaenge, modus };
}
