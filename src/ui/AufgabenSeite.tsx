/**
 * Sammelansicht „Alle Aufgaben“ im Design „Planer“: oben Filter-Chips (Alle, Überfällig, Heute,
 * In Arbeit, Hoch), darunter die offenen Aufgaben nach Monaten wie in einem Taschenkalender,
 * Aufgaben ohne Datum am Ende. Der Filter steht in der Adresse (#/aufgaben/heute).
 */
import { useMemo } from 'react';
import { useZustand } from '../db/speicher';
import {
  AUFGABEN_FILTER,
  gruppiereNachMonat,
  offeneAufgaben,
  passtZuFilter,
  type AufgabenFilter,
} from '../logik/aufgaben';
import { herkunftText } from '../logik/tagebuch';
import { lokalesDatum } from '../logik/zeit';
import { Kopfzeile, klassen } from './Bausteine';
import { adresse } from './router';
import { AufgabenZeile } from './Start';
import { Flagge } from './Symbole';

const CHIP_TEXT: Record<AufgabenFilter, string> = {
  alle: 'Alle',
  ueberfaellig: 'Überfällig',
  heute: 'Heute',
  arbeit: 'In Arbeit',
  hoch: 'Hoch',
};

export function AufgabenSeite({ filter }: { filter: AufgabenFilter }) {
  const z = useZustand();
  const heute = lokalesDatum();
  const offen = useMemo(() => offeneAufgaben(z.notizen.values()), [z]);
  const anzahl = (f: AufgabenFilter) => offen.filter((n) => passtZuFilter(n, f, heute)).length;
  const gruppen = gruppiereNachMonat(
    offen.filter((n) => passtZuFilter(n, filter, heute)),
    heute,
  );

  return (
    <div className="seite">
      <Kopfzeile zurueck={{ seite: 'start' }} titel={<h1>Aufgaben</h1>} />
      {offen.length > 0 && (
        <nav className="filterchips" aria-label="Aufgaben filtern">
          {AUFGABEN_FILTER.map((f) => {
            const n = anzahl(f);
            if (n === 0 && f !== 'alle' && f !== filter) return null;
            return (
              <a
                key={f}
                className={klassen('filterchip', `filter-${f}`, f === filter && 'an')}
                href={adresse({ seite: 'aufgaben', filter: f })}
                aria-current={f === filter ? 'page' : undefined}
              >
                {f === 'hoch' && <Flagge />}
                {CHIP_TEXT[f]} <span className="anzahl">{n}</span>
              </a>
            );
          })}
        </nav>
      )}
      {offen.length === 0 && <p className="hinweis leer">Keine offenen Aufgaben.</p>}
      {offen.length > 0 && gruppen.length === 0 && <p className="hinweis leer">Nichts in diesem Filter.</p>}
      {gruppen.map((g) => (
        <section key={g.titel} className="planer-gruppe">
          <h2 className="etikett">
            {g.titel}
            {g.ohneDatum && ` · ${g.aufgaben.length}`}
          </h2>
          {g.aufgaben.map((notiz) => (
            <AufgabenZeile
              key={notiz.id}
              notiz={notiz}
              heute={heute}
              herkunft={herkunftText(notiz, z.listen, z.tagebuchtage.values())}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
