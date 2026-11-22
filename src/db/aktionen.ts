/**
 * Alle Änderungen an den Daten laufen über diese Datei. Die Oberfläche ruft
 * hier Funktionen auf („Notiz schreiben“, „Liste löschen“ …); die eigentlichen
 * Regeln stehen in src/logik/.
 */
import {
  bearbeiteNotiz,
  erzeugeNotizen,
  fuehreZusammen,
  positionenZwischen,
  type Bearbeitung,
  type Umgebung,
} from '../logik/absatz';
import { kinderVon, mitNachfahren, naechstePosition } from '../logik/listen';
import { ausDateien, zuDateien } from '../logik/markdown';
import * as papierkorb from '../logik/papierkorb';
import { leseTags } from '../logik/tags';
import { waehleTagesgedanke } from '../logik/tagesgedanke';
import { tagZuDatum, tagebuchtagId } from '../logik/tagebuch';
import { ersterTermin, hakeAb } from '../logik/wiederholung';
import { jetztStempel, lokalJetzt, lokalesDatum } from '../logik/zeit';
import { entpacke, packe } from '../logik/zip';
import {
  EINGANG_ID,
  STANDARD_EINSTELLUNGEN,
  TAGEBUCH_ID,
  eingangsListe,
  istSystemliste,
  neueAufgabe,
  type Bewertung,
  type Faelligkeit,
  type Gewohnheit,
  type Liste,
  type Notiz,
  type Prioritaet,
  type Stand,
  type TagesgedankeSchalter,
  type Wiederholung,
} from '../modell/typen';
import { neueId } from '../modell/ulid';
import { beispieldaten } from './beispieldaten';
import {
  alsBestand,
  entferneEndgueltig,
  ersetzeAlles,
  leseZustand,
  sichereEinstellungen,
  sichereGewohnheiten,
  sichereImpulse,
  sichereListen,
  sichereNotizen,
  sichereTagebuchtag,
  sichereVerlauf,
} from './speicher';

function umgebung(): Umgebung {
  return { jetzt: jetztStempel(), neueId: () => neueId() };
}

// ───────────────────────── Notizen ─────────────────────────

/**
 * Aktive Notizen einer Liste in ihrer Reihenfolge. Im Tagebuch bildet jeder Tag eine eigene Reihe:
 * Mit `tag` kommen nur die Notizen dieses Tages.
 */
export function notizenVon(liste_id: string, tag?: string): Notiz[] {
  const reihe: Notiz[] = [];
  for (const n of leseZustand().notizen.values()) {
    if (n.liste_id === liste_id && !n.geloescht && (tag === undefined || n.tagebuch_tag === tag)) reihe.push(n);
  }
  return reihe.sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
}

/** Die Reihe, in der eine Notiz steht: ihre Liste, im Tagebuch nur ihr Tag. */
function reiheVon(notiz: Notiz): Notiz[] {
  return notizenVon(notiz.liste_id, notiz.tagebuch_tag);
}

/** Sind zwei Positionen (fast) gleich geworden, wird die Reihe einmal sauber durchnummeriert. */
function pruefePositionen(liste_id: string, tag?: string): void {
  const reihe = notizenVon(liste_id, tag);
  const zuEng = reihe.some((n, i) => i > 0 && n.position - reihe[i - 1].position < 1e-7);
  const jetzt = jetztStempel();
  if (zuEng) sichereNotizen(reihe.map((n, i) => ({ ...n, position: i + 1, geaendert: jetzt })));
}

/**
 * Übernimmt den getippten Text einer Notiz. Enthält er eine Trennung (≥ 2× Enter),
 * entstehen darunter neue Notizen. Ist der Text leer, passiert nichts
 * (`notiz` im Ergebnis ist dann null) – das Löschen entscheidet die Oberfläche.
 */
