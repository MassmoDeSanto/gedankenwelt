/** Einstellungen: Hell/Dunkel, Papierkorb, Export/Import als ZIP, Beispieldaten. */
import { useRef, useState } from 'react';
import { exportiereZip, importiereZip, ladeBeispieldaten, loescheAlles, setzeThema } from '../db/aktionen';
import { useAbgleichStatus } from '../db/abgleichDienst';
import { useZustand } from '../db/speicher';
import { lokalesDatum } from '../logik/zeit';
import { BestaetigungsDialog, Kopfzeile, Segment } from './Bausteine';
import { DriveBereich } from './DriveBereich';
import { ErinnerungenBereich } from './ErinnerungenBereich';
import { adresse } from './router';

export function Einstellungen() {
  const z = useZustand();
  const verbunden = useAbgleichStatus().zustand !== 'aus';
  const dateiwahl = useRef<HTMLInputElement>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [importDatei, setImportDatei] = useState<File | null>(null);
  const [allesLoeschen, setAllesLoeschen] = useState(false);

  const imPapierkorb =
    [...z.notizen.values()].filter((n) => n.geloescht).length + [...z.listen.values()].filter((l) => l.geloescht).length;

  const exportiere = () => {
    // Die ZIP-Datei wird im Browser erzeugt und wie ein normaler Download gespeichert.
    const url = URL.createObjectURL(new Blob([exportiereZip() as BlobPart], { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `gedankenwelt-${lokalesDatum()}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMeldung('Export gespeichert. Die Datei liegt in deinem Download-Ordner.');
  };

  const importiere = async (datei: File) => {
    try {
      const ergebnis = await importiereZip(new Uint8Array(await datei.arrayBuffer()));
      setMeldung(`Import fertig: ${ergebnis.listen} Listen und ${ergebnis.notizen} Notizen.`);
    } catch (fehler) {
      setMeldung(`Import fehlgeschlagen: ${fehler instanceof Error ? fehler.message : 'Die Datei ließ sich nicht lesen.'}`);
    }
  };

  return (
    <div className="seite">
      <Kopfzeile zurueck={{ seite: 'start' }} titel={<h1>Einstellungen</h1>} />

      <section className="karte">
        <div className="etikett">Darstellung</div>
        <div className="einstellung">
          <span>Farbschema</span>
          <Segment
            wert={z.einstellungen.thema}
            onWahl={setzeThema}
            optionen={[
              { wert: 'dunkel', text: 'Dunkel' },
              { wert: 'hell', text: 'Hell' },
            ]}
          />
        </div>
      </section>

      <DriveBereich />
      <ErinnerungenBereich />

      <section className="karte">
        <div className="etikett">Papierkorb</div>
        <a className="einstellung link" href={adresse({ seite: 'papierkorb' })}>
          <span>Papierkorb öffnen</span>
          <span className="mono meta">{imPapierkorb === 0 ? 'leer' : `${imPapierkorb} Einträge`}</span>
        </a>
        <p className="hinweis klein">Gelöschtes bleibt 30 Tage und lässt sich so lange wiederherstellen.</p>
      </section>

      <section className="karte">
        <div className="etikett">Daten</div>
        <div className="einstellung">
          <span>
            Export als ZIP
            <span className="hinweis klein">Alle Listen als lesbare Markdown-Dateien.</span>
          </span>
          <button className="knopf" onClick={exportiere}>
            Exportieren
          </button>
        </div>
        <div className="einstellung">
          <span>
            Import aus ZIP
            <span className="hinweis klein">
              {verbunden
                ? 'Ersetzt die Daten auf diesem Gerät; beim nächsten Abgleich wird mit Drive zusammengeführt.'
                : 'Ersetzt alle Daten in der App durch den Inhalt der Datei.'}
            </span>
          </span>
          <button className="knopf" onClick={() => dateiwahl.current?.click()}>
            Datei wählen
          </button>
          <input
            ref={dateiwahl}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              setImportDatei(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </div>
        <div className="einstellung">
          <span>
            Beispieldaten laden
            <span className="hinweis klein">Fügt einige Listen, Tags und Aufgaben zum Ausprobieren hinzu.</span>
          </span>
          <button
            className="knopf"
            onClick={() => {
              ladeBeispieldaten();
              setMeldung('Beispieldaten geladen. Du findest sie in der Gedankenwelt.');
            }}
          >
            Laden
          </button>
        </div>
        {!verbunden && (
          <div className="einstellung">
            <span>
              Alle Daten löschen
              <span className="hinweis klein">Leert die App vollständig, auch den Papierkorb.</span>
            </span>
            <button className="knopf gefahr" onClick={() => setAllesLoeschen(true)}>
              Löschen
            </button>
          </div>
        )}
        {meldung && (
          <p className="meldung" role="status">
            {meldung}
          </p>
        )}
      </section>

      <p className="hinweis klein mitte">
        {verbunden
          ? 'Deine Notizen liegen auf diesem Gerät und als Markdown-Dateien in deinem Google Drive.'
          : 'Ohne Google Drive liegen alle Daten nur in diesem Browser.'}{' '}
        Erinnerungen und der Import aus Apple Notizen folgen in den nächsten Phasen.
      </p>

      {importDatei && (
        <BestaetigungsDialog
          titel="Import aus ZIP"
          text={`„${importDatei.name}“ importieren? Alle Daten, die jetzt in der App sind, werden dadurch ersetzt. Mach vorher einen Export, wenn du sie behalten willst.`}
          knopf="Ersetzen und importieren"
          onFertig={(ja) => {
            const datei = importDatei;
            setImportDatei(null);
            if (ja) void importiere(datei);
          }}
        />
      )}
      {allesLoeschen && (
        <BestaetigungsDialog
          titel="Alle Daten löschen"
          text="Wirklich alle Listen und Notizen endgültig löschen? Das lässt sich nicht rückgängig machen."
          knopf="Alles löschen"
          onFertig={(ja) => {
            setAllesLoeschen(false);
            if (ja) void loescheAlles().then(() => setMeldung('Alle Daten wurden gelöscht.'));
          }}
        />
      )}
    </div>
  );
}
