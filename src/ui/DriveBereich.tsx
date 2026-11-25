/**
 * Einstellungen → Google Drive: verbinden, Abgleich einschalten, Zustand ansehen,
 * neu aus Drive laden, trennen. Unter „Diagnose“ steckt die Testseite für die Anmeldung.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  abmelden,
  anmeldenPerPopup,
  gueltigesToken,
  leereProtokoll,
  leseProtokoll,
  protokolliere,
  starteWeiterleitung,
  useAnmeldung,
  weiterleitungsAdresse,
} from '../db/anmeldung';
import {
  gleicheAb,
  istTestbetrieb,
  ladeNeuAusDrive,
  leseSicherung,
  sicherungsName,
  trenne,
  useAbgleichStatus,
  verbinde,
  zaehleBeispieldaten,
  type Sicherung,
} from '../db/abgleichDienst';
import { useZustand } from '../db/speicher';
import { vorWieLange } from './AbgleichSymbol';
import { BestaetigungsDialog } from './Bausteine';
import { mehrzahl } from '../logik/mehrzahl';

function uhrzeit(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE');
}

/** Läuft die App als installierte App (ohne Browserleiste)? */
function istInstalliert(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function pruefeDrive(): Promise<string> {
  const token = gueltigesToken();
  if (!token) return 'Kein gültiger Zugang – bitte zuerst anmelden.';
  try {
    const antwort = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id)&q=trashed%3Dfalse',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!antwort.ok) return `Drive antwortet mit Fehler ${antwort.status}.`;
    const daten = (await antwort.json()) as { files?: unknown[] };
    return `Drive-Zugriff klappt. Die App sieht ${daten.files?.length ?? 0} eigene Dateien.`;
  } catch {
    return 'Drive ist nicht erreichbar (kein Netz?).';
  }
}

