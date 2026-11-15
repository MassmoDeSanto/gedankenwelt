/** Papierkorb: gelöschte Listen und Notizen, 30 Tage lang wiederherstellbar. */
import { useMemo, useState } from 'react';
import { leerePapierkorb, stelleListeWiederHer, stelleNotizWiederHer } from '../db/aktionen';
import { useZustand } from '../db/speicher';
import { pfadText } from '../logik/listen';
import { papierkorbInhalt, resttage } from '../logik/papierkorb';
import { BestaetigungsDialog, Kopfzeile } from './Bausteine';
import { anzahlText } from './Gedankenwelt';

function restText(geloescht: string, jetzt: Date): string {
  const tage = resttage(geloescht, jetzt);
  return tage === 1 ? 'noch 1 Tag' : `noch ${tage} Tage`;
}

export function Papierkorb() {
  const z = useZustand();
  const inhalt = useMemo(() => papierkorbInhalt(z.listen, z.notizen.values()), [z]);
  const [leeren, setLeeren] = useState(false);
  const jetzt = new Date();
  const istLeer = inhalt.listen.length === 0 && inhalt.notizen.length === 0;

  return (
    <div className="seite">
      <Kopfzeile
        zurueck={{ seite: 'einstellungen' }}
        titel={<h1>Papierkorb</h1>}
        rechts={
          !istLeer && (
            <button className="knopf gefahr" onClick={() => setLeeren(true)}>
              Leeren
            </button>
          )
        }
      />

      {istLeer && <p className="hinweis leer">Der Papierkorb ist leer.</p>}

      {inhalt.listen.length > 0 && (
        <section className="karte">
          <div className="etikett">Listen</div>
          {inhalt.listen.map(({ liste, anzahlNotizen }) => (
            <div key={liste.id} className="korbzeile">
              <div>
                <div>{liste.name}</div>
                <div className="mono meta">
                  {anzahlText(anzahlNotizen)} · {restText(liste.geloescht!, jetzt)}
                </div>
              </div>
              <button className="knopf" onClick={() => stelleListeWiederHer(liste.id)}>
                Wiederherstellen
              </button>
            </div>
          ))}
        </section>
      )}

      {inhalt.notizen.length > 0 && (
        <section className="karte">
          <div className="etikett">Notizen</div>
          {inhalt.notizen.map((notiz) => (
            <div key={notiz.id} className="korbzeile">
              <div>
                <div className="korbtext">{notiz.text}</div>
                <div className="mono meta">
                  {pfadText(notiz.liste_id, z.listen) || 'Eingang'} · {restText(notiz.geloescht!, jetzt)}
                </div>
              </div>
              <button className="knopf" onClick={() => stelleNotizWiederHer(notiz.id)}>
                Wiederherstellen
              </button>
            </div>
          ))}
        </section>
      )}

      {leeren && (
        <BestaetigungsDialog
          titel="Papierkorb leeren"
          text="Alles im Papierkorb endgültig löschen? Das lässt sich nicht rückgängig machen."
          knopf="Endgültig löschen"
          onFertig={(ja) => {
            setLeeren(false);
            if (ja) leerePapierkorb();
          }}
        />
      )}
    </div>
  );
}
