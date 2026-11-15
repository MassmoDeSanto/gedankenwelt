/**
 * Absatz-Regel (KONZEPT.md, Abschnitt 3):
 *  - 1× Enter  = Zeilenumbruch innerhalb derselben Notiz
 *  - ≥ 2× Enter = Trennung, danach beginnt eine neue Notiz
 *  - leere Zeilen erzeugen nie leere Notizen
 *
 * Alle Funktionen hier sind „rein“: Sie bekommen Daten und geben neue Daten
 * zurück, ohne Datenbank oder Oberfläche anzufassen. Dadurch sind sie gut testbar.
 */
import { neueAufgabe, type Notiz, type Zeitstempel } from '../modell/typen';
import { leseTags } from './tags';

/** Was eine Funktion von außen braucht: die aktuelle Zeit und einen ID-Erzeuger. */
export interface Umgebung {
  jetzt: Zeitstempel;
  /**
   * Erzeugt eine neue ID. Der Hinweis beschreibt, wofür sie ist. Der Abgleich nutzt ihn,
   * damit dieselbe von Hand geschriebene Stelle in Drive immer dieselbe ID bekommt.
   */
  neueId: (hinweis?: string) => string;
}

/** Eine Trennung: Zeilenumbruch, dann mindestens eine (bis auf Leerzeichen) leere Zeile. */
const TRENNUNG = /\n(?:[ \t]*\n)+/;

/** Zerlegt getippten Text in die Texte der einzelnen Notizen. Nie leere Einträge. */
export function zerlegeText(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(TRENNUNG)
    .map((teil) => teil.trim())
    .filter((teil) => teil.length > 0);
}

/** Enthält der Text irgendwo eine Trennung (zwei oder mehr Enter)? */
export function enthaeltTrennung(text: string): boolean {
  return TRENNUNG.test(text.replace(/\r\n?/g, '\n'));
}

/** Endet der Text mit einer Trennung? Dann will der Nutzer darunter eine neue Notiz beginnen. */
export function endetMitTrennung(text: string): boolean {
  return /\n[ \t]*\n[ \t\n]*$/.test(text.replace(/\r\n?/g, '\n'));
}

export type AufgabenZustand = 'offen' | 'erledigt' | null;

/** „[ ] “ oder „[x] “ am Anfang, gefolgt von weiterem Text. */
const AUFGABEN_PRAEFIX = /^\[([ xX]?)\][ \t]+(?=\S)/;

/**
 * Erkennt ein Aufgaben-Kästchen am Textanfang und entfernt es.
 * „[ ] Milch“ → Text „Milch“, Zustand offen. Ohne Kästchen bleibt der Text unverändert.
 */
export function leseAufgabenPraefix(text: string): { text: string; zustand: AufgabenZustand } {
  const treffer = AUFGABEN_PRAEFIX.exec(text);
  if (!treffer) return { text, zustand: null };
  return {
    text: text.slice(treffer[0].length),
    zustand: treffer[1].toLowerCase() === 'x' ? 'erledigt' : 'offen',
  };
}

/** Schreibt das Kästchen wieder vor den Text (für das Markdown-Format). */
export function mitAufgabenPraefix(notiz: Pick<Notiz, 'text' | 'aufgabe'>): string {
  if (!notiz.aufgabe) return notiz.text;
  return `${notiz.aufgabe.erledigt ? '[x]' : '[ ]'} ${notiz.text}`;
}

/**
 * Positionen für neue Notizen zwischen zwei Nachbarn.
 * `vor`/`nach` = Position der Notiz davor/danach, null = es gibt keine.
 */
export function positionenZwischen(vor: number | null, nach: number | null, anzahl: number): number[] {
  const ergebnis: number[] = [];
  for (let i = 0; i < anzahl; i++) {
    if (vor === null && nach === null) ergebnis.push(i + 1);
    else if (nach === null) ergebnis.push(vor! + i + 1);
    else if (vor === null) ergebnis.push(nach - anzahl + i);
    else ergebnis.push(vor + ((nach - vor) * (i + 1)) / (anzahl + 1));
  }
  return ergebnis;
}