export function schreibeNotiz(id: string, roh: string): Bearbeitung | null {
  const notiz = leseZustand().notizen.get(id);
  if (!notiz) return null;
  const reihe = reiheVon(notiz);
  const nach = reihe[reihe.findIndex((n) => n.id === id) + 1]?.position ?? null;

  const ergebnis = bearbeiteNotiz(notiz, roh, nach, umgebung());
  const geaendert = [...ergebnis.abgetrennt];
  if (ergebnis.notiz && ergebnis.notiz !== notiz) geaendert.unshift(ergebnis.notiz);
  sichereNotizen(geaendert);
  if (ergebnis.abgetrennt.length > 0) pruefePositionen(notiz.liste_id, notiz.tagebuch_tag);
  return ergebnis;
}

/**
 * Legt aus getipptem Text neue Notizen an (jeder Absatz eine).
 *  - `nachId`: direkt unter dieser Notiz einfügen; ohne Angabe ans Ende der Liste.
 *  - `ersteId`: ID für die erste neue Notiz (der Schreibbereich reserviert sie vorab).
 *  - `tag`: im Tagebuch der Tag, zu dem die Notizen gehören.
 */
export function erstelleNotizen(
  liste_id: string,
  roh: string,
  optionen: { nachId?: string | null; ersteId?: string; alsAufgabe?: boolean; tag?: string } = {},
): Notiz[] {
  const tag = liste_id === TAGEBUCH_ID ? optionen.tag : undefined;
  const reihe = notizenVon(liste_id, tag);
  const index = optionen.nachId ? reihe.findIndex((n) => n.id === optionen.nachId) : -1;
  const vor = index >= 0 ? reihe[index].position : (reihe[reihe.length - 1]?.position ?? null);
  const nach = index >= 0 ? (reihe[index + 1]?.position ?? null) : null;

  const basis = umgebung();
  let reserviert = optionen.ersteId;
  const umg: Umgebung = {
    jetzt: basis.jetzt,
    neueId: () => {
      const id = reserviert ?? basis.neueId();
      reserviert = undefined;
      return id;
    },
  };

  let neue = erzeugeNotizen(roh, liste_id, vor, nach, umg);
  if (optionen.alsAufgabe) neue = neue.map((n) => (n.aufgabe ? n : { ...n, aufgabe: neueAufgabe() }));
  if (tag) neue = neue.map((n) => ({ ...n, tagebuch_tag: tag }));
  sichereNotizen(neue);
  if (neue.length > 0) pruefePositionen(liste_id, tag);
  return neue;
}

/**
 * Verschiebt eine Notiz in den Papierkorb. `text` setzt vorher den Text zurück
 * (wenn jemand eine Notiz leer getippt hat, landet der Text von vor dem Leeren im Papierkorb).
 */
export function loescheNotiz(id: string, text?: string): void {
  const notiz = leseZustand().notizen.get(id);
  if (!notiz || notiz.geloescht) return;
  const jetzt = jetztStempel();
  const inhalt = text ?? notiz.text;
  sichereNotizen([{ ...notiz, text: inhalt, tags: leseTags(inhalt), geloescht: jetzt, geaendert: jetzt }]);
}

/** Führt eine Notiz mit der darüber zusammen. Gibt die obere zurück (oder null, wenn es keine gibt). */
export function fuehreMitObererZusammen(untereId: string): { obere: Notiz; nahtstelle: number } | null {
  const untere = leseZustand().notizen.get(untereId);
  if (!untere) return null;
  const reihe = reiheVon(untere);
  const obere = reihe[reihe.findIndex((n) => n.id === untereId) - 1];
  if (!obere) return null;
  const ergebnis = fuehreZusammen(obere, untere, umgebung());
  sichereNotizen([ergebnis.obere, ergebnis.untere]);
  return { obere: ergebnis.obere, nahtstelle: obere.text.length };
}