function ladeHerunter(sicherung: Sicherung): void {
  const url = URL.createObjectURL(new Blob([sicherung.zip as BlobPart], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = sicherungsName(sicherung);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function DriveBereich() {
  const anmeldung = useAnmeldung();
  const abgleich = useAbgleichStatus();
  const [arbeitet, setArbeitet] = useState(false);
  const [dialog, setDialog] = useState<'neuLaden' | 'trennen' | null>(null);
  const [sicherung, setSicherung] = useState<Sicherung | null>(null);

  const test = istTestbetrieb();
  const eingerichtet = anmeldung.status !== 'nicht-eingerichtet' || test;
  const verbunden = abgleich.zustand !== 'aus';
  const angemeldet = anmeldung.status === 'angemeldet' || test;
  const protokoll = leseProtokoll();

  useEffect(() => {
    void leseSicherung().then(setSicherung);
  }, [verbunden]);

  const mitProtokoll = async (aktion: () => Promise<string>) => {
    setArbeitet(true);
    try {
      protokolliere(await aktion());
    } catch (fehler) {
      protokolliere(fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.');
    } finally {
      setArbeitet(false);
    }
  };

  const schalteEin = async (beispieldatenLoeschen: boolean) => {
    setArbeitet(true);
    try {
      await verbinde(beispieldatenLoeschen);
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <section className="karte">
      <div className="etikett">Google Drive</div>

      {!eingerichtet && (
        <p className="hinweis">
          Noch nicht eingerichtet: Es ist keine Google-Client-ID eingetragen. Wie du sie bekommst, steht in der README
          im Abschnitt „Google Cloud einrichten“.
        </p>
      )}

      {/* ── Schritt 1: bei Google anmelden ── */}
      {eingerichtet && !verbunden && !angemeldet && (
        <div className="einstellung">
          <span>
            Nicht verbunden
            <span className="hinweis klein">
              Verbinde die App mit deinem Google Drive, damit Laptop und iPhone denselben Stand haben. Die App sieht
              dort nur Dateien, die sie selbst anlegt.
            </span>
          </span>
          <button className="knopf haupt" onClick={() => starteWeiterleitung(false)}>
            Mit Google verbinden
          </button>
        </div>
      )}

      {/* ── Schritt 2: Abgleich einschalten (einmal pro Gerät) ── */}
      {eingerichtet && !verbunden && angemeldet && <Einrichtung arbeitet={arbeitet} schalteEin={schalteEin} />}

      {/* ── Verbunden ── */}
      {verbunden && (
        <>
          <div className="einstellung">
            <span>
              {anmeldung.konto ?? (test ? 'Simuliertes Drive (nur zum Testen)' : 'Verbunden')}
              <span className="hinweis klein">
                {abgleich.meldung} Letzter Abgleich: {vorWieLange(abgleich.letzterAbgleich)}.
              </span>
            </span>
            {abgleich.zustand === 'anmeldung' ? (
              <button className="knopf haupt" onClick={() => starteWeiterleitung(false)}>
                Neu anmelden
              </button>
            ) : (
              <button className="knopf" disabled={abgleich.zustand === 'laeuft'} onClick={() => void gleicheAb('hand')}>
                Jetzt abgleichen
              </button>
            )}
          </div>
          <div className="einstellung">
            <span>
              Lokale Daten neu aus Drive laden
              <span className="hinweis klein">
                Baut den Speicher dieses Geräts komplett aus den Dateien in Drive neu auf.
              </span>
            </span>
            <button className="knopf" onClick={() => setDialog('neuLaden')}>
              Neu laden
            </button>
          </div>
          {sicherung && (
            <div className="einstellung">
              <span>
                Sicherung vom ersten Verbinden
                <span className="hinweis klein">
                  Stand dieses Geräts vom {new Date(sicherung.zeit).toLocaleDateString('de-DE')}, kurz vor dem ersten
                  Abgleich.
                </span>
              </span>
              <button className="knopf" onClick={() => ladeHerunter(sicherung)}>
                Herunterladen
              </button>
            </div>
          )}
          <div className="einstellung">
            <span>
              Verbindung trennen
              <span className="hinweis klein">Die Daten bleiben auf diesem Gerät und in Drive erhalten.</span>
            </span>
            <button className="knopf gefahr" onClick={() => setDialog('trennen')}>
              Trennen
            </button>
          </div>
        </>
      )}

      {/* ── Testseite für die Anmeldung ── */}
      {eingerichtet && !test && (
        <details className="diagnose">
          <summary>Diagnose: Anmeldung testen</summary>
          <div className="knopfreihe">
            <button className="knopf" onClick={() => starteWeiterleitung(false)}>
              Anmelden (Weiterleitung)
            </button>
            <button className="knopf" disabled={!anmeldung.konto} onClick={() => starteWeiterleitung(true)}>
              Still erneuern
            </button>
            <button className="knopf" disabled={arbeitet} onClick={() => mitProtokoll(() => anmeldenPerPopup())}>
              Per Pop-up anmelden
            </button>
            <button className="knopf" disabled={arbeitet} onClick={() => mitProtokoll(pruefeDrive)}>
              Drive-Zugriff prüfen
            </button>
            {!verbunden && (
              <button
                className="knopf gefahr"
                onClick={() => {
                  abmelden();
                  protokolliere('Abgemeldet.');
                }}
              >
                Abmelden
              </button>
            )}
          </div>
          <p className="hinweis klein">
            Zugang:{' '}
            {anmeldung.gueltigBis
              ? `${anmeldung.gueltigBis > Date.now() ? 'gültig bis' : 'abgelaufen seit'} ${uhrzeit(anmeldung.gueltigBis)}`
              : 'keiner'}{' '}
            · Läuft als installierte App: {istInstalliert() ? 'ja' : 'nein'} · Adresse für die Google Cloud:{' '}
            <span className="mono">{weiterleitungsAdresse()}</span>
          </p>
          {protokoll.length > 0 && (
            <div className="protokoll mono">
              {protokoll.map((eintrag, i) => (
                <div key={i}>
                  <span className="meta">{uhrzeit(eintrag.zeit)}</span> {eintrag.text}
                </div>
              ))}
              <button className="textknopf" onClick={leereProtokoll}>
                Protokoll leeren
              </button>
            </div>
          )}
        </details>
      )}

      {dialog === 'neuLaden' && (
        <BestaetigungsDialog
          titel="Lokale Daten neu aus Drive laden"
          text={
            abgleich.offen > 0
              ? `Achtung: ${abgleich.offen} Änderungen auf diesem Gerät sind noch nicht in Drive angekommen und gingen dabei verloren. Gleiche besser zuerst ab. Trotzdem alles auf diesem Gerät verwerfen und neu aus Drive laden?`
              : 'Alles auf diesem Gerät verwerfen und komplett neu aus Google Drive laden? In Drive ändert sich dadurch nichts.'
          }
          knopf="Neu aus Drive laden"
          onFertig={(ja) => {
            setDialog(null);
            if (ja) void ladeNeuAusDrive();
          }}
        />
      )}
      {dialog === 'trennen' && (
        <BestaetigungsDialog
          titel="Verbindung trennen"
          text="Den Abgleich auf diesem Gerät ausschalten und von Google abmelden? Deine Notizen bleiben hier und in Drive erhalten. Du kannst dich später wieder verbinden; dann wird zusammengeführt."
          knopf="Trennen"
          onFertig={(ja) => {
            setDialog(null);
            if (ja) void trenne();
          }}
        />
      )}
    </section>
  );
}

/** Einmal pro Gerät: Abgleich einschalten – mit der Frage nach den Beispieldaten aus Phase 1. */
function Einrichtung({
  arbeitet,
  schalteEin,
}: {
  arbeitet: boolean;
  schalteEin: (beispieldatenLoeschen: boolean) => void;
}) {
  const z = useZustand();
  const beispiele = useMemo(zaehleBeispieldaten, [z]);
  const hatBeispiele = beispiele.listen + beispiele.notizen > 0;

  return (
    <div className="einrichtung">
      <strong>Abgleich einschalten</strong>
      <ul>
        <li>Zuerst wird der Stand dieses Geräts automatisch als ZIP gesichert.</li>
        <li>Ist dein Drive noch leer, wird dieser Stand hochgeladen (Ordner „Gedankenwelt“).</li>
        <li>Liegen dort schon Daten, wird zusammengeführt: Pro Notiz gilt die neuere Fassung.</li>
      </ul>
      {hatBeispiele ? (
        <>
          <p>
            Auf diesem Gerät liegen noch Beispieldaten ({mehrzahl(beispiele.notizen, 'Notiz', 'Notizen')},{' '}
            {mehrzahl(beispiele.listen, 'Liste', 'Listen')}). Sollen sie vorher gelöscht werden, damit sie nicht in dein Drive wandern?
          </p>
          <div className="knopfreihe">
            <button className="knopf haupt" disabled={arbeitet} onClick={() => schalteEin(true)}>
              Beispieldaten löschen und einschalten
            </button>
            <button className="knopf" disabled={arbeitet} onClick={() => schalteEin(false)}>
              Behalten und einschalten
            </button>
          </div>
        </>
      ) : (
        <div className="knopfreihe">
          <button className="knopf haupt" disabled={arbeitet} onClick={() => schalteEin(false)}>
            Abgleich einschalten
          </button>
        </div>
      )}
    </div>
  );
}
