/**
 * Verständliche deutsche Meldungen, wenn der Browser-Speicher (IndexedDB) streikt
 * (PHASE-6.md, Abschnitt 1). Reine Logik: bekommt den Fehler, liefert den Text.
 *
 * Fehler kommen vom Browser („DOMException“) oder von Dexie, das sie manchmal einpackt
 * (`inner`). Erkannt wird darum am Namen, auch eine Ebene tiefer.
 */

export type SpeicherFehlerArt =
  /** Speicher voll (Gerät oder Browser-Kontingent) */
  | 'voll'
  /** Die Datenbank auf diesem Gerät ist neuer als die App */
  | 'zu-neu'
  /** Der Browser erlaubt keinen Speicher (privates Fenster, Website-Daten blockiert) */
  | 'verweigert'
  | 'unbekannt';

function namenVon(fehler: unknown): string[] {
  const namen: string[] = [];
  let f: unknown = fehler;
  for (let tiefe = 0; f && typeof f === 'object' && tiefe < 3; tiefe++) {
    const name = (f as { name?: unknown }).name;
    if (typeof name === 'string') namen.push(name);
    f = (f as { inner?: unknown }).inner;
  }
  return namen;
}

export function speicherFehlerArt(fehler: unknown): SpeicherFehlerArt {
  const namen = namenVon(fehler);
  if (namen.includes('QuotaExceededError')) return 'voll';
  if (namen.includes('VersionError')) return 'zu-neu';
  if (namen.some((n) => n === 'MissingAPIError' || n === 'SecurityError' || n === 'InvalidStateError')) return 'verweigert';
  return 'unbekannt';
}

/** Meldung, wenn eine Änderung nicht gespeichert werden konnte. */
export function schreibFehlerText(fehler: unknown): string {
  const ursache: Record<SpeicherFehlerArt, string> = {
    voll: 'Der Speicher auf diesem Gerät ist voll.',
    'zu-neu': 'Auf diesem Gerät läuft gerade eine neuere Version der App.',
    verweigert: 'Der Browser erlaubt der App gerade nicht, Daten zu speichern.',
    unbekannt: 'Der Browser hat das Speichern abgelehnt.',
  };
  return (
    `Speichern fehlgeschlagen: ${ursache[speicherFehlerArt(fehler)]} ` +
    'Deine Änderungen sind noch da, solange dieses Fenster offen bleibt. ' +
    'Ist Google Drive verbunden, werden sie trotzdem dorthin hochgeladen. ' +
    'Sicher sie zur Vorsicht als ZIP und tippe dann auf „Erneut speichern“.'
  );
}

/** Meldung, wenn die App beim Start ihre Daten nicht laden kann. */
export function ladeFehlerText(fehler: unknown): string {
  switch (speicherFehlerArt(fehler)) {
    case 'zu-neu':
      return (
        'Die Daten auf diesem Gerät wurden schon von einer neueren Version der App gespeichert. ' +
        'Diese ältere Version öffnet sie nicht, damit nichts beschädigt wird. ' +
        'Bitte lade die Seite neu (oder schließe die App ganz und öffne sie wieder), dann kommt die neue Version.'
      );
    case 'voll':
      return (
        'Der Speicher auf diesem Gerät ist voll, darum kann die App ihre Daten nicht öffnen. ' +
        'Bitte schaffe etwas Platz (z. B. alte Fotos oder Apps löschen) und lade die Seite dann neu. Deine Daten sind nicht gelöscht.'
      );
    case 'verweigert':
      return (
        'Der Browser lässt die App nicht auf ihren Speicher zugreifen – zum Beispiel in einem privaten Fenster, ' +
        'oder weil das Speichern von Website-Daten ausgeschaltet ist. Bitte öffne die App in einem normalen Fenster ' +
        'bzw. erlaube Website-Daten und lade die Seite neu.'
      );
    default:
      return (
        'Die Daten konnten nicht geladen werden. Bitte lade die Seite neu. ' +
        'Hilft das nicht: Ist im Browser das Speichern von Website-Daten erlaubt?'
      );
  }
}
