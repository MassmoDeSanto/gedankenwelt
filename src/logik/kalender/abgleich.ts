/**
 * Abgleich der Aufgaben mit dem Kalender (PHASE-3.md, Abschnitt 4).
 *
 * Die App ist die einzige Wahrheit: Der Kalender wird so hergerichtet, dass es für jede
 * offene Aufgabe mit Uhrzeit genau einen Termin gibt – nicht mehr und nicht weniger.
 * In die andere Richtung wird nichts übernommen: Wer einen Termin im Kalender ändert,
 * bekommt ihn beim nächsten Abgleich überschrieben; wer ihn löscht, bekommt ihn neu.
 *
 * Wie beim Drive-Abgleich wird nicht „nachgespielt“, was passiert ist, sondern verglichen,
 * was sein soll und was ist. Darum ist es egal, ob der letzte Abgleich unterbrochen wurde
 * oder ob zwei Geräte gleichzeitig abgleichen: Am Ende stimmt der Kalender.
 */
import type { Notiz } from '../../modell/typen';
import { pfadText, type ListenKarte } from '../listen';
import { alsKlartext, leseInline } from '../markdownLight';
import { faelligUhrzeit } from '../zeit';
import { TerminFehlt, type Kalender, type Termin, type TerminDaten } from './kalender';

const TITEL_MAX = 120;

/** Der Titel eines Termins: erste Zeile der Aufgabe, ohne Tags und ohne Markdown-Zeichen. */
export function titelAus(text: string): string {
  const zeile = text.split('\n').find((z) => z.trim()) ?? '';
  const ohneTags = leseInline(zeile.replace(/^\s*- +/, '')).filter((teil) => teil.art !== 'tag');
  const titel = alsKlartext(ohneTags).replace(/\s+/g, ' ').trim();
  return titel.length > TITEL_MAX ? titel.slice(0, TITEL_MAX - 1).trimEnd() + '…' : titel || 'Aufgabe';
}

/**
 * Welcher Termin gehört zu dieser Notiz? null, wenn sie keinen bekommt:
 * keine Aufgabe, erledigt, gelöscht oder ohne Uhrzeit.
 */
export function terminFuer(notiz: Notiz, listen: ListenKarte, appAdresse: string): TerminDaten | null {
  const aufgabe = notiz.aufgabe;
  if (!aufgabe || aufgabe.erledigt || notiz.geloescht) return null;
  if (!aufgabe.faellig || !faelligUhrzeit(aufgabe.faellig)) return null;
  return {
    notiz_id: notiz.id,
    titel: titelAus(notiz.text),
    beginn: aufgabe.faellig,
    erinnerung: aufgabe.erinnerung,
    beschreibung: `${pfadText(notiz.liste_id, listen)}\n${appAdresse}#/liste/${notiz.liste_id}?n=${notiz.id}`,
  };
}

function gleich(a: TerminDaten, b: TerminDaten): boolean {
  return (
    a.titel === b.titel &&
    a.beginn === b.beginn &&
    a.erinnerung === b.erinnerung &&
    a.beschreibung === b.beschreibung &&
    !!a.taeglich === !!b.taeglich
  );
}

/** Kennung der täglichen Schreib-Erinnerung im Kalender (anstelle einer Notiz-ID). */
export const SCHREIB_ERINNERUNG_ID = '_schreiberinnerung';

/**
 * Die tägliche Schreib-Erinnerung des Tagebuchs (KONZEPT.md, Abschnitt 13.9): ein einziger
 * Serientermin. Er beginnt an einem festen Tag in der Vergangenheit, damit er nicht jeden Tag
 * geändert werden muss; Google zeigt ihn trotzdem an jedem Tag ab heute.
 */
export function schreibErinnerungTermin(uhrzeit: string, appAdresse: string): TerminDaten {
  return {
    notiz_id: SCHREIB_ERINNERUNG_ID,
    titel: 'Tagebuch schreiben',
    beginn: `2026-01-01T${uhrzeit}`,
    erinnerung: 0,
    beschreibung: `Gedankenwelt › Tagebuch\n${appAdresse}#/tagebuch`,
    taeglich: true,
  };
}

/**
 * Trägt die Termin-ID in eine Notiz ein.
 *
 * Der Zeitstempel der Notiz rückt dabei nur um eine Sekunde vor – nicht auf „jetzt“. So gilt der
 * Eintrag beim Drive-Abgleich als Änderung und kommt auf dem anderen Gerät an, ist aber älter als
 * jede echte Bearbeitung, die dort inzwischen (z. B. offline) gemacht wurde. Eine automatisch
 * eingetragene Termin-ID kann deshalb nie getippten Text verdrängen.
 */
export function mitTerminId(notiz: Notiz, terminId: string | null): Notiz {
  if (!notiz.aufgabe) return notiz;
  const geaendert = new Date(new Date(notiz.geaendert).getTime() + 1000).toISOString().slice(0, 19) + 'Z';
  return { ...notiz, geaendert, aufgabe: { ...notiz.aufgabe, kalender_event_id: terminId } };
}