/** Baut eine neue Notiz aus einem einzelnen Absatz. */
function neueNotiz(absatz: string, liste_id: string, position: number, umg: Umgebung): Notiz {
  const { text, zustand } = leseAufgabenPraefix(absatz);
  return {
    id: umg.neueId(),
    text,
    liste_id,
    position,
    tags: leseTags(text),
    erstellt: umg.jetzt,
    geaendert: umg.jetzt,
    aufgabe: zustand ? neueAufgabe(zustand === 'erledigt', umg.jetzt) : null,
    geloescht: null,
    verweise: [],
  };
}

/**
 * Macht aus frei getipptem Text neue Notizen (jeder Absatz eine).
 * Sie werden zwischen den Positionen `vor` und `nach` einsortiert.
 */
export function erzeugeNotizen(
  roh: string,
  liste_id: string,
  vor: number | null,
  nach: number | null,
  umg: Umgebung,
): Notiz[] {
  const teile = zerlegeText(roh);
  const positionen = positionenZwischen(vor, nach, teile.length);
  return teile.map((teil, i) => neueNotiz(teil, liste_id, positionen[i], umg));
}

export interface Bearbeitung {
  /** Die bearbeitete Notiz (gleiche ID, gleiches Erstelldatum). null = Text ist leer geworden. */
  notiz: Notiz | null;
  /** Durch eine Trennung abgeteilte neue Notizen (neue IDs, Erstelldatum = jetzt). */
  abgetrennt: Notiz[];
}

/**
 * Übernimmt den neuen Text einer bestehenden Notiz.
 *  - Der erste Absatz bleibt in der alten Notiz (ID und Erstelldatum bleiben).
 *  - Jeder weitere Absatz wird eine neue Notiz direkt darunter.
 *  - `nach` ist die Position der Notiz, die bisher darunter stand (null = keine).
 */
export function bearbeiteNotiz(notiz: Notiz, neuerText: string, nach: number | null, umg: Umgebung): Bearbeitung {
  const teile = zerlegeText(neuerText);
  if (teile.length === 0) return { notiz: null, abgetrennt: [] };

  const { text, zustand } = leseAufgabenPraefix(teile[0]);
  let aufgabe = notiz.aufgabe;
  if (zustand) {
    const erledigt = zustand === 'erledigt';
    aufgabe = aufgabe
      ? { ...aufgabe, erledigt, erledigt_am: erledigt ? (aufgabe.erledigt_am ?? umg.jetzt) : null }
      : neueAufgabe(erledigt, umg.jetzt);
  }

  const unveraendert = text === notiz.text && aufgabe === notiz.aufgabe;
  const bearbeitet: Notiz = unveraendert
    ? notiz
    : { ...notiz, text, tags: leseTags(text), aufgabe, geaendert: umg.jetzt };

  const rest = teile.slice(1);
  const positionen = positionenZwischen(notiz.position, nach, rest.length);
  const abgetrennt = rest.map((teil, i) => neueNotiz(teil, notiz.liste_id, positionen[i], umg));
  return { notiz: bearbeitet, abgetrennt };
}

/**
 * Führt zwei Notizen zusammen (die Trennung dazwischen wurde gelöscht).
 * Die obere bleibt mit ihrer ID und ihrem Erstelldatum erhalten und bekommt den
 * Text der unteren angehängt. Die untere wandert in den Papierkorb.
 */
export function fuehreZusammen(obere: Notiz, untere: Notiz, umg: Umgebung): { obere: Notiz; untere: Notiz } {
  const text = `${obere.text}\n${untere.text}`;
  return {
    obere: { ...obere, text, tags: leseTags(text), geaendert: umg.jetzt },
    untere: { ...untere, geloescht: umg.jetzt, geaendert: umg.jetzt },
  };
}
