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

/**
 * Eine noch nicht hochgeladene Änderung: welche Notiz oder Liste betroffen ist und wann.
 * Die Warteschlange übersteht Neuladen und Neustart. Wird dieselbe Notiz mehrmals geändert,
 * bleibt es bei einem Eintrag (mit der Zeit der letzten Änderung).
 */
export interface WarteschlangenEintrag {
  id: string;
  /** Zeitpunkt der Änderung in Millisekunden */
  stand: number;
}

class Datenbank extends Dexie {
  notizen!: Table<Notiz, string>;
  listen!: Table<Liste, string>;
  meta!: Table<MetaEintrag, string>;
  warteschlange!: Table<WarteschlangenEintrag, string>;
  /** Was der Abgleich sich merkt: letzter gemeinsamer Stand, Stand der Drive-Dateien, Sicherung */
  abgleich!: Table<MetaEintrag, string>;

  constructor() {
    super('gedankenwelt');
    // Hier stehen nur die Felder, nach denen die Datenbank suchen können soll.
    this.version(1).stores({
      notizen: 'id, liste_id',
      listen: 'id',
      meta: 'schluessel',
    });
    // Phase 2: Tabellen für den Abgleich mit Google Drive. Vorhandene Daten bleiben unberührt.
    this.version(3).stores({
      warteschlange: 'id, stand',
      abgleich: 'schluessel',
    });
  }
}

export const db = new Datenbank();
