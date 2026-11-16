/**
 * Zeigt Fälligkeit und Wiederholung einer Aufgabe: Wiederholungs-Symbol mit Kurztext
 * („jeden So“), heute Fälliges in Bernstein, Überfälliges ruhig in Rot.
 */
import { wiederholungKurz } from '../logik/wiederholung';
import { faelligDatum, formatFaellig } from '../logik/zeit';
import type { Aufgabe } from '../modell/typen';
import { Wiederholen } from './Symbole';

/** 'ueberfaellig' | 'heute' | '' – als CSS-Klasse nutzbar. Erledigte Aufgaben sind nie dringend. */
export function dringlichkeit(aufgabe: Aufgabe, heute: string): 'ueberfaellig' | 'heute' | '' {
  if (!aufgabe.faellig || aufgabe.erledigt) return '';
  const datum = faelligDatum(aufgabe.faellig);
  return datum < heute ? 'ueberfaellig' : datum === heute ? 'heute' : '';
}

/** Kurztext der Wiederholung mit Symbol, z. B. „↻ jeden So“. */
export function WiederholungsHinweis({ aufgabe }: { aufgabe: Aufgabe }) {
  if (!aufgabe.wiederholung) return null;
  return (
    <span className="wdh" title="Wiederholt sich">
      <Wiederholen />
      {wiederholungKurz(aufgabe.wiederholung)}
    </span>
  );
}

/** Fälligkeit als Text, eingefärbt nach Dringlichkeit. */
export function FaelligText({ aufgabe, heute }: { aufgabe: Aufgabe; heute: string }) {
  if (!aufgabe.faellig) return null;
  const art = dringlichkeit(aufgabe, heute);
  return (
    <span className={`faelligtext ${art}`}>
      {art === 'ueberfaellig' && 'überfällig · '}
      {formatFaellig(aufgabe.faellig, heute)}
    </span>
  );
}
