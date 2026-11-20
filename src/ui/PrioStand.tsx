/**
 * Priorität und Stand einer Aufgabe: Knöpfe unter der Aufgabe (ein Tipp schaltet weiter)
 * und eine kurze Anzeige für die To-do-Box und die Sammelansicht.
 */
import { setzePrioritaet, setzeStand } from '../db/aktionen';
import { naechsterStand, naechstePrioritaet } from '../logik/aufgaben';
import type { Aufgabe, Prioritaet } from '../modell/typen';
import { klassen } from './Bausteine';

const PRIO_ZEICHEN: Record<Prioritaet, string> = { hoch: '!!!', mittel: '!!', niedrig: '!' };

const PRIO_NAECHSTE: Record<string, string> = {
  keine: 'Priorität setzen (hoch)',
  hoch: 'Priorität hoch – tippen für mittel',
  mittel: 'Priorität mittel – tippen für niedrig',
  niedrig: 'Priorität niedrig – tippen für keine',
};

/** Die zwei Knöpfe neben „Termin“. Ohne Priorität bzw. im Stand „offen“ sind sie blass. */
export function PrioStandKnoepfe({ id, aufgabe }: { id: string; aufgabe: Aufgabe }) {
  const halteFokus = (e: { preventDefault: () => void }) => e.preventDefault();
  const p = aufgabe.prioritaet;
  const inArbeit = aufgabe.stand === 'in_arbeit';
  return (
    <>
      <button
        className={klassen('prio-knopf', p ? `prio-${p}` : 'leer')}
        title={PRIO_NAECHSTE[p ?? 'keine']}
        aria-label={PRIO_NAECHSTE[p ?? 'keine']}
        onMouseDown={halteFokus}
        onClick={() => setzePrioritaet(id, naechstePrioritaet(p))}
      >
        {p ? (
          <>
            <span className="prio-zeichen">{PRIO_ZEICHEN[p]}</span> {p}
          </>
        ) : (
          'Prio'
        )}
      </button>
      {!aufgabe.erledigt && (
        <button
          className={klassen('stand-knopf', inArbeit ? 'in-arbeit' : 'leer')}
          title={inArbeit ? 'In Arbeit – tippen für offen' : 'Offen – tippen für in Arbeit'}
          aria-label={inArbeit ? 'In Arbeit – tippen für offen' : 'Offen – tippen für in Arbeit'}
          onMouseDown={halteFokus}
          onClick={() => setzeStand(id, naechsterStand(aufgabe.stand))}
        >
          {inArbeit ? 'in Arbeit' : 'offen'}
        </button>
      )}
    </>
  );
}

/** Kurze Anzeige in der To-do-Box und der Sammelansicht, z. B. „!!! · in Arbeit“. */
export function PrioStandHinweis({ aufgabe }: { aufgabe: Aufgabe }) {
  const p = aufgabe.prioritaet;
  return (
    <>
      {p && (
        <span className={`prio-zeichen prio-${p}`} title={`Priorität ${p}`}>
          {PRIO_ZEICHEN[p]}
        </span>
      )}
      {aufgabe.stand === 'in_arbeit' && <span className="stand-hinweis">in Arbeit</span>}
    </>
  );
}