export interface KalenderErgebnis {
  angelegt: number;
  geaendert: number;
  geloescht: number;
  /** Notizen, deren `kalender_event_id` sich geändert hat: Notiz-ID → neue Termin-ID (oder null) */
  ids: Map<string, string | null>;
}

/**
 * Richtet den Kalender nach den Aufgaben aus.
 * `jetztLokal`: Ortszeit, z. B. "2026-11-16T10:30". Termine in der Vergangenheit werden nicht
 * neu angelegt (eine Erinnerung käme ohnehin nicht mehr); vorhandene bleiben, solange die Aufgabe offen ist.
 */
export async function gleicheKalenderAb(
  kalender: Kalender,
  kalenderId: string,
  notizen: Iterable<Notiz>,
  listen: ListenKarte,
  optionen: {
    jetztLokal: string;
    appAdresse: string;
    /**
     * Auch Termine löschen, deren Notiz dieses Gerät gar nicht kennt. Nur für das Werkzeug
     * „Erinnerungen neu aufbauen“: Im normalen Abgleich könnte ein Gerät sonst den Termin einer
     * Aufgabe löschen, die ein anderes Gerät gerade erst angelegt hat und die hier noch nicht angekommen ist.
     */
    verwaisteAufraeumen?: boolean;
    /** Die tägliche Schreib-Erinnerung; null oder fehlend = es soll keine geben */
    schreibErinnerung?: TerminDaten | null;
  },
): Promise<KalenderErgebnis> {
  const ergebnis: KalenderErgebnis = { angelegt: 0, geaendert: 0, geloescht: 0, ids: new Map() };

  // Was ist: alle Termine der App, je Notiz. Die kleinste Termin-ID steht vorn – so entscheiden
  // sich zwei Geräte bei doppelten Terminen immer für denselben.
  const vorhanden = new Map<string, Termin[]>();
  for (const termin of await kalender.termine(kalenderId)) {
    vorhanden.set(termin.notiz_id, [...(vorhanden.get(termin.notiz_id) ?? []), termin]);
  }
  for (const liste of vorhanden.values()) liste.sort((a, b) => (a.id < b.id ? -1 : 1));

  const loesche = async (termin: Termin) => {
    try {
      await kalender.loescheTermin(kalenderId, termin.id);
    } catch (fehler) {
      if (!(fehler instanceof TerminFehlt)) throw fehler; // schon weg ist auch gut
    }
    ergebnis.geloescht++;
  };

  const merke = (notiz: Notiz, id: string | null) => {
    if ((notiz.aufgabe?.kalender_event_id ?? null) !== id) ergebnis.ids.set(notiz.id, id);
  };

  const bekannt = new Set<string>();
  for (const notiz of notizen) {
    bekannt.add(notiz.id);
    const soll = terminFuer(notiz, listen, optionen.appAdresse);
    const termine = vorhanden.get(notiz.id) ?? [];

    if (!soll) {
      // Abgehakt, gelöscht oder ohne Uhrzeit: Der Termin verschwindet.
      for (const termin of termine) await loesche(termin);
      if (notiz.aufgabe) merke(notiz, null);
      continue;
    }

    // Doppelte Termine (zwei Geräte haben gleichzeitig angelegt): einer bleibt, die übrigen gehen.
    const [behalten, ...ueberzaehlig] = termine;
    for (const termin of ueberzaehlig) await loesche(termin);

    let id: string | null = behalten?.id ?? null;
    if (behalten && !gleich(behalten, soll)) {
      try {
        await kalender.aendereTermin(kalenderId, behalten.id, soll);
        ergebnis.geaendert++;
      } catch (fehler) {
        if (!(fehler instanceof TerminFehlt)) throw fehler;
        id = null; // inzwischen im Kalender gelöscht: unten neu anlegen
      }
    }
    if (!id && soll.beginn > optionen.jetztLokal) {
      id = (await kalender.erstelleTermin(kalenderId, soll)).id;
      ergebnis.angelegt++;
    }
    merke(notiz, id);
  }

  // Die tägliche Schreib-Erinnerung: genau ein Serientermin, oder keiner.
  bekannt.add(SCHREIB_ERINNERUNG_ID);
  {
    const soll = optionen.schreibErinnerung ?? null;
    const [behalten, ...ueberzaehlig] = vorhanden.get(SCHREIB_ERINNERUNG_ID) ?? [];
    for (const termin of ueberzaehlig) await loesche(termin);
    if (!soll) {
      if (behalten) await loesche(behalten);
    } else {
      let da = !!behalten;
      if (behalten && !gleich(behalten, soll)) {
        try {
          await kalender.aendereTermin(kalenderId, behalten.id, soll);
          ergebnis.geaendert++;
        } catch (fehler) {
          if (!(fehler instanceof TerminFehlt)) throw fehler;
          da = false;
        }
      }
      if (!da) {
        await kalender.erstelleTermin(kalenderId, soll);
        ergebnis.angelegt++;
      }
    }
  }

  // Verwaiste Termine: Die Notiz dazu gibt es auf diesem Gerät gar nicht (mehr).
  if (optionen.verwaisteAufraeumen) {
    for (const [notiz_id, termine] of vorhanden) {
      if (!bekannt.has(notiz_id)) for (const termin of termine) await loesche(termin);
    }
  }

  return ergebnis;
}
