/**
 * Zeigt in den Einstellungen, ob der Browser die Daten dauerhaft aufbewahrt und wie viel
 * Platz sie brauchen (PHASE-6.md, Abschnitt 1: „Browser verweigert dauerhaften Speicher“).
 */
import { useEffect, useState } from 'react';
import { leseAutoSicherung, useZustand, type AutoSicherung } from '../db/speicher';
import { lokalesDatum } from '../logik/zeit';

interface Stand {
  /** null = Browser kann es nicht sagen */
  dauerhaft: boolean | null;
  belegtMb: number | null;
  freiMb: number | null;
}

async function leseStand(): Promise<Stand> {
  const s = navigator.storage;
  const dauerhaft = s?.persisted ? await s.persisted().catch(() => null) : null;
  const schaetzung = s?.estimate ? await s.estimate().catch(() => null) : null;
  const mb = (bytes: number | undefined) => (bytes === undefined ? null : bytes / 1024 / 1024);
  return {
    dauerhaft,
    belegtMb: mb(schaetzung?.usage),
    freiMb: schaetzung?.quota !== undefined ? mb(schaetzung.quota - (schaetzung.usage ?? 0)) : null,
  };
}

/** „0,1 MB“, „250 MB“, „2,9 GB“ */
const groesse = (mb: number) =>
  mb >= 1024
    ? `${(mb / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`
    : `${mb.toLocaleString('de-DE', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;

export function SpeicherStand({ verbunden }: { verbunden: boolean }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [abgelehnt, setAbgelehnt] = useState(false);

  useEffect(() => {
    void leseStand().then(setStand);
  }, []);

  if (!stand) return null;
  const platz =
    stand.belegtMb !== null
      ? ` Belegt: ${groesse(stand.belegtMb)}${stand.freiMb !== null ? `, frei: etwa ${groesse(stand.freiMb)}` : ''}.`
      : '';
  const erklaerung =
    stand.dauerhaft === true
      ? 'Der Browser bewahrt die Daten dauerhaft auf und löscht sie nicht von sich aus.'
      : stand.dauerhaft === false
        ? 'Der Browser darf die Daten bei Platzmangel von sich aus löschen. ' +
          (verbunden
            ? 'Da alles auch in Google Drive liegt, geht dabei nichts verloren.'
            : 'Exportiere darum regelmäßig als ZIP oder verbinde Google Drive. Als installierte App erlaubt Chrome dauerhaften Speicher meist.')
        : 'Der Browser sagt nicht, ob er die Daten dauerhaft aufbewahrt.';

  return (
    <div className="einstellung">
      <span>
        Speicher auf diesem Gerät
        <span className={`hinweis klein${stand.dauerhaft === false && !verbunden ? ' warnung' : ''}`}>
          {erklaerung}
          {platz}
          {abgelehnt && ' Der Browser hat die Bitte abgelehnt.'}
        </span>
      </span>
      {stand.dauerhaft === false && (
        <button
          className="knopf"
          onClick={async () => {
            const ok = await navigator.storage.persist().catch(() => false);
            setAbgelehnt(!ok);
            setStand(await leseStand());
          }}
        >
          Dauerhaft erlauben
        </button>
      )}
    </div>
  );
}

/** Die letzte automatische Sicherung (vor ZIP-Import oder „Neu aus Drive laden“) zum Herunterladen. */
export function AutoSicherungZeile() {
  const [sicherung, setSicherung] = useState<AutoSicherung | null>(null);
  const z = useZustand();

  // Nach einem Import oder Neuladen ist der Bestand neu – dann auch die Sicherung neu lesen.
  useEffect(() => {
    void leseAutoSicherung().then(setSicherung);
  }, [z.listen]);

  if (!sicherung) return null;
  const zeit = new Date(sicherung.zeit);
  return (
    <div className="einstellung">
      <span>
        Automatische Sicherung
        <span className="hinweis klein">
          Stand vom {zeit.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}, {sicherung.anlass}.
        </span>
      </span>
      <button
        className="knopf"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([sicherung.zip as BlobPart], { type: 'application/zip' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = `gedankenwelt-sicherung-${lokalesDatum(zeit)}.zip`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }}
      >
        Herunterladen
      </button>
    </div>
  );
}