function aendereNotiz(id: string, aendern: (n: Notiz, jetzt: string) => Notiz | null): void {
  const notiz = leseZustand().notizen.get(id);
  if (!notiz) return;
  const jetzt = jetztStempel();
  const neu = aendern(notiz, jetzt);
  if (neu) sichereNotizen([{ ...neu, geaendert: jetzt }]);
}

/** Macht eine Notiz zur Aufgabe oder wieder zur normalen Notiz. */
export function setzeAufgabe(id: string, istAufgabe: boolean): void {
  aendereNotiz(id, (n) => {
    if (istAufgabe === !!n.aufgabe) return null;
    return { ...n, aufgabe: istAufgabe ? neueAufgabe() : null };
  });
}

export interface Abgehakt {
  /** Die Notiz, wie sie vor dem Abhaken war – für „Rückgängig“ */
  vorher: Notiz;
  /** Neue Fälligkeit einer wiederkehrenden Aufgabe; null = die Aufgabe ist jetzt erledigt */
  naechste: Faelligkeit | null;
}

/**
 * Hakt eine Aufgabe ab. Eine wiederkehrende Aufgabe bleibt offen und springt auf ihre
 * nächste Fälligkeit (Regeln in src/logik/wiederholung.ts).
 */
export function hakeAufgabeAb(id: string): Abgehakt | null {
  const vorher = leseZustand().notizen.get(id);
  if (!vorher?.aufgabe || vorher.aufgabe.erledigt) return null;
  const jetzt = jetztStempel();
  const ergebnis = hakeAb(vorher.aufgabe, lokalJetzt(), jetzt);
  sichereNotizen([{ ...vorher, aufgabe: ergebnis.aufgabe, geaendert: jetzt }]);
  return { vorher, naechste: ergebnis.naechste };
}

/** „Rückgängig“ nach dem Abhaken: stellt die Aufgabe so wieder her, wie sie vorher war. */
export function nimmAbhakenZurueck(vorher: Notiz): void {
  aendereNotiz(vorher.id, (n) => ({ ...n, aufgabe: vorher.aufgabe }));
}

export function setzeErledigt(id: string, erledigt: boolean): void {
  if (erledigt) {
    hakeAufgabeAb(id);
    return;
  }
  aendereNotiz(id, (n) => (n.aufgabe ? { ...n, aufgabe: { ...n.aufgabe, erledigt: false, erledigt_am: null } } : null));
}

/** Setzt Datum und optional Uhrzeit. Ohne Fälligkeit gibt es auch keine Wiederholung. */
export function setzeFaellig(id: string, faellig: Faelligkeit | null): void {
  aendereNotiz(id, (n) =>
    n.aufgabe
      ? { ...n, aufgabe: { ...n.aufgabe, faellig, wiederholung: faellig ? n.aufgabe.wiederholung : null } }
      : null,
  );
}

/**
 * Setzt oder entfernt die Wiederholung. Hat die Aufgabe noch kein Datum, bekommt sie
 * den ersten Termin der Regel (ab heute).
 */
export function setzeWiederholung(id: string, wiederholung: Wiederholung | null): void {
  aendereNotiz(id, (n) => {
    if (!n.aufgabe) return null;
    const faellig = n.aufgabe.faellig ?? (wiederholung ? ersterTermin(wiederholung, lokalesDatum()) : null);
    return { ...n, aufgabe: { ...n.aufgabe, wiederholung, faellig } };
  });
}

/** Erinnerung so viele Minuten vor der Fälligkeit (0 = zur Uhrzeit). */
export function setzeErinnerung(id: string, minuten: number): void {
  aendereNotiz(id, (n) => (n.aufgabe ? { ...n, aufgabe: { ...n.aufgabe, erinnerung: Math.max(0, minuten) } } : null));
}

export function setzePrioritaet(id: string, prioritaet: Prioritaet | null): void {
  aendereNotiz(id, (n) => (n.aufgabe ? { ...n, aufgabe: { ...n.aufgabe, prioritaet } } : null));
}

