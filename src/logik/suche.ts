/**
 * Suche (KONZEPT.md, Abschnitt 4): fehlertolerant, mit Wortanfang-Suche,
 * komplett lokal. Treffer ist immer die einzelne Notiz.
 *
 * Die eigentliche Volltextsuche macht die Bibliothek MiniSearch. Sie baut einen
 * Index (ein Nachschlageverzeichnis Wort → Notizen) im Arbeitsspeicher auf.
 */
import MiniSearch from 'minisearch';
import type { Notiz } from '../modell/typen';
import { mitNachfahren, type ListenKarte } from './listen';
import { datumVon } from './zeit';

export interface SuchFilter {
  /** Nur diese Liste samt Unterlisten. null = alle Listen. */
  liste_id: string | null;
  /** Die Notiz muss alle diese Tags tragen. */
  tags: string[];
  /** Auf welches Datum sich „von/bis“ bezieht. */
  datumFeld: 'erstellt' | 'geaendert';
  /** Ortsdatum "2026-11-01", einschließlich. null = offen. */
  von: string | null;
  bis: string | null;
  aufgaben: 'alle' | 'offen' | 'erledigt' | 'keine';
}

export const LEERER_FILTER: SuchFilter = {
  liste_id: null,
  tags: [],
  datumFeld: 'erstellt',
  von: null,
  bis: null,
  aufgaben: 'alle',
};

export function filterAktiv(filter: SuchFilter): boolean {
  return (
    filter.liste_id !== null ||
    filter.tags.length > 0 ||
    filter.von !== null ||
    filter.bis !== null ||
    filter.aufgaben !== 'alle'
  );
}

export interface Treffer {
  notiz: Notiz;
  /** Die Wörter der Notiz, die zur Suche gepasst haben (zum Hervorheben). */
  terme: string[];
  punkte: number;
}

/** Vereinheitlicht ein Wort: Kleinbuchstaben, ohne Akzente/Umlaut-Punkte („Geschäft“ → „geschaft“). */
export function normalisiere(wort: string): string {
  return wort
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function passt(notiz: Notiz, filter: SuchFilter, listenIds: Set<string> | null): boolean {
  if (listenIds && !listenIds.has(notiz.liste_id)) return false;
  for (const tag of filter.tags) if (!notiz.tags.includes(tag)) return false;

  if (filter.aufgaben === 'offen' && !(notiz.aufgabe && !notiz.aufgabe.erledigt)) return false;
  if (filter.aufgaben === 'erledigt' && !notiz.aufgabe?.erledigt) return false;
  if (filter.aufgaben === 'keine' && notiz.aufgabe) return false;

  if (filter.von || filter.bis) {
    const datum = datumVon(notiz[filter.datumFeld]);
    if (filter.von && datum < filter.von) return false;
    if (filter.bis && datum > filter.bis) return false;
  }
  return true;
}

export class Suchindex {
  private mini = this.neuerIndex();
  private notizen = new Map<string, Notiz>();

  private neuerIndex() {
    return new MiniSearch<{ id: string; text: string }>({
      fields: ['text'],
      idField: 'id',
      processTerm: (wort) => normalisiere(wort) || null,
      searchOptions: {
        prefix: true, // „Hotel“ findet „Hotels“
        fuzzy: 0.2, // Tippfehler: je 5 Buchstaben ist etwa 1 Fehler erlaubt
        combineWith: 'AND', // alle Suchwörter müssen vorkommen
      },
    });
  }

  /** Baut den Index komplett neu auf. Gelöschte Notizen werden nie aufgenommen. */
  setzeAlle(notizen: Iterable<Notiz>): void {
    this.mini = this.neuerIndex();
    this.notizen = new Map();
    const aktive: Notiz[] = [];
    for (const notiz of notizen) {
      if (notiz.geloescht) continue;
      this.notizen.set(notiz.id, notiz);
      aktive.push(notiz);
    }
    this.mini.addAll(aktive.map((n) => ({ id: n.id, text: n.text })));
  }

  /** Nach jeder Änderung an einer Notiz aufrufen (neu, bearbeitet, gelöscht, wiederhergestellt). */
  aktualisiere(notiz: Notiz): void {
    const alt = this.notizen.get(notiz.id);
    if (notiz.geloescht) {
      if (alt) {
        this.mini.discard(notiz.id);
        this.notizen.delete(notiz.id);
      }
      return;
    }
    if (!alt) this.mini.add({ id: notiz.id, text: notiz.text });
    else if (alt.text !== notiz.text) this.mini.replace({ id: notiz.id, text: notiz.text });
    this.notizen.set(notiz.id, notiz);
  }

  entferne(id: string): void {
    if (this.notizen.delete(id)) this.mini.discard(id);
  }

  get anzahl(): number {
    return this.notizen.size;
  }

  /**
   * Sucht Notizen. Ohne Suchtext, aber mit Filter: alle passenden Notizen, neueste zuerst.
   * Ohne Suchtext und ohne Filter: nichts.
   */
  suche(anfrage: string, filter: SuchFilter, listen: ListenKarte, limit = 100): Treffer[] {
    const listenIds = filter.liste_id ? mitNachfahren(filter.liste_id, listen) : null;
    const text = anfrage.trim();

    if (!text) {
      if (!filterAktiv(filter)) return [];
      return [...this.notizen.values()]
        .filter((n) => passt(n, filter, listenIds))
        .sort((a, b) => (a.geaendert < b.geaendert ? 1 : a.geaendert > b.geaendert ? -1 : 0))
        .slice(0, limit)
        .map((notiz) => ({ notiz, terme: [], punkte: 0 }));
    }

    const ergebnis: Treffer[] = [];
    const roh = this.mini.search(text, {
      filter: (r) => {
        const notiz = this.notizen.get(r.id as string);
        return !!notiz && passt(notiz, filter, listenIds);
      },
    });
    for (const r of roh) {
      if (ergebnis.length >= limit) break;
      ergebnis.push({ notiz: this.notizen.get(r.id as string)!, terme: r.terms, punkte: r.score });
    }
    return ergebnis;
  }
}

export interface Abschnitt {
  text: string;
  treffer: boolean;
}

/** Wörter so zerlegen, wie MiniSearch es tut: an Leerzeichen und Satzzeichen. */
const WORT = /[^\n\r\p{Z}\p{P}]+/gu;

/** Zerlegt einen Notiztext in Abschnitte, damit die gefundenen Wörter hervorgehoben werden können. */
export function markiere(text: string, terme: string[]): Abschnitt[] {
  if (terme.length === 0) return [{ text, treffer: false }];
  const gesucht = new Set(terme);
  const abschnitte: Abschnitt[] = [];
  let ende = 0;
  for (const wort of text.matchAll(WORT)) {
    if (!gesucht.has(normalisiere(wort[0]))) continue;
    const start = wort.index!;
    if (start > ende) abschnitte.push({ text: text.slice(ende, start), treffer: false });
    abschnitte.push({ text: wort[0], treffer: true });
    ende = start + wort[0].length;
  }
  if (ende < text.length) abschnitte.push({ text: text.slice(ende), treffer: false });
  return abschnitte;
}
