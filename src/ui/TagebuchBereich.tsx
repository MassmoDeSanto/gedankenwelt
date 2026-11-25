/**
 * Einstellungen → Tagebuch: Gewohnheiten anlegen, umbenennen, sortieren, (de)aktivieren
 * und die Liste der Schreibimpulse bearbeiten (KONZEPT.md, Abschnitte 13.3 und 13.4).
 */
import { useState } from 'react';
import {
  aendereGewohnheit,
  erstelleGewohnheit,
  gewohnheitenSortiert,
  setzeImpulse,
  setzeSchreibErinnerung,
  verschiebeGewohnheit,
} from '../db/aktionen';
import { erinnerungenAktiv } from '../db/abgleichDienst';
import { useZustand } from '../db/speicher';
import { STANDARD_IMPULSE, fragenAusText } from '../logik/impulse';
import type { Gewohnheit } from '../modell/typen';
import { Segment, klassen } from './Bausteine';

export function TagebuchBereich() {
  useZustand(); // neu zeichnen, wenn sich Gewohnheiten oder Impulse ändern
  const reihe = gewohnheitenSortiert();
  const [neu, setNeu] = useState('');

  return (
    <section className="karte">
      <div className="etikett">Tagebuch</div>

      <div className="einstellung-titel">Gewohnheiten</div>
      <p className="hinweis klein">
        Erscheinen auf jeder Tagesseite zum Abhaken. Deaktivierte verschwinden dort, ihre bisherigen Häkchen bleiben.
      </p>
      <div className="tb-gewohnheiten-liste">
        {reihe.map((g, i) => (
          <GewohnheitZeile key={g.id} gewohnheit={g} erste={i === 0} letzte={i === reihe.length - 1} />
        ))}
      </div>
      <form
        className="tb-gewohnheit-neu"
        onSubmit={(e) => {
          e.preventDefault();
          erstelleGewohnheit(neu);
          setNeu('');
        }}
      >
        <input
          className="eingabe"
          placeholder="Neue Gewohnheit, z. B. Sport"
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          aria-label="Neue Gewohnheit"
        />
        <button className="knopf" type="submit" disabled={!neu.trim()}>
          Anlegen
        </button>
      </form>

      <Impulse />
      <SchreibErinnerungEinstellung />
    </section>
  );
}

/** Tägliche Schreib-Erinnerung über den Kalender „Gedankenwelt“. */
function SchreibErinnerungEinstellung() {
  const z = useZustand();
  const se = z.schreiberinnerung;
  const an = se?.an ?? false;
  const uhrzeit = se?.uhrzeit ?? '21:00';
  return (
    <>
      <div className="einstellung">
        <span className="einstellung-titel">Schreib-Erinnerung</span>
        <Segment
          wert={an ? 'an' : 'aus'}
          onWahl={(w) => setzeSchreibErinnerung({ an: w === 'an' })}
          optionen={[
            { wert: 'aus', text: 'Aus' },
            { wert: 'an', text: 'An' },
          ]}
        />
      </div>
      {an && (
        <div className="einstellung">
          <span>Uhrzeit</span>
          <input
            className="eingabe tb-uhrzeit"
            type="time"
            aria-label="Uhrzeit der Schreib-Erinnerung"
            value={uhrzeit}
            onChange={(e) => e.target.value && setzeSchreibErinnerung({ uhrzeit: e.target.value })}
          />
        </div>
      )}
      <p className="hinweis klein">
        Ein täglicher Termin „Tagebuch schreiben“ im Kalender „Gedankenwelt“; die Mitteilung kommt über die
        Kalender-App.
        {an && !erinnerungenAktiv() && ' Wirkt erst, wenn unten die Erinnerungen eingeschaltet sind.'}
      </p>
    </>
  );
}

function GewohnheitZeile({ gewohnheit: g, erste, letzte }: { gewohnheit: Gewohnheit; erste: boolean; letzte: boolean }) {
  const [name, setName] = useState(g.name);
  const [bearbeitet, setBearbeitet] = useState(false);
  if (!bearbeitet && name !== g.name) setName(g.name);
  const speichere = () => {
    setBearbeitet(false);
    if (name.trim() && name.trim() !== g.name) aendereGewohnheit(g.id, { name });
    else setName(g.name);
  };

  return (
    <div className={klassen('tb-gewohnheit-einstellung', !g.aktiv && 'inaktiv')}>
      <input
        className="tb-gewohnheit-name"
        value={name}
        aria-label={`Name der Gewohnheit ${g.name}`}
        onFocus={() => setBearbeitet(true)}
        onChange={(e) => setName(e.target.value)}
        onBlur={speichere}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setName(g.name);
            setBearbeitet(false);
            e.currentTarget.blur();
          }
        }}
      />
      <button
        className="symbolknopf klein"
        disabled={erste}
        onClick={() => verschiebeGewohnheit(g.id, -1)}
        aria-label={`${g.name} nach oben`}
        title="Nach oben"
      >
        ↑
      </button>
      <button
        className="symbolknopf klein"
        disabled={letzte}
        onClick={() => verschiebeGewohnheit(g.id, 1)}
        aria-label={`${g.name} nach unten`}
        title="Nach unten"
      >
        ↓
      </button>
      <button className="textknopf" onClick={() => aendereGewohnheit(g.id, { aktiv: !g.aktiv })}>
        {g.aktiv ? 'Deaktivieren' : 'Aktivieren'}
      </button>
    </div>
  );
}

/** Schreibimpulse: eine Frage pro Zeile. Gespeichert wird beim Verlassen des Feldes. */
function Impulse() {
  const z = useZustand();
  const fragen = z.impulse?.fragen ?? STANDARD_IMPULSE;
  const [text, setText] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);
  const eigene = z.impulse !== null;

  return (
    <>
      <div className="einstellung">
        <span>
          <span className="einstellung-titel">Schreibimpulse</span>
          <span className="mono meta">
            {' '}
            {fragen.length} Fragen{eigene ? ' · eigene Liste' : ''}
          </span>
        </span>
        <button className="textknopf" onClick={() => setOffen(!offen)}>
          {offen ? 'Schließen' : 'Bearbeiten'}
        </button>
      </div>
      {offen && (
        <>
          <p className="hinweis klein">
            Eine Frage pro Zeile. Jeden Tag erscheint eine davon über dem leeren Schreibfeld.
          </p>
          <textarea
            className="tb-impulse-feld"
            rows={12}
            aria-label="Schreibimpulse, eine Frage pro Zeile"
            value={text ?? fragen.join('\n')}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (text === null) return;
              const neu = fragenAusText(text);
              if (neu.join('\n') !== fragen.join('\n')) setzeImpulse(neu);
              setText(null);
            }}
          />
          {eigene && fragen.join('\n') !== STANDARD_IMPULSE.join('\n') && (
            <button className="textknopf" onClick={() => setzeImpulse([...STANDARD_IMPULSE])}>
              Eingebaute Fragen wiederherstellen
            </button>
          )}
        </>
      )}
    </>
  );
}
