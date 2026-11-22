/**
 * Vom Stapel gewählter Dateien zum fertigen Import (PHASE-4.md, Abschnitte 3 bis 6):
 *
 *   Rohdatei ──leseDatei──▶ Quelle ──bildeEintraege──▶ Eintrag ──vorschau──▶ Anzeige
 *                                                         └────baueImport──▶ neue Listen und Notizen
 *
 * Eine „Quelle“ ist eine eingelesene Datei, ein „Eintrag“ ist eine Apple-Notiz. Meist gehört zu
 * einem Eintrag genau eine Quelle; bei der Kombination A + B sind es zwei.
 *
 * Alles hier ist „rein“: keine Datenbank, kein Browser.
 */
import type { ImportEintrag, ImportWeg, Liste, Notiz, Zeitstempel } from '../../modell/typen';
import { TAGEBUCH_ID, neueAufgabe } from '../../modell/typen';
import type { Umgebung } from '../absatz';
import { naechstePosition } from '../listen';
import { leseTags } from '../tags';
import { bereinigeName, bereinigeText, vergleichsName } from './bereinigen';
import { fingerabdruck } from './fingerabdruck';
import { leseKopf } from './kopf';
import { STANDARD_ZERLEGUNG, trenneTitel, zerlege, type ZerlegeOptionen, type Zerlegung } from './zerlegen';

// ───────────────────────── Dateien einlesen ─────────────────────────

export interface Rohdatei {
  /** Dateiname, darf einen Ordnerpfad enthalten („Reise/Reise.md“) */
  name: string;
  inhalt: string;
}

export type Quellart = 'kurzbefehl' | 'markdown' | 'text';

export interface Quelle {
  /** Dateiname ohne Ordner; beim Einfügefeld der Titel */
  name: string;
  /** kurzbefehl = Weg A (Textdatei, mit oder ohne Kopf), markdown = Weg B, text = Weg C (eingefügt) */
  art: Quellart;
  titel: string;
  ordner: string[];
  erstellt: Zeitstempel | null;
  geaendert: Zeitstempel | null;
  /** Text der Notiz ohne Kopf und ohne Titelzeile */
  rumpf: string;
  fingerabdruck: string;
  hinweise: string[];
}

const TEXT_ENDUNG = /\.(md|markdown|txt|text)$/i;

/** Ist das eine Datei, die der Import lesen kann? Bilder und andere Anhänge werden übergangen. */
export function istImportDatei(name: string): boolean {
  const datei = name.split('/').pop() ?? '';
  return TEXT_ENDUNG.test(datei) && !datei.startsWith('.');
}

/** Liest eine Exportdatei. `null`, wenn es keine Text- oder Markdown-Datei ist. */
export function leseDatei(datei: Rohdatei): Quelle | null {
  if (!istImportDatei(datei.name)) return null;
  const name = bereinigeName(datei.name.split('/').pop()!);
  const text = bereinigeText(datei.inhalt);
  const { kopf, rumpf } = leseKopf(text);
  const istMarkdown = /\.(md|markdown)$/i.test(name);
  const art: Quellart = kopf.vorhanden || !istMarkdown ? 'kurzbefehl' : 'markdown';
  const ohneEndung = name.replace(TEXT_ENDUNG, '');
  const getrennt = trenneTitel(rumpf, kopf.titel, ohneEndung);

  const hinweise = [...kopf.hinweise];
  if (art === 'kurzbefehl' && !kopf.vorhanden) hinweise.push('Kopf fehlt – Datum und Ordner unbekannt');

  return {
    name,
    art,
    titel: getrennt.titel,
    ordner: kopf.ordner,
    erstellt: kopf.erstellt ?? kopf.geaendert,
    geaendert: kopf.geaendert ?? kopf.erstellt,
    rumpf: getrennt.rumpf,
    fingerabdruck: fingerabdruck(text.trim()),
    hinweise,
  };
}

/** Weg C: eingefügter Text mit einem Titel. */
export function quelleAusText(titel: string, text: string): Quelle {
  const sauber = bereinigeText(text);
  const name = bereinigeName(titel) || 'Ohne Titel';
  const getrennt = trenneTitel(sauber, name, name);
  return {
    name,
    art: 'text',
    titel: getrennt.titel,
    ordner: [],
    erstellt: null,
    geaendert: null,
    rumpf: getrennt.rumpf,
    fingerabdruck: fingerabdruck(sauber.trim()),
    hinweise: [],
  };
}