export function setzeStand(id: string, stand: Stand): void {
  aendereNotiz(id, (n) => (n.aufgabe ? { ...n, aufgabe: { ...n.aufgabe, stand } } : null));
}

/** Verschiebt eine Notiz ans Ende einer anderen Liste. */
export function verschiebeNotiz(id: string, liste_id: string): void {
  // Ins Tagebuch verschiebt man nicht: Dort gehört jede Notiz zu einem Tag.
  if (liste_id === TAGEBUCH_ID) return;
  aendereNotiz(id, (n) => {
    if (n.liste_id === liste_id) return null;
    const ziel = notizenVon(liste_id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tagebuch_tag, ...ohneTag } = n;
    return { ...ohneTag, liste_id, position: (ziel[ziel.length - 1]?.position ?? 0) + 1 };
  });
}

/** Sortiert eine Notiz um. `reihenfolge` sind die IDs der Liste in der neuen Reihenfolge. */
export function ordneNotiz(id: string, reihenfolge: string[]): void {
  const notizen = leseZustand().notizen;
  const index = reihenfolge.indexOf(id);
  const notiz = notizen.get(id);
  if (index < 0 || !notiz) return;
  const vor = notizen.get(reihenfolge[index - 1])?.position ?? null;
  const nach = notizen.get(reihenfolge[index + 1])?.position ?? null;
  const [position] = positionenZwischen(vor, nach, 1);
  aendereNotiz(id, (n) => ({ ...n, position }));
  pruefePositionen(notiz.liste_id, notiz.tagebuch_tag);
}

// ───────────────────────── Listen ─────────────────────────

export function erstelleListe(name: string, eltern_id: string | null): Liste | null {
  const sauber = name.trim();
  if (!sauber) return null;
  const jetzt = jetztStempel();
  const liste: Liste = {
    id: neueId(),
    name: sauber,
    eltern_id,
    angeheftet: false,
    tagesgedanke: 'erben',
    position: naechstePosition(kinderVon(eltern_id, leseZustand().listen)),
    erstellt: jetzt,
    geaendert: jetzt,
    geloescht: null,
  };
  sichereListen([liste]);
  return liste;
}

function aendereListe(id: string, teil: Partial<Liste>): void {
  const liste = leseZustand().listen.get(id);
  if (liste) sichereListen([{ ...liste, ...teil, geaendert: jetztStempel() }]);
}

export function benenneListeUm(id: string, name: string): void {
  if (!istSystemliste(id) && name.trim()) aendereListe(id, { name: name.trim() });
}

export function setzeAngeheftet(id: string, angeheftet: boolean): void {
  aendereListe(id, { angeheftet });
}

export function setzeTagesgedanke(id: string, tagesgedanke: TagesgedankeSchalter): void {
  aendereListe(id, { tagesgedanke });
}

/** Wohin darf eine Liste verschoben werden? Nicht in sich selbst oder ihre eigenen Unterlisten. */
export function darfVerschieben(id: string, eltern_id: string | null): boolean {
  if (istSystemliste(id) || eltern_id === TAGEBUCH_ID) return false;
  return eltern_id === null || !mitNachfahren(id, leseZustand().listen).has(eltern_id);
}

export function verschiebeListe(id: string, eltern_id: string | null): void {
  const listen = leseZustand().listen;
  if (!darfVerschieben(id, eltern_id) || listen.get(id)?.eltern_id === eltern_id) return;
  aendereListe(id, { eltern_id, position: naechstePosition(kinderVon(eltern_id, listen)) });
}

export function loescheListe(id: string): void {
  if (istSystemliste(id)) return;
  const z = leseZustand();
  const aenderung = papierkorb.loescheListe(id, z.listen, z.notizen.values(), jetztStempel());
  sichereListen(aenderung.listen);
  sichereNotizen(aenderung.notizen);
}

// ───────────────────────── Tagebuch ─────────────────────────

