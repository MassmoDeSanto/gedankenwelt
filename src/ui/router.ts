/**
 * Mini-Navigation über den Teil der Adresse hinter dem „#“
 * (z. B. …/#/liste/01ABC). Dadurch funktionieren die Zurück-Taste des Browsers
 * und später das Hosting auf GitHub Pages ohne Extra-Einstellungen.
 */
import { useMemo, useSyncExternalStore } from 'react';

export type Route =
  | { seite: 'start' }
  | { seite: 'welt' }
  | { seite: 'liste'; id: string; notiz?: string }
  /** Tagebuch: ohne Datum der heutige Tag (KONZEPT.md, Abschnitt 13.6) */
  | { seite: 'tagebuch'; datum?: string; notiz?: string }
  | { seite: 'aufgaben' }
  | { seite: 'einstellungen' }
  | { seite: 'import' }
  | { seite: 'papierkorb' };

export function leseRoute(hash: string): Route {
  const [pfad, abfrage = ''] = hash.replace(/^#\/?/, '').split('?');
  const [seite, id] = pfad.split('/');
  if (seite === 'welt') return { seite: 'welt' };
  if (seite === 'aufgaben') return { seite: 'aufgaben' };
  if (seite === 'einstellungen') return { seite: 'einstellungen' };
  if (seite === 'papierkorb') return { seite: 'papierkorb' };
  if (seite === 'import') return { seite: 'import' };
  if (seite === 'tagebuch') {
    const datum = id && /^\d{4}-\d{2}-\d{2}$/.test(id) ? id : undefined;
    const notiz = new URLSearchParams(abfrage).get('n') ?? undefined;
    return { seite: 'tagebuch', datum, notiz };
  }
  if (seite === 'liste' && id) {
    const notiz = new URLSearchParams(abfrage).get('n') ?? undefined;
    return { seite: 'liste', id, notiz };
  }
  return { seite: 'start' };
}

/** Adresse einer Seite, zum Einsetzen in Links. */
export function adresse(route: Route): string {
  if (route.seite === 'start') return '#/';
  if (route.seite === 'liste') return `#/liste/${route.id}${route.notiz ? `?n=${route.notiz}` : ''}`;
  if (route.seite === 'tagebuch') {
    return `#/tagebuch${route.datum ? `/${route.datum}` : ''}${route.notiz ? `?n=${route.notiz}` : ''}`;
  }
  return `#/${route.seite}`;
}

export function gehe(route: Route): void {
  window.location.hash = adresse(route);
}

function abonniere(h: () => void): () => void {
  window.addEventListener('hashchange', h);
  return () => window.removeEventListener('hashchange', h);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(abonniere, () => window.location.hash);
  return useMemo(() => leseRoute(hash), [hash]);
}
