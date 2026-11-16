/**
 * Das echte Google Drive, angesprochen über Googles Web-Schnittstelle (Drive API v3).
 *
 * Diese Datei übersetzt nur: Sie erfüllt dieselbe Schnittstelle `Drive` wie das
 * simulierte Drive aus den Tests. Die ganze Abgleich-Logik steckt in src/logik/abgleich/.
 *
 * Mit der Berechtigung „drive.file“ sieht die App ausschließlich Dateien und Ordner,
 * die sie selbst angelegt hat.
 */
import {
  KeineVerbindung,
  NichtAngemeldet,
  VersionsKonflikt,
  type Drive,
  type DriveEintrag,
} from '../logik/abgleich/drive';
import { META_DATEI } from '../logik/markdown';
import { jetztStempel } from '../logik/zeit';

const API = 'https://www.googleapis.com/drive/v3';
const HOCHLADEN = 'https://www.googleapis.com/upload/drive/v3';
const ORDNER_TYP = 'application/vnd.google-apps.folder';
const FELDER = 'id,name,mimeType,parents,version,modifiedTime';
export const WURZEL_NAME = 'Gedankenwelt';

/** Ein Fehler, den Drive gemeldet hat – mit einer Erklärung auf Deutsch. */
export class DriveFehler extends Error {
  constructor(
    public status: number,
    meldung: string,
  ) {
    super(meldung);
    this.name = 'DriveFehler';
  }
}

interface DriveDatei {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  version?: string;
  modifiedTime?: string;
}

function alsEintrag(d: DriveDatei): DriveEintrag {
  return {
    id: d.id,
    name: d.name,
    eltern: d.parents?.[0] ?? '',
    ordner: d.mimeType === ORDNER_TYP,
    version: d.version ?? '',
    geaendert: d.modifiedTime ? jetztStempel(new Date(d.modifiedTime)) : jetztStempel(),
  };
}

function erklaere(status: number, grund: string): string {
  if (status === 403 && /storageQuota/i.test(grund)) return 'Dein Google Drive ist voll.';
  if (status === 403 && /rateLimit/i.test(grund)) return 'Google Drive bremst gerade (zu viele Anfragen). Es wird später erneut versucht.';
  if (status === 403) return 'Google Drive verweigert den Zugriff. Ist die Google Drive API im Cloud-Projekt eingeschaltet?';
  if (status === 404) return 'Eine Datei wurde in Google Drive nicht gefunden. Beim nächsten Abgleich wird neu eingelesen.';
  if (status >= 500) return 'Google Drive hat gerade eine Störung. Es wird später erneut versucht.';
  return `Google Drive meldet einen Fehler (${status}).`;
}

const warte = (ms: number) => new Promise((fertig) => setTimeout(fertig, ms));

export class GoogleDrive implements Drive {
  /**
   * @param holeToken liefert den aktuellen Zugangsschlüssel oder null, wenn keiner gilt
   * @param beiAbgelehnt wird aufgerufen, wenn Google den Schlüssel nicht (mehr) annimmt
   */
  constructor(
    private holeToken: () => string | null,
    private beiAbgelehnt: () => void,
  ) {}

  /** Eine Anfrage an Drive. Vorübergehende Störungen werden bis zu dreimal wiederholt. */
  private async frage(adresse: string, optionen: RequestInit = {}): Promise<Response> {
    for (let versuch = 1; ; versuch++) {
      const token = this.holeToken();
      if (!token) throw new NichtAngemeldet();

      let antwort: Response;
      try {
        antwort = await fetch(adresse, {
          ...optionen,
          headers: { ...optionen.headers, Authorization: `Bearer ${token}` },
        });
      } catch {
        throw new KeineVerbindung();
      }
      if (antwort.ok) return antwort;

      if (antwort.status === 401) {
        this.beiAbgelehnt();
        throw new NichtAngemeldet();
      }
      const text = await antwort.text().catch(() => '');
      const voruebergehend = antwort.status === 429 || antwort.status >= 500 || /rateLimit/i.test(text);
      if (voruebergehend && versuch < 3) {
        await warte(versuch * 1500);
        continue;
      }
      throw new DriveFehler(antwort.status, erklaere(antwort.status, text));
    }
  }

  private async json<T>(adresse: string, optionen?: RequestInit): Promise<T> {
    return (await this.frage(adresse, optionen)).json() as Promise<T>;
  }

  /** Alle Dateien, die die App sehen darf (seitenweise geladen). */
  private async alleDateien(): Promise<DriveDatei[]> {
    const dateien: DriveDatei[] = [];
    let seite: string | undefined;
    do {
      const parameter = new URLSearchParams({
        q: 'trashed = false',
        fields: `nextPageToken,files(${FELDER})`,
        pageSize: '1000',
        spaces: 'drive',
      });
      if (seite) parameter.set('pageToken', seite);
      const antwort = await this.json<{ files: DriveDatei[]; nextPageToken?: string }>(`${API}/files?${parameter}`);
      dateien.push(...antwort.files);
      seite = antwort.nextPageToken;
    } while (seite);
    return dateien;
  }

