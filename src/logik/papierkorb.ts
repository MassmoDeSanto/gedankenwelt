/**
 * Papierkorb-Regeln (KONZEPT.md, Abschnitt 5): Gelöschtes bleibt 30 Tage und
 * lässt sich wiederherstellen.
 *
 * Wird eine Liste gelöscht, bekommen sie selbst, alle Unterlisten und alle
 * Notizen darin denselben Lösch-Zeitstempel. An diesem gemeinsamen Zeitstempel
 * erkennt das Wiederherstellen, was zusammengehört.
 */
import { EINGANG_ID, type Liste, type Notiz, type Zeitstempel } from '../modell/typen';
import { mitNachfahren, type ListenKarte } from './listen';

export const AUFBEWAHRUNG_TAGE = 30;
const TAG_MS = 24 * 60 * 60 * 1000;

export interface Aenderung {
  listen: Liste[];
  notizen: Notiz[];
}

/** Löscht eine Liste samt Unterlisten und Notizen. Gibt nur die geänderten Einträge zurück. */
export function loescheListe(
  liste_id: string,
  listen: ListenKarte,
  notizen: Iterable<Notiz>,
  jetzt: Zeitstempel,
): Aenderung {
  if (liste_id === EINGANG_ID) return { listen: [], notizen: [] };
  const betroffen = new Set(
    [...mitNachfahren(liste_id, listen)].filter((id) => !listen.get(id)?.geloescht && id !== EINGANG_ID),
  );
  const geaenderteListen = [...betroffen].map((id) => ({ ...listen.get(id)!, geloescht: jetzt, geaendert: jetzt }));
  const geaenderteNotizen: Notiz[] = [];
  for (const n of notizen) {
    if (!n.geloescht && betroffen.has(n.liste_id)) geaenderteNotizen.push({ ...n, geloescht: jetzt, geaendert: jetzt });
  }
  return { listen: geaenderteListen, notizen: geaenderteNotizen };
}

/** Stellt eine gelöschte Liste mit allem wieder her, was gleichzeitig mit ihr gelöscht wurde. */
export function stelleListeWiederHer(
  liste_id: string,
  listen: ListenKarte,
  notizen: Iterable<Notiz>,
  jetzt: Zeitstempel,
): Aenderung {
  const wurzel = listen.get(liste_id);
  if (!wurzel?.geloescht) return { listen: [], notizen: [] };
  const stempel = wurzel.geloescht;
  const betroffen = new Set([...mitNachfahren(liste_id, listen)].filter((id) => listen.get(id)?.geloescht === stempel));

  const geaenderteListen = [...betroffen].map((id) => {
    const liste = { ...listen.get(id)!, geloescht: null, geaendert: jetzt };
    // Gibt es die Elternliste nicht mehr (oder ist sie selbst gelöscht), kommt die Liste nach ganz oben.
    if (id === liste_id && liste.eltern_id) {
      const eltern = listen.get(liste.eltern_id);
      if (!eltern || eltern.geloescht) liste.eltern_id = null;
    }
    return liste;
  });
  const geaenderteNotizen: Notiz[] = [];
  for (const n of notizen) {
    if (n.geloescht === stempel && betroffen.has(n.liste_id)) {
      geaenderteNotizen.push({ ...n, geloescht: null, geaendert: jetzt });
    }
  }
  return { listen: geaenderteListen, notizen: geaenderteNotizen };
}

/** Stellt eine einzelne Notiz wieder her. Ist ihre Liste nicht mehr da, landet sie im Eingang. */
export function stelleNotizWiederHer(notiz: Notiz, listen: ListenKarte, jetzt: Zeitstempel): Notiz {
  const liste = listen.get(notiz.liste_id);
  const liste_id = liste && !liste.geloescht ? notiz.liste_id : EINGANG_ID;
  return { ...notiz, liste_id, geloescht: null, geaendert: jetzt };
}

export interface PapierkorbInhalt {
  /** Gelöschte Listen, jeweils nur die oberste eines gemeinsam gelöschten Astes. */
  listen: { liste: Liste; anzahlNotizen: number }[];
  /** Einzeln gelöschte Notizen. */
  notizen: Notiz[];
}

/** Was der Papierkorb anzeigt, neueste Löschung zuerst. */
export function papierkorbInhalt(listen: ListenKarte, notizen: Iterable<Notiz>): PapierkorbInhalt {
  const alleNotizen = [...notizen];
  const neuesteZuerst = (a: Zeitstempel | null, b: Zeitstempel | null) => (a! < b! ? 1 : a! > b! ? -1 : 0);

  const oberste = [...listen.values()].filter((l) => {
    if (!l.geloescht) return false;
    const eltern = l.eltern_id ? listen.get(l.eltern_id) : undefined;
    return !eltern || eltern.geloescht !== l.geloescht;
  });

  return {
    listen: oberste
      .map((liste) => {
        const ast = mitNachfahren(liste.id, listen);
        const anzahlNotizen = alleNotizen.filter((n) => n.geloescht === liste.geloescht && ast.has(n.liste_id)).length;
        return { liste, anzahlNotizen };
      })
      .sort((a, b) => neuesteZuerst(a.liste.geloescht, b.liste.geloescht)),
    notizen: alleNotizen
      .filter((n) => n.geloescht && listen.get(n.liste_id)?.geloescht !== n.geloescht)
      .sort((a, b) => neuesteZuerst(a.geloescht, b.geloescht)),
  };
}

/** Liegt das Löschen länger als 30 Tage zurück? Dann wird endgültig gelöscht. */
export function abgelaufen(geloescht: Zeitstempel, jetzt: Date): boolean {
  return jetzt.getTime() - new Date(geloescht).getTime() > AUFBEWAHRUNG_TAGE * TAG_MS;
}

/** Wie viele Tage ein Eintrag noch im Papierkorb bleibt (mindestens 0). */
export function resttage(geloescht: Zeitstempel, jetzt: Date): number {
  const vergangen = (jetzt.getTime() - new Date(geloescht).getTime()) / TAG_MS;
  return Math.max(0, Math.ceil(AUFBEWAHRUNG_TAGE - vergangen));
}
