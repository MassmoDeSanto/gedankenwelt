// Prüft die Kontraste aller Farbpaare aus src/ui/stil.css nach WCAG AA.
// Aufruf: node werkzeuge/kontraste.mjs   (Rückgabewert 1, wenn ein Paar durchfällt)
//
// Grenzen: Text 4,5:1, große Schrift (ab 24px bzw. 18,7px fett) und Bedienelemente 3:1.
// Die Paare stehen unten von Hand, weil nur sie sagen, welche Schrift auf welcher Fläche liegt.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/ui/stil.css', import.meta.url)), 'utf8');

/** Liest die Variablen (nur #rrggbb) aus dem Block, der mit `kopf {` beginnt. */
function leseBlock(kopf) {
  const start = css.indexOf(kopf + ' {');
  if (start < 0) throw new Error(`Block ${kopf} nicht gefunden`);
  const ende = css.indexOf('\n}', start);
  const werte = {};
  for (const [, name, wert] of css.slice(start, ende).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    werte[name] = wert.toLowerCase();
  }
  return werte;
}

const dunkel = leseBlock(':root');
const hell = { ...dunkel, ...leseBlock(":root[data-thema='hell']") };

/** Tagebuch: lenkt die allgemeinen Namen auf die tb-Farben um (wie in stil.css). */
function tagebuch(t) {
  return {
    ...t,
    hintergrund: t['tb-hintergrund'],
    flaeche: t['tb-flaeche'],
    erhoeht: t['tb-flaeche'],
    chip: t['tb-chip'],
    text: t['tb-text'],
    gedaempft: t['tb-gedaempft'],
    meta: t['tb-meta'],
    violett: t['tb-akzent'],
  };
}

function leuchtdichte(hex) {
  const kanal = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5);
}

export function kontrast(a, b) {
  const [h, d] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
}

