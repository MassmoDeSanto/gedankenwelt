/**
 * Einstellungen → Import aus Apple Notizen: Einstieg in den Import, der Import-Verlauf mit
 * „Rückgängig“ und die Sicherung von vor dem letzten Import (PHASE-4.md, Abschnitt 6).
 */
import { useEffect, useState } from 'react';
import {
  importSicherungsName,
  leseImportSicherung,
  macheRueckgaengig,
  pruefeRueckgaengig,
  type ImportSicherung,
} from '../db/importAktionen';
import { useZustand } from '../db/speicher';
import { WEG_NAME, type RueckgaengigPlan } from '../logik/import/plan';
import { formatStempel } from '../logik/zeit';
import type { ImportEintrag } from '../modell/typen';
import { BestaetigungsDialog } from './Bausteine';
import { adresse } from './router';

function mehrzahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

/** Uhrzeit eines Zeitstempels in Ortszeit, z. B. „08:04“ – damit sich mehrere Importe eines Tages unterscheiden lassen. */
function uhrzeit(stempel: string): string {
  return new Date(stempel).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function ladeHerunter(sicherung: ImportSicherung): void {
  const url = URL.createObjectURL(new Blob([sicherung.zip as BlobPart], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = importSicherungsName(sicherung);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function frageText(plan: RueckgaengigPlan): string {
  const teile = [
    `${mehrzahl(plan.notizen.length, 'Notiz', 'Notizen')} und ${mehrzahl(plan.listen.length, 'Liste', 'Listen')} aus diesem Import wandern in den Papierkorb. Dort bleiben sie 30 Tage wiederherstellbar.`,
  ];
  if (plan.bearbeitet > 0) {
    teile.push(
      plan.bearbeitet === 1
        ? '1 davon hast du seit dem Import bearbeitet – auch sie wandert in den Papierkorb.'
        : `${plan.bearbeitet} davon hast du seit dem Import bearbeitet – auch sie wandern in den Papierkorb.`,
    );
  }
  if (plan.behalten > 0) {
    teile.push(
      plan.behalten === 1
        ? '1 importierte Liste bleibt stehen, weil du dort inzwischen Eigenes ergänzt hast.'
        : `${plan.behalten} importierte Listen bleiben stehen, weil du dort inzwischen Eigenes ergänzt hast.`,
    );
  }
  return teile.join(' ');
}

export function ImportBereich() {
  const z = useZustand();
  const [sicherung, setSicherung] = useState<ImportSicherung | null>(null);
  const [frage, setFrage] = useState<{ eintrag: ImportEintrag; plan: RueckgaengigPlan } | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const verlauf = [...z.importe].sort((a, b) => (a.datum < b.datum ? 1 : -1));

  useEffect(() => {
    void leseImportSicherung().then(setSicherung);
  }, [z.importe]);

  return (
    <section className="karte">
      <div className="etikett">Import aus Apple Notizen</div>
      <a className="einstellung link" href={adresse({ seite: 'import' })}>
        <span>
          Notizen importieren
          <span className="hinweis klein">Einmaliger Umzug: per Kurzbefehl, als Markdown oder durch Einfügen.</span>
        </span>
        <span className="mono meta">öffnen</span>
      </a>

      {verlauf.length > 0 && (
        <>
          <div className="etikett import-verlauf-titel">Import-Verlauf</div>
          {verlauf.map((eintrag) => (
            <div key={eintrag.id} className="einstellung">
              <span>
                {formatStempel(eintrag.datum)}, {uhrzeit(eintrag.datum)} · {WEG_NAME[eintrag.weg]}
                <span className="hinweis klein">
                  {mehrzahl(eintrag.dateien, 'Datei', 'Dateien')} · {mehrzahl(eintrag.listen, 'Liste', 'Listen')} ·{' '}
                  {mehrzahl(eintrag.notizen, 'Notiz', 'Notizen')}
                  {eintrag.rueckgaengig && ` · rückgängig gemacht am ${formatStempel(eintrag.rueckgaengig)}`}
                </span>
              </span>
              {!eintrag.rueckgaengig && (
                <button
                  className="knopf"
                  onClick={() => {
                    const plan = pruefeRueckgaengig(eintrag.id);
                    if (plan) setFrage({ eintrag, plan });
                  }}
                >
                  Rückgängig
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {sicherung && (
        <div className="einstellung">
          <span>
            Sicherung vor dem letzten Import
            <span className="hinweis klein">
              Stand dieses Geräts vom {new Date(sicherung.zeit).toLocaleDateString('de-DE')}, unmittelbar vor dem Import. Als ZIP,
              wie beim Export.
            </span>
          </span>
          <button className="knopf" onClick={() => ladeHerunter(sicherung)}>
            Herunterladen
          </button>
        </div>
      )}

      {meldung && (
        <p className="meldung" role="status">
          {meldung}
        </p>
      )}

      {frage && (
        <BestaetigungsDialog
          titel="Import rückgängig machen"
          text={frageText(frage.plan)}
          knopf="In den Papierkorb"
          onFertig={(ja) => {
            if (ja) {
              macheRueckgaengig(frage.eintrag.id);
              setMeldung('Der Import ist rückgängig gemacht. Alles daraus liegt im Papierkorb.');
            }
            setFrage(null);
          }}
        />
      )}
    </section>
  );
}
