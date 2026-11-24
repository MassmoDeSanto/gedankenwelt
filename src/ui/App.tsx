/** Oberste Komponente: wählt anhand der Adresse die Seite aus und setzt das Farbschema. */
import { useEffect } from 'react';
import { useZustand } from '../db/speicher';
import { AufgabenSeite } from './AufgabenSeite';
import { Einstellungen } from './Einstellungen';
import { Gedankenwelt } from './Gedankenwelt';
import { ImportSeite } from './ImportSeite';
import { Listenansicht } from './Listenansicht';
import { Papierkorb } from './Papierkorb';
import { Meldungsleiste } from './Meldungsleiste';
import { SpeicherWarnung } from './SpeicherWarnung';
import { useRoute, type Route } from './router';
import { Start } from './Start';
import { TagebuchMonat } from './TagebuchMonat';
import { TagebuchSeite } from './TagebuchSeite';

export function App() {
  const z = useZustand();
  const route = useRoute();
  const thema = z.einstellungen.thema;

  useEffect(() => {
    document.documentElement.dataset.thema = thema;
    // Farbe der Browser-Leiste (wichtig für die installierte App am Handy)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', thema === 'hell' ? '#f3f1ec' : '#1c1b19');
  }, [thema]);

  // Beim Wechsel der Seite oben anfangen (Listen kümmern sich selbst darum).
  useEffect(() => {
    if (route.seite !== 'liste') window.scrollTo(0, 0);
  }, [route.seite]);

  if (!z.geladen) return null;

  return (
    <>
      <SpeicherWarnung />
      {seite(route)}
      <Meldungsleiste />
    </>
  );
}

function seite(route: Route) {
  switch (route.seite) {
    case 'welt':
      return <Gedankenwelt />;
    case 'liste':
      return <Listenansicht id={route.id} notiz={route.notiz} />;
    case 'aufgaben':
      return <AufgabenSeite filter={route.filter ?? 'alle'} />;
    case 'einstellungen':
      return <Einstellungen />;
    case 'papierkorb':
      return <Papierkorb />;
    case 'import':
      return <ImportSeite />;
    case 'tagebuch':
      return <TagebuchSeite datum={route.datum} notiz={route.notiz} />;
    case 'tagebuchmonat':
      return <TagebuchMonat monat={route.monat} />;
    default:
      return <Start />;
  }
}
