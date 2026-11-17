/**
 * Holt die Exportdateien aus der Dateiauswahl oder vom Ziehen-und-Ablegen und liest ihren Text.
 * Bilder und andere Dateien, die Apple neben die Markdown-Datei legt, werden übergangen und gezählt.
 */
import { istImportDatei, leseDatei, type Quelle } from '../logik/import/plan';

export interface GewaehlteDatei {
  datei: File;
  /** Name samt Ordner, falls bekannt („Reise/Reise.md“) */
  pfad: string;
}

/** Größer wird eine Notiz als Text nicht – alles darüber ist ein Anhang mit falscher Endung. */
const HOECHSTGROESSE = 5 * 1024 * 1024;

/** Liest den Text einer Datei. Erkennt UTF-16 an der Markierung am Dateianfang, sonst gilt UTF-8. */
async function leseText(datei: File): Promise<string> {
  const bytes = new Uint8Array(await datei.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

export async function leseDateien(dateien: GewaehlteDatei[]): Promise<{ quellen: Quelle[]; uebergangen: number }> {
  const quellen: Quelle[] = [];
  let uebergangen = 0;
  for (const { datei, pfad } of dateien) {
    if (!istImportDatei(pfad) || datei.size > HOECHSTGROESSE) {
      uebergangen++;
      continue;
    }
    try {
      const quelle = leseDatei({ name: pfad, inhalt: await leseText(datei) });
      if (quelle) quellen.push(quelle);
      else uebergangen++;
    } catch {
      uebergangen++;
    }
  }
  return { quellen, uebergangen };
}

/** Dateien aus der normalen Dateiauswahl des Geräts. */
export function ausAuswahl(liste: FileList | null): GewaehlteDatei[] {
  return [...(liste ?? [])].map((datei) => ({ datei, pfad: datei.webkitRelativePath || datei.name }));
}

function alsDatei(eintrag: FileSystemFileEntry): Promise<File> {
  return new Promise((fertig, fehler) => eintrag.file(fertig, fehler));
}

/** Alle Einträge eines Ordners. Der Browser liefert sie in Portionen, darum die Schleife. */
async function inhaltVon(ordner: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const leser = ordner.createReader();
  const alle: FileSystemEntry[] = [];
  for (;;) {
    const portion = await new Promise<FileSystemEntry[]>((fertig, fehler) => leser.readEntries(fertig, fehler));
    if (portion.length === 0) return alle;
    alle.push(...portion);
  }
}

async function sammle(eintrag: FileSystemEntry, ordner: string, ziel: GewaehlteDatei[]): Promise<void> {
  if (eintrag.isFile) {
    ziel.push({ datei: await alsDatei(eintrag as FileSystemFileEntry), pfad: ordner + eintrag.name });
  } else if (eintrag.isDirectory) {
    for (const kind of await inhaltVon(eintrag as FileSystemDirectoryEntry)) await sammle(kind, `${ordner}${eintrag.name}/`, ziel);
  }
}

/**
 * Dateien aus einem Ziehen-und-Ablegen am Laptop. Abgelegte Ordner werden durchsucht
 * (Apple legt die Markdown-Datei samt Bildern in einen eigenen Ordner).
 */
export async function ausAblage(ablage: DataTransfer): Promise<GewaehlteDatei[]> {
  // Die Einträge müssen sofort geholt werden – nach dem ersten Warten gibt der Browser sie nicht mehr her.
  const eintraege: FileSystemEntry[] = [];
  const einzeln: GewaehlteDatei[] = [];
  for (const stueck of [...ablage.items]) {
    if (stueck.kind !== 'file') continue;
    const eintrag = stueck.webkitGetAsEntry?.();
    if (eintrag) eintraege.push(eintrag);
    else {
      const datei = stueck.getAsFile();
      if (datei) einzeln.push({ datei, pfad: datei.name });
    }
  }
  if (eintraege.length === 0 && einzeln.length === 0) return ausAuswahl(ablage.files);

  const ergebnis = [...einzeln];
  for (const eintrag of eintraege) {
    try {
      await sammle(eintrag, '', ergebnis);
    } catch {
      // Ordner nicht lesbar: übergehen
    }
  }
  return ergebnis;
}