/** Ändert Überschrift, Bewertung, Impuls oder Gewohnheiten eines Tages. Gibt es den Tag noch nicht, wird er angelegt. */
export function setzeTagebuchtag(
  datum: string,
  teil: { titel?: string; bewertung?: Bewertung | null; impuls?: string | null; gewohnheiten?: string[] },
): void {
  const jetzt = jetztStempel();
  const alt = tagZuDatum(leseZustand().tagebuchtage.values(), datum);
  const tag = alt ?? {
    id: tagebuchtagId(datum),
    datum,
    titel: '',
    bewertung: null,
    impuls: null,
    gewohnheiten: [],
    erstellt: jetzt,
    geaendert: jetzt,
    geloescht: null,
  };
  const neu = { ...tag, ...teil, geaendert: jetzt };
  const gleich =
    alt &&
    neu.titel === alt.titel &&
    neu.bewertung === alt.bewertung &&
    neu.impuls === alt.impuls &&
    neu.gewohnheiten.join(',') === alt.gewohnheiten.join(',');
  if (gleich) return;
  sichereTagebuchtag(neu);
}

/** Hakt eine Gewohnheit für einen Tag ab oder nimmt das Häkchen zurück. */
export function schalteGewohnheit(datum: string, gewohnheit_id: string): void {
  const tag = tagZuDatum(leseZustand().tagebuchtage.values(), datum);
  const bisher = tag?.gewohnheiten ?? [];
  setzeTagebuchtag(datum, {
    gewohnheiten: bisher.includes(gewohnheit_id) ? bisher.filter((id) => id !== gewohnheit_id) : [...bisher, gewohnheit_id],
  });
}

/** Gewohnheiten in ihrer Reihenfolge (auch inaktive). */
export function gewohnheitenSortiert(): Gewohnheit[] {
  return [...leseZustand().gewohnheiten.values()]
    .filter((g) => !g.geloescht)
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
}

export function erstelleGewohnheit(name: string): void {
  const sauber = name.replace(/\s+/g, ' ').trim();
  if (!sauber) return;
  const jetzt = jetztStempel();
  const reihe = gewohnheitenSortiert();
  sichereGewohnheiten([
    {
      id: neueId(),
      name: sauber,
      position: (reihe[reihe.length - 1]?.position ?? 0) + 1,
      aktiv: true,
      erstellt: jetzt,
      geaendert: jetzt,
      geloescht: null,
    },
  ]);
}

export function aendereGewohnheit(id: string, teil: { name?: string; aktiv?: boolean }): void {
  const g = leseZustand().gewohnheiten.get(id);
  if (!g) return;
  const name = teil.name !== undefined ? teil.name.replace(/\s+/g, ' ').trim() || g.name : g.name;
  sichereGewohnheiten([{ ...g, ...teil, name, geaendert: jetztStempel() }]);
}