// ───────────────────────── Einträge bilden (Kombination A + B) ─────────────────────────

export interface Eintrag {
  /** Eindeutig innerhalb eines Stapels; bleibt gleich, solange dieselben Dateien dazugehören */
  schluessel: string;
  titel: string;
  ordner: string[];
  erstellt: Zeitstempel | null;
  geaendert: Zeitstempel | null;
  rumpf: string;
  quellen: Quelle[];
  weg: Exclude<ImportWeg, 'gemischt'>;
  /** Gibt es zu diesem Titel beide Formen (Markdown und Kurzbefehl)? Dann lässt sich umschalten. */
  kombinierbar: boolean;
  hinweise: string[];
}

function einzelEintrag(quelle: Quelle, kombinierbar: boolean): Eintrag {
  return {
    schluessel: quelle.fingerabdruck,
    titel: quelle.titel,
    ordner: quelle.ordner,
    erstellt: quelle.erstellt,
    geaendert: quelle.geaendert,
    rumpf: quelle.rumpf,
    quellen: [quelle],
    weg: quelle.art,
    kombinierbar,
    hinweise: quelle.hinweise,
  };
}

/**
 * Macht aus den eingelesenen Dateien die Einträge der Vorschau.
 *  - Dieselbe Datei zweimal im Stapel zählt nur einmal.
 *  - Liegt eine Notiz als Markdown UND als Kurzbefehl-Datei vor (gleicher Titel), entsteht ein
 *    kombinierter Eintrag: Inhalt aus Markdown, Datum und Ordner aus der Kurzbefehl-Datei.
 *    `getrennt` enthält die Titel (in Vergleichsform), bei denen das abgelehnt wurde.
 */
export function bildeEintraege(quellen: Quelle[], getrennt: ReadonlySet<string> = new Set()): Eintrag[] {
  const gesehen = new Set<string>();
  const einmalig = quellen.filter((q) => !gesehen.has(q.fingerabdruck) && gesehen.add(q.fingerabdruck));

  const jeTitel = new Map<string, Quelle[]>();
  for (const q of einmalig) {
    const titel = vergleichsName(q.titel);
    jeTitel.set(titel, [...(jeTitel.get(titel) ?? []), q]);
  }

  const eintraege: Eintrag[] = [];
  const erledigt = new Set<Quelle>();
  for (const q of einmalig) {
    if (erledigt.has(q)) continue;
    const gruppe = jeTitel.get(vergleichsName(q.titel))!;
    const markdown = gruppe.filter((g) => g.art === 'markdown');
    const kurzbefehl = gruppe.filter((g) => g.art === 'kurzbefehl');
    // Nur eindeutige Paare: genau eine Datei von jeder Sorte.
    const paar = markdown.length === 1 && kurzbefehl.length === 1 && gruppe.length === 2;

    if (paar && !getrennt.has(vergleichsName(q.titel))) {
      const [md] = markdown;
      const [kb] = kurzbefehl;
      erledigt.add(md).add(kb);
      eintraege.push({
        schluessel: `${md.fingerabdruck}+${kb.fingerabdruck}`,
        titel: md.titel,
        ordner: kb.ordner,
        erstellt: kb.erstellt,
        geaendert: kb.geaendert,
        rumpf: md.rumpf,
        quellen: [md, kb],
        weg: 'kombiniert',
        kombinierbar: true,
        hinweise: [...md.hinweise, ...kb.hinweise],
      });
    } else {
      erledigt.add(q);
      eintraege.push(einzelEintrag(q, paar));
    }
  }
  return eintraege;
}

// ───────────────────────── Vorschau ─────────────────────────

export interface EintragOptionen extends ZerlegeOptionen {
  /** Liste, unter der der Eintrag landet; null = oberste Ebene der Gedankenwelt */
  ziel: string | null;
  /** Von Hand gesetztes Datum (Ortsdatum „2024-03-12“); null = Datum der Datei bzw. Importdatum */
  datum: string | null;
  ausgeschlossen: boolean;
}