// [Schrift, Fläche, Grenze, wo]  – Grenze 4.5 = Text, 3 = große Schrift oder Bedienelement
const T = 4.5;
const G = 3;
const allgemein = [
  ['text', 'hintergrund', T, 'Text'],
  ['text', 'flaeche', T, 'Text auf Karte'],
  ['text', 'kachel', T, 'Text auf Kachel'],
  ['text', 'chip', T, 'Text auf Chip'],
  ['gedaempft', 'hintergrund', T, 'gedämpfter Text'],
  ['gedaempft', 'flaeche', T, 'gedämpfter Text auf Karte'],
  ['gedaempft', 'kachel', T, 'gedämpfter Text auf Kachel'],
  ['gedaempft', 'chip', T, 'Filter-/Zähl-Chip'],
  ['meta', 'hintergrund', T, 'Nebeninfo (Datum, Zähler)'],
  ['meta', 'flaeche', T, 'Nebeninfo auf Karte'],
  ['meta', 'kachel', T, 'Nebeninfo auf To-do-Kästchen'],
  ['meta', 'kachel', G, 'Rand des Abhak-Kästchens'],
  ['violett', 'hintergrund', T, 'Akzent Gedankenwelt / Links'],
  ['violett', 'flaeche', T, 'Akzent auf Karte'],
  ['violett', 'hintergrund', G, 'Fokusrahmen'],
  ['violett', 'kachel', G, 'Fokusrahmen auf Kachel'],
  ['tuerkis', 'flaeche', T, 'To-do-Akzent'],
  ['bernstein', 'flaeche', T, 'fällig / Erinnerung'],
  ['blau', 'flaeche', T, 'angeheftet'],
  ['rot', 'flaeche', T, 'Löschen'],
  ['rot', 'hintergrund', T, 'Löschen'],
  ['auf-violett', 'violett', T, 'Schrift auf violettem Knopf'],
  ['hintergrund', 'text', T, 'gewählter Filter-Chip'],
];
// Die Tagebuch-Kachel in der Gedankenwelt hat eigene Farben (tb-text, tb-meta auf tb-flaeche),
// sie ist darum unten bei den Tagebuch-Paaren mit abgedeckt.
const dringlichkeit = [
  ['ueberfaellig-auf', 'ueberfaellig-grund', T, 'Kalenderblatt überfällig'],
  ['heute-auf', 'heute-grund', T, 'Kalenderblatt heute'],
  ['bald-auf', 'bald-grund', T, 'Kalenderblatt bald'],
  ['woche-auf', 'woche-grund', T, 'Kalenderblatt Woche'],
  ['spaeter-auf', 'spaeter-grund', T, 'Kalenderblatt später'],
  ['ueberfaellig-text', 'ueberfaellig-kachel', T, '„seit 2 Tagen“ auf Kästchen'],
  ['heute-text', 'heute-kachel', T, '„heute“ auf Kästchen'],
  ['bald-text', 'bald-kachel', T, '„morgen“ auf Kästchen'],
  ['woche-text', 'woche-kachel', T, '„in 5 Tagen“ auf Kästchen'],
  ['gedaempft', 'kachel', T, '„später“ auf Kästchen'],
  ['text', 'ueberfaellig-kachel', T, 'Aufgabentext überfällig'],
  ['text', 'heute-kachel', T, 'Aufgabentext heute'],
  ['text', 'bald-kachel', T, 'Aufgabentext bald'],
  ['text', 'woche-kachel', T, 'Aufgabentext Woche'],
  ['meta', 'ueberfaellig-kachel', T, 'Nebeninfo überfällig'],
  ['meta', 'heute-kachel', T, 'Nebeninfo heute'],
  ['meta', 'bald-kachel', T, 'Nebeninfo bald'],
  ['meta', 'woche-kachel', T, 'Nebeninfo Woche'],
  ['meta', 'ueberfaellig-kachel', G, 'Abhak-Kreis überfällig'],
  ['meta', 'heute-kachel', G, 'Abhak-Kreis heute'],
  ['ueberfaellig-text', 'ueberfaellig-hauch', T, 'Chip „überfällig“'],
  ['heute-text', 'heute-hauch', T, 'Chip „heute“'],
  ['prio-text', 'prio-hauch', T, 'Flagge Priorität'],
  ['arbeit-text', 'arbeit-hauch', T, 'Schild „in Arbeit“'],
  ['prio-text', 'kachel', T, 'Flagge auf getöntem Kästchen'],
  ['arbeit-text', 'kachel', T, 'Schild auf getöntem Kästchen'],
];
const tagebuchPaare = [
  ['text', 'hintergrund', T, 'Tagebuch Text'],
  ['text', 'flaeche', T, 'Tagebuch Text auf Fläche'],
  ['gedaempft', 'hintergrund', T, 'Tagebuch gedämpft'],
  ['gedaempft', 'flaeche', T, 'Tagebuch gedämpft auf Fläche'],
  ['meta', 'hintergrund', T, 'Tagebuch Nebeninfo'],
  ['meta', 'flaeche', T, 'Tagebuch Nebeninfo auf Fläche'],
  ['violett', 'hintergrund', T, 'Tagebuch Akzent'],
  ['violett', 'hintergrund', G, 'Tagebuch Fokusrahmen'],
];

const gruppen = [
  ['Hell', hell, [...allgemein, ...dringlichkeit]],
  ['Dunkel', dunkel, [...allgemein, ...dringlichkeit]],
  ['Tagebuch hell (Papier)', tagebuch(hell), tagebuchPaare],
  ['Tagebuch dunkel (Kerzenlicht)', tagebuch(dunkel), tagebuchPaare],
];

let durchgefallen = 0;
for (const [name, t, paare] of gruppen) {
  console.log(`\n== ${name} ==`);
  for (const [vorn, hinten, grenze, wo] of paare) {
    const k = kontrast(t[vorn], t[hinten]);
    const ok = k >= grenze;
    if (!ok) durchgefallen++;
    const zeichen = ok ? '  ok ' : 'NEIN ';
    console.log(
      `${zeichen} ${k.toFixed(2).padStart(5)} (≥${grenze})  ${wo.padEnd(32)} --${vorn} ${t[vorn]} auf --${hinten} ${t[hinten]}`,
    );
  }
}
console.log(`\n${durchgefallen} Paar(e) unter der Grenze.`);
process.exitCode = durchgefallen ? 1 : 0;
