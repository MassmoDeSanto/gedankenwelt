/** Hilfsfunktionen für den Listen-Baum (Listen mit beliebig tiefen Unterlisten). */
import { TAGEBUCH_ID, type Liste } from '../modell/typen';

export type ListenKarte = Map<string, Liste>;

export function alsKarte(listen: Iterable<Liste>): ListenKarte {
  const karte: ListenKarte = new Map();
  for (const liste of listen) karte.set(liste.id, liste);
  return karte;
}

/**
 * Aktive (nicht gelöschte) Unterlisten, sortiert nach Position. `eltern_id` null = oberste Ebene.
 * Das Tagebuch gehört nicht in den Listenbaum: Es hat eine eigene Seite und ist kein Ziel zum Verschieben.
 */
export function kinderVon(eltern_id: string | null, listen: ListenKarte): Liste[] {
  return [...listen.values()]
    .filter((l) => l.eltern_id === eltern_id && !l.geloescht && l.id !== TAGEBUCH_ID)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** Weg von der obersten Liste bis zur angegebenen Liste. */
export function pfadVon(liste_id: string, listen: ListenKarte): Liste[] {
  const pfad: Liste[] = [];
  const gesehen = new Set<string>();
  let aktuell = listen.get(liste_id);
  while (aktuell && !gesehen.has(aktuell.id)) {
    gesehen.add(aktuell.id);
    pfad.unshift(aktuell);
    aktuell = aktuell.eltern_id ? listen.get(aktuell.eltern_id) : undefined;
  }
  return pfad;
}

/** Herkunftspfad als Text, z. B. „Reise-App › Monetarisierung“. */
export function pfadText(liste_id: string, listen: ListenKarte): string {
  return pfadVon(liste_id, listen)
    .map((l) => l.name)
    .join(' › ');
}

/** IDs der Liste selbst und aller ihrer Unterlisten (beliebig tief), auch gelöschter. */
export function mitNachfahren(liste_id: string, listen: ListenKarte): Set<string> {
  const ergebnis = new Set<string>([liste_id]);
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const liste of listen.values()) {
      if (liste.eltern_id && ergebnis.has(liste.eltern_id) && !ergebnis.has(liste.id)) {
        ergebnis.add(liste.id);
        gewachsen = true;
      }
    }
  }
  return ergebnis;
}

/**
 * Ist der „Gedanke des Tages“ für diese Liste aktiv?
 * „erben“ übernimmt die Einstellung der Elternliste; ganz oben bedeutet „erben“ = aus.
 */
export function tagesgedankeAktiv(liste_id: string, listen: ListenKarte): boolean {
  const pfad = pfadVon(liste_id, listen);
  for (let i = pfad.length - 1; i >= 0; i--) {
    if (pfad[i].tagesgedanke === 'an') return true;
    if (pfad[i].tagesgedanke === 'aus') return false;
  }
  return false;
}

/** Nächste freie Position am Ende einer Geschwister-Reihe. */
export function naechstePosition(geschwister: { position: number }[]): number {
  return geschwister.reduce((max, g) => Math.max(max, g.position), 0) + 1;
}