/** Verschiebt eine Gewohnheit um eine Stelle nach oben (-1) oder unten (+1). */
export function verschiebeGewohnheit(id: string, richtung: -1 | 1): void {
  const reihe = gewohnheitenSortiert();
  const i = reihe.findIndex((g) => g.id === id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= reihe.length) return;
  [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
  // Neu durchnummerieren; gespeichert wird nur, wessen Platz sich geändert hat.
  const jetzt = jetztStempel();
  const geaendert = reihe
    .map((g, k) => ({ alt: g, neu: { ...g, position: k + 1, geaendert: jetzt } }))
    .filter(({ alt, neu }) => alt.position !== neu.position)
    .map(({ neu }) => neu);
  sichereGewohnheiten(geaendert);
}

/** Eigene Schreibimpulse speichern (eine Frage pro Eintrag). */
export function setzeImpulse(fragen: string[]): void {
  sichereImpulse({ fragen, geaendert: jetztStempel() });
}

// ───────────────────────── Papierkorb ─────────────────────────

export function stelleListeWiederHer(id: string): void {
  const z = leseZustand();
  const aenderung = papierkorb.stelleListeWiederHer(id, z.listen, z.notizen.values(), jetztStempel());
  sichereListen(aenderung.listen);
  sichereNotizen(aenderung.notizen);
}

export function stelleNotizWiederHer(id: string): void {
  const z = leseZustand();
  const notiz = z.notizen.get(id);
  if (!notiz?.geloescht) return;
  const wieder = papierkorb.stelleNotizWiederHer(notiz, z.listen, jetztStempel());
  const ziel = reiheVon(wieder);
  // Ist ihre alte Stelle inzwischen belegt oder die Liste eine andere, kommt sie ans Ende.
  const belegt = ziel.some((n) => n.position === wieder.position);
  sichereNotizen([
    wieder.liste_id !== notiz.liste_id || belegt
      ? { ...wieder, position: (ziel[ziel.length - 1]?.position ?? 0) + 1 }
      : wieder,
  ]);
}

export function leerePapierkorb(): void {
  const z = leseZustand();
  entferneEndgueltig(
    [...z.notizen.values()].filter((n) => n.geloescht).map((n) => n.id),
    [...z.listen.values()].filter((l) => l.geloescht).map((l) => l.id),
  );
}

// ───────────────────────── Einstellungen und Gedanke des Tages ─────────────────────────

export function setzeThema(thema: 'dunkel' | 'hell'): void {
  sichereEinstellungen({ ...leseZustand().einstellungen, thema, geaendert: jetztStempel() });
}

/** Der Gedanke für heute. Merkt sich die Wahl, damit sie den ganzen Tag gleich bleibt. */
export function gedankeDesTages(): Notiz | null {
  const z = leseZustand();
  const ergebnis = waehleTagesgedanke(z.notizen.values(), z.listen, z.verlauf, lokalesDatum());
  if (ergebnis.verlauf !== z.verlauf) sichereVerlauf(ergebnis.verlauf);
  return ergebnis.notiz;
}

// ───────────────────────── Export, Import, Beispieldaten ─────────────────────────

/** Alle Daten als ZIP mit Markdown-Dateien. */
export function exportiereZip(): Uint8Array {
  return packe(zuDateien(alsBestand()));
}

/** Ersetzt alle Daten durch den Inhalt eines ZIP-Exports. Gibt die Zahl der Listen und Notizen zurück. */
export async function importiereZip(zip: Uint8Array): Promise<{ listen: number; notizen: number }> {
  const dateien = entpacke(zip);
  if (![...dateien.keys()].some((pfad) => pfad.endsWith('.md'))) {
    throw new Error('In der ZIP-Datei wurden keine Markdown-Dateien gefunden.');
  }
  const bestand = ausDateien(dateien, umgebung());
  await ersetzeAlles(bestand);
  return {
    listen: bestand.listen.filter((l) => !l.geloescht).length,
    notizen: bestand.notizen.filter((n) => !n.geloescht).length,
  };
}

/** Fügt Beispiel-Listen und -Notizen zu den vorhandenen Daten hinzu. */
export function ladeBeispieldaten(): void {
  const z = leseZustand();
  const start = naechstePosition(kinderVon(null, z.listen));
  const eingang = notizenVon(EINGANG_ID);
  const daten = beispieldaten(new Date(), () => neueId(), start, eingang[eingang.length - 1]?.position ?? 0);
  sichereListen(daten.listen);
  sichereNotizen(daten.notizen);
}

/** Löscht wirklich alles (auch den Papierkorb) und beginnt mit einem leeren Eingang. */
export async function loescheAlles(): Promise<void> {
  await ersetzeAlles({
    listen: [eingangsListe()],
    notizen: [],
    einstellungen: { ...STANDARD_EINSTELLUNGEN, thema: leseZustand().einstellungen.thema },
    tagesgedanke_verlauf: [],
  });
}