export const STANDARD_OPTIONEN: EintragOptionen = {
  ...STANDARD_ZERLEGUNG,
  ziel: null,
  datum: null,
  ausgeschlossen: false,
};

export interface EintragVorschau {
  zerlegung: Zerlegung;
  /** Listen, die neu entstehen: die Unterliste der Notiz und je Überschrift eine weitere */
  listen: number;
  notizen: number;
  aufgabenOffen: number;
  aufgabenErledigt: number;
  /** Früherer, noch gültiger Import derselben Datei – dann ist „überspringen“ vorgewählt */
  schonImportiert: ImportEintrag | null;
}

/** Der frühere Import, in dem eine der Dateien dieses Eintrags schon steckte (rückgängig gemachte zählen nicht). */
export function findeFrueherenImport(eintrag: Eintrag, importe: ImportEintrag[]): ImportEintrag | null {
  const abdruecke = new Set(eintrag.quellen.map((q) => q.fingerabdruck));
  return importe.find((i) => !i.rueckgaengig && i.fingerabdruecke.some((f) => abdruecke.has(f))) ?? null;
}

export function vorschau(eintrag: Eintrag, optionen: ZerlegeOptionen, importe: ImportEintrag[] = []): EintragVorschau {
  const zerlegung = zerlege(eintrag.rumpf, optionen);
  let notizen = 0;
  let aufgabenOffen = 0;
  let aufgabenErledigt = 0;
  for (const abschnitt of zerlegung.abschnitte) {
    for (const n of abschnitt.notizen) {
      notizen++;
      if (n.aufgabe === 'offen') aufgabenOffen++;
      else if (n.aufgabe === 'erledigt') aufgabenErledigt++;
    }
  }
  return {
    zerlegung,
    listen: zerlegung.abschnitte.length,
    notizen,
    aufgabenOffen,
    aufgabenErledigt,
    schonImportiert: findeFrueherenImport(eintrag, importe),
  };
}

// ───────────────────────── Import bauen ─────────────────────────

export interface ImportAuftrag {
  eintrag: Eintrag;
  optionen: EintragOptionen;
}

export interface ImportErgebnis {
  /** Neu anzulegende Listen (vorhandene, gleichnamige Ordner-Listen werden wiederverwendet und stehen nicht hier) */
  listen: Liste[];
  notizen: Notiz[];
  eintrag: ImportEintrag;
}

function mittag(datum: string): Zeitstempel {
  const [j, m, t] = datum.split('-').map(Number);
  return new Date(j, m - 1, t, 12, 0, 0).toISOString().slice(0, 19) + 'Z';
}

/**
 * Baut aus den Aufträgen die neuen Listen und Notizen (PHASE-4.md, Abschnitt 4):
 *  - Apple-Ordner → Liste (verschachtelt); gibt es an der Stelle schon eine gleichnamige, wird sie benutzt
 *  - Apple-Notiz → neue Unterliste mit dem Titel als Namen
 *  - Überschrift → weitere Unterliste
 *  - Alle Notizen einer Apple-Notiz bekommen deren Erstell- und Änderungsdatum
 * Alles Neue trägt die `import_id`, damit sich der Import rückgängig machen lässt.
 */