  async wurzel(): Promise<string> {
    const parameter = new URLSearchParams({
      q: `name = '${WURZEL_NAME}' and mimeType = '${ORDNER_TYP}' and 'root' in parents and trashed = false`,
      fields: 'files(id,createdTime)',
      orderBy: 'createdTime',
    });
    const gefunden = await this.json<{ files: { id: string }[] }>(`${API}/files?${parameter}`);
    if (gefunden.files.length > 0) return gefunden.files[0].id;

    const neu = await this.json<DriveDatei>(`${API}/files?fields=${FELDER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: WURZEL_NAME, mimeType: ORDNER_TYP, parents: ['root'] }),
    });
    return neu.id;
  }

  async liste(wurzelId: string): Promise<DriveEintrag[]> {
    const alle = (await this.alleDateien()).map(alsEintrag);
    const jeId = new Map(alle.map((e) => [e.id, e]));
    // Nur was wirklich unter dem Ordner „Gedankenwelt“ liegt
    const darunter = (e: DriveEintrag): boolean => {
      let aktuell: DriveEintrag | undefined = e;
      for (let schritte = 0; aktuell && schritte < 100; schritte++) {
        if (aktuell.eltern === wurzelId) return true;
        aktuell = jeId.get(aktuell.eltern);
      }
      return false;
    };
    return alle.filter(darunter);
  }

  async lese(id: string): Promise<string> {
    return (await this.frage(`${API}/files/${id}?alt=media`)).text();
  }

  async erstelleOrdner(name: string, eltern: string): Promise<DriveEintrag> {
    const neu = await this.json<DriveDatei>(`${API}/files?fields=${FELDER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: ORDNER_TYP, parents: [eltern] }),
    });
    return alsEintrag(neu);
  }

  async erstelleDatei(name: string, eltern: string, inhalt: string): Promise<DriveEintrag> {
    // Beschreibung (Name, Ordner) und Inhalt gehen zusammen in einer Anfrage hinauf.
    const typ = name === META_DATEI ? 'application/json' : 'text/markdown';
    const grenze = `gedankenwelt-${crypto.randomUUID()}`;
    const koerper = [
      `--${grenze}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name, parents: [eltern], mimeType: typ }),
      `--${grenze}`,
      `Content-Type: ${typ}; charset=UTF-8`,
      '',
      inhalt,
      `--${grenze}--`,
      '',
    ].join('\r\n');
    const neu = await this.json<DriveDatei>(`${HOCHLADEN}/files?uploadType=multipart&fields=${FELDER}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${grenze}` },
      body: koerper,
    });
    return alsEintrag(neu);
  }

  async schreibe(id: string, inhalt: string, erwarteteVersion: string): Promise<DriveEintrag> {
    // Erst nachsehen, ob inzwischen jemand anderes geschrieben hat. Zwischen Nachsehen und
    // Schreiben bleibt ein Sekundenbruchteil Lücke; die ältere Fassung läge dann im
    // Versionsverlauf von Google Drive.
    const aktuell = await this.json<DriveDatei>(`${API}/files/${id}?fields=${FELDER}`);
    if ((aktuell.version ?? '') !== erwarteteVersion) throw new VersionsKonflikt(aktuell.name);

    const typ = aktuell.name === META_DATEI ? 'application/json' : 'text/markdown';
    const neu = await this.json<DriveDatei>(`${HOCHLADEN}/files/${id}?uploadType=media&fields=${FELDER}`, {
      method: 'PATCH',
      headers: { 'Content-Type': `${typ}; charset=UTF-8` },
      body: inhalt,
    });
    return alsEintrag(neu);
  }

  async aendere(id: string, neu: { name?: string; eltern?: string }): Promise<DriveEintrag> {
    const parameter = new URLSearchParams({ fields: FELDER });
    if (neu.eltern !== undefined) {
      const aktuell = await this.json<DriveDatei>(`${API}/files/${id}?fields=parents`);
      const bisher = (aktuell.parents ?? []).filter((p) => p !== neu.eltern);
      if (!aktuell.parents?.includes(neu.eltern)) parameter.set('addParents', neu.eltern);
      if (bisher.length > 0) parameter.set('removeParents', bisher.join(','));
    }
    const geaendert = await this.json<DriveDatei>(`${API}/files/${id}?${parameter}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(neu.name !== undefined ? { name: neu.name } : {}),
    });
    return alsEintrag(geaendert);
  }

  async loesche(id: string): Promise<void> {
    // In den Papierkorb von Google Drive, nicht endgültig: dort 30 Tage wiederherstellbar.
    await this.frage(`${API}/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
  }
}
