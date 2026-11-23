/** Sammelansicht: alle offenen Aufgaben aus allen Listen, nach Dringlichkeit gruppiert. */
import { useMemo } from 'react';
import { useZustand } from '../db/speicher';
import { gruppiereAufgaben, offeneAufgaben } from '../logik/aufgaben';
import { herkunftText } from '../logik/tagebuch';
import { lokalesDatum } from '../logik/zeit';
import type { Notiz } from '../modell/typen';
import { Kopfzeile, klassen } from './Bausteine';
import { AufgabenZeile } from './Start';

export function AufgabenSeite() {
  const z = useZustand();
  const heute = lokalesDatum();
  const offen = useMemo(() => offeneAufgaben(z.notizen.values()), [z]);
  const gruppen = gruppiereAufgaben(offen, heute);

  const gruppe = (titel: string, farbe: string, aufgaben: Notiz[]) =>
    aufgaben.length > 0 && (
      <section className="karte">
        <div className="kartenkopf">
          <span className={klassen('etikett', farbe)}>{titel}</span>
          <span className="mono meta">{aufgaben.length}</span>
        </div>
        {aufgaben.map((notiz) => (
          <AufgabenZeile
            key={notiz.id}
            notiz={notiz}
            heute={heute}
            herkunft={herkunftText(notiz, z.listen, z.tagebuchtage.values())}
          />
        ))}
      </section>
    );

  return (
    <div className="seite">
      <Kopfzeile zurueck={{ seite: 'start' }} titel={<h1>Aufgaben</h1>} />
      {offen.length === 0 && <p className="hinweis leer">Keine offenen Aufgaben.</p>}
      {gruppe('Überfällig', 'bernstein', gruppen.ueberfaellig)}
      {gruppe('Heute', 'bernstein', gruppen.heute)}
      {gruppe('Demnächst', 'tuerkis', gruppen.demnaechst)}
      {gruppe('Ohne Datum', '', gruppen.ohneDatum)}
    </div>
  );
}