export function baueImport(
  auftraege: ImportAuftrag[],
  vorhandeneListen: Iterable<Liste>,
  umg: Umgebung,
  einstellungen: { tagesgedanke: boolean } = { tagesgedanke: true },
): ImportErgebnis {
  const importId = umg.neueId('import');
  const jetzt = umg.jetzt;
  const listen: Liste[] = [];
  const notizen: Notiz[] = [];
  /** Alle aktiven Listen: die vorhandenen und die in diesem Import schon angelegten */
  // Ins Tagebuch wird nie importiert: Ein Apple-Ordner „Tagebuch“ wird eine eigene Liste.
  const alle: Liste[] = [...vorhandeneListen].filter((l) => !l.geloescht && l.id !== TAGEBUCH_ID);

  const neueListe = (name: string, eltern_id: string | null, erstellt: Zeitstempel, tagesgedanke: Liste['tagesgedanke']) => {
    const liste: Liste = {
      id: umg.neueId(`import-liste|${eltern_id}|${name}`),
      name,
      eltern_id,
      angeheftet: false,
      tagesgedanke,
      position: naechstePosition(alle.filter((l) => l.eltern_id === eltern_id)),
      erstellt,
      geaendert: jetzt,
      geloescht: null,
      import_id: importId,
    };
    listen.push(liste);
    alle.push(liste);
    return liste;
  };

  /** Liste für einen Apple-Ordner: vorhandene gleichnamige nehmen, sonst anlegen. */
  const ordnerListe = (name: string, eltern_id: string | null): Liste => {
    const gesucht = vergleichsName(name);
    return (
      alle.find((l) => l.eltern_id === eltern_id && vergleichsName(l.name) === gesucht) ??
      neueListe(name, eltern_id, jetzt, 'erben')
    );
  };

  const benutzt = auftraege.filter((a) => !a.optionen.ausgeschlossen);
  let aufgaben = 0;
  let offen = 0;
  let dateien = 0;
  const fingerabdruecke: string[] = [];
  const wege = new Set<ImportWeg>();

  for (const { eintrag, optionen } of benutzt) {
    const zerlegung = zerlege(eintrag.rumpf, optionen);
    if (zerlegung.abschnitte.every((a) => a.notizen.length === 0)) continue; // leere Notiz: nichts anlegen

    dateien += eintrag.quellen.length;
    fingerabdruecke.push(...eintrag.quellen.map((q) => q.fingerabdruck));
    wege.add(eintrag.weg);

    // Datum: von Hand gesetzt > aus der Datei > Importdatum. Nie in der Zukunft, nie „geändert vor erstellt“.
    const hoechstens = (stempel: Zeitstempel) => (stempel > jetzt ? jetzt : stempel);
    const erstellt = hoechstens(optionen.datum ? mittag(optionen.datum) : (eintrag.erstellt ?? jetzt));
    const geaendertRoh = hoechstens(optionen.datum ? erstellt : (eintrag.geaendert ?? erstellt));
    const geaendert = geaendertRoh < erstellt ? erstellt : geaendertRoh;

    let eltern = optionen.ziel;
    for (const ordner of eintrag.ordner) eltern = ordnerListe(ordner, eltern).id;

    // Die Apple-Notiz selbst wird immer eine neue Unterliste – so bleibt „Rückgängig“ sauber.
    const notizListe = neueListe(eintrag.titel, eltern, erstellt, einstellungen.tagesgedanke ? 'an' : 'erben');

    const listeJePfad = new Map<string, Liste>([['', notizListe]]);
    for (const abschnitt of zerlegung.abschnitte) {
      // Unterlisten für die Überschriften von außen nach innen anlegen
      let liste = notizListe;
      let schluessel = '';
      for (const name of abschnitt.pfad) {
        schluessel += `\n${vergleichsName(name)}`;
        let naechste = listeJePfad.get(schluessel);
        if (!naechste) {
          naechste = neueListe(name, liste.id, erstellt, 'erben');
          listeJePfad.set(schluessel, naechste);
        }
        liste = naechste;
      }

      abschnitt.notizen.forEach((roh, index) => {
        if (roh.aufgabe) {
          aufgaben++;
          if (roh.aufgabe === 'offen') offen++;
        }
        notizen.push({
          id: umg.neueId(`import-notiz|${liste.id}|${index}`),
          text: roh.text,
          liste_id: liste.id,
          position: index + 1,
          tags: leseTags(roh.text),
          erstellt,
          geaendert,
          // Ohne Fälligkeit und ohne Uhrzeit: Importierte Aufgaben erzeugen keine Kalendertermine.
          aufgabe: roh.aufgabe ? neueAufgabe(roh.aufgabe === 'erledigt', geaendert) : null,
          geloescht: null,
          verweise: [],
          import_id: importId,
        });
      });
    }
  }

  const weg: ImportWeg = wege.size === 1 ? [...wege][0] : 'gemischt';
  return {
    listen,
    notizen,
    eintrag: {
      id: importId,
      datum: jetzt,
      weg,
      dateien,
      listen: listen.length,
      notizen: notizen.length,
      aufgaben,
      offen,
      fingerabdruecke,
      rueckgaengig: null,
    },
  };
}

