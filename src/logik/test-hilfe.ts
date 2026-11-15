/** Kleine Helfer, um in Tests schnell Notizen und Listen zu bauen. */
import type { Liste, Notiz } from '../modell/typen';
import { leseTags } from './tags';
import type { Umgebung } from './absatz';

let zaehler = 0;

/** Erzeugt gültige, vorhersagbare Test-IDs: 01TEST…0001, 01TEST…0002 … */
export function testId(): string {
  zaehler++;
  return '01TEST' + String(zaehler).padStart(20, '0');
}

export function testUmgebung(jetzt = '2026-11-15T12:00:00Z'): Umgebung {
  return { jetzt, neueId: testId };
}

export function baueNotiz(teil: Partial<Notiz> & { text: string }): Notiz {
  return {
    id: testId(),
    liste_id: 'L1',
    position: 1,
    tags: leseTags(teil.text),
    erstellt: '2026-03-12T12:00:00Z',
    geaendert: '2026-03-12T12:00:00Z',
    aufgabe: null,
    geloescht: null,
    verweise: [],
    ...teil,
  };
}

export function baueListe(teil: Partial<Liste> & { name: string }): Liste {
  return {
    id: testId(),
    eltern_id: null,
    angeheftet: false,
    tagesgedanke: 'erben',
    position: 1,
    erstellt: '2026-01-01T12:00:00Z',
    geaendert: '2026-01-01T12:00:00Z',
    geloescht: null,
    ...teil,
  };
}
