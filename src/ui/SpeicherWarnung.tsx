/**
 * Warnung oben auf jeder Seite, wenn das Speichern im Browser fehlgeschlagen ist
 * (PHASE-6.md, Abschnitt 1). Sie bleibt, bis „Erneut speichern“ geklappt hat.
 */
import { useState } from 'react';
import { speichereAllesErneut, useSpeicherProblem } from '../db/speicher';
import { ladeZipHerunter } from './download';

export function SpeicherWarnung() {
  const problem = useSpeicherProblem();
  const [laeuft, setLaeuft] = useState(false);
  if (!problem) return null;
  return (
    <div className="speicher-warnung" role="alert">
      <p>{problem}</p>
      <div className="knopfreihe">
        <button className="knopf" onClick={ladeZipHerunter}>
          Als ZIP sichern
        </button>
        <button
          className="knopf haupt"
          disabled={laeuft}
          onClick={async () => {
            setLaeuft(true);
            await speichereAllesErneut();
            setLaeuft(false);
          }}
        >
          Erneut speichern
        </button>
      </div>
    </div>
  );
}
