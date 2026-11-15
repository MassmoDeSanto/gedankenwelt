/**
 * Die Datenbank im Browser (IndexedDB), angesprochen über die Bibliothek Dexie.
 * Sie überlebt das Schließen und Neuladen des Browsers.
 */
import Dexie, { type Table } from 'dexie';
import type { Liste, Notiz } from '../modell/typen';

export interface MetaEintrag {
  schluessel: string;
  wert: unknown;
}

class Datenbank extends Dexie {
  notizen!: Table<Notiz, string>;
  listen!: Table<Liste, string>;
  meta!: Table<MetaEintrag, string>;

  constructor() {
    super('gedankenwelt');
    // Hier stehen nur die Felder, nach denen die Datenbank suchen können soll.
    this.version(1).stores({
      notizen: 'id, liste_id',
      listen: 'id',
      meta: 'schluessel',
    });
  }
}

export const db = new Datenbank();