// ───────────────────────── Rückgängig ─────────────────────────

export interface RueckgaengigPlan {
  /** Geänderte Listen und Notizen (in den Papierkorb gelegt) */
  listen: Liste[];
  notizen: Notiz[];
  /** Wie viele davon seit dem Import bearbeitet wurden (dann fragt die App einmal nach) */
  bearbeitet: number;
  /** Importierte Listen, die bleiben, weil inzwischen eigene Notizen oder Listen darin liegen */
  behalten: number;
}

/**
 * „Rückgängig“ für einen Import: Alles, was die `import_id` trägt, wandert in den Papierkorb
 * (dort 30 Tage wiederherstellbar). Listen, in denen inzwischen etwas Eigenes liegt, bleiben stehen –
 * sonst verschwände dieses Eigene mit.
 */
export function planeRueckgaengig(
  importeintrag: Pick<ImportEintrag, 'id' | 'datum'>,
  alleListen: Iterable<Liste>,
  alleNotizen: Iterable<Notiz>,
  jetzt: Zeitstempel,
): RueckgaengigPlan {
  const id = importeintrag.id;
  const listenReihe = [...alleListen];
  const notizenReihe = [...alleNotizen];
  const eigeneListen = listenReihe.filter((l) => l.import_id === id && !l.geloescht);
  const eigeneNotizen = notizenReihe.filter((n) => n.import_id === id && !n.geloescht);

  // Listen, die nicht gelöscht werden dürfen: Sie enthalten etwas, das nicht aus diesem Import stammt.
  const behalten = new Set<string>();
  for (const n of notizenReihe) if (!n.geloescht && n.import_id !== id) behalten.add(n.liste_id);
  for (const l of listenReihe) if (!l.geloescht && l.import_id !== id && l.eltern_id) behalten.add(l.eltern_id);
  // … und alle ihre Elternlisten aus diesem Import
  const karte = new Map(listenReihe.map((l) => [l.id, l]));
  for (const start of [...behalten]) {
    let aktuell = karte.get(start);
    const gesehen = new Set<string>();
    while (aktuell?.eltern_id && !gesehen.has(aktuell.id)) {
      gesehen.add(aktuell.id);
      behalten.add(aktuell.eltern_id);
      aktuell = karte.get(aktuell.eltern_id);
    }
  }

  const zuLoeschen = eigeneListen.filter((l) => !behalten.has(l.id));
  const bearbeitet =
    eigeneNotizen.filter((n) => n.geaendert > importeintrag.datum).length +
    eigeneListen.filter((l) => l.geaendert > importeintrag.datum).length;

  return {
    // Derselbe Zeitpunkt für alles: So kommt beim Wiederherstellen einer Liste ihr Inhalt gemeinsam zurück.
    listen: zuLoeschen.map((l) => ({ ...l, geloescht: jetzt, geaendert: jetzt })),
    notizen: eigeneNotizen.map((n) => ({ ...n, geloescht: jetzt, geaendert: jetzt })),
    bearbeitet,
    behalten: eigeneListen.length - zuLoeschen.length,
  };
}

// ───────────────────────── Zusammenfassung ─────────────────────────

/** „214 Notizen in 18 Listen, 37 Aufgaben, davon 12 offen“ */
export function zusammenfassung(e: Pick<ImportEintrag, 'notizen' | 'listen' | 'aufgaben' | 'offen'>): string {
  const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
  let text = `${mehrzahl(e.notizen, 'Notiz', 'Notizen')} in ${mehrzahl(e.listen, 'Liste', 'Listen')}`;
  if (e.aufgaben > 0) text += `, ${mehrzahl(e.aufgaben, 'Aufgabe', 'Aufgaben')}, davon ${e.offen} offen`;
  return text;
}

export const WEG_NAME: Record<ImportWeg, string> = {
  kurzbefehl: 'Kurzbefehl',
  markdown: 'Markdown',
  text: 'Eingefügter Text',
  kombiniert: 'Markdown + Kurzbefehl',
  gemischt: 'Gemischt',
};
