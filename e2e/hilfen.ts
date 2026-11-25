/**
 * Gemeinsame Hilfen für die Ende-zu-Ende-Tests.
 *
 * `test` ersetzt das gleichnamige Playwright-`test`: Vor jedem Seitenaufruf werden simuliertes Drive
 * und simulierter Kalender eingeschaltet (siehe `src/main.tsx`). Jeder Test hat ein eigenes, leeres
 * Browserprofil – also eigene Datenbank und eigenen localStorage.
 */
import { test as basis, expect, type Page } from '@playwright/test';

export { expect };

export const test = basis.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('gedankenwelt.testdrive', '1');
      localStorage.setItem('gedankenwelt.testkalender', '1');
    });
    await use(page);
  },
});

/** Die Liste „Eingang“ hat immer dieselbe ID. */
export const EINGANG = '/#/liste/00000000000000000000000000';

/**
 * Tippt Text so, wie ein Mensch es täte: in das Feld, das gerade den Cursor hat.
 * Ein „\n“ im Text ist ein Druck auf Enter.
 */
export async function tippe(page: Page, text: string) {
  const zeilen = text.split('\n');
  for (let i = 0; i < zeilen.length; i++) {
    if (i > 0) await page.keyboard.press('Enter');
    if (zeilen[i]) await page.keyboard.type(zeilen[i]);
  }
}

/** Öffnet den Eingang und schreibt dort Text in das Feld „Neue Notiz“. */
export async function schreibeInEingang(page: Page, text: string) {
  await page.goto(EINGANG);
  await page.getByRole('textbox', { name: 'Neue Notiz' }).click();
  await tippe(page, text);
}

/**
 * Alle Notiz-Textfelder der offenen Liste (ohne das leere Feld „Neue Notiz“), als Text.
 * Leerzeichen am Rand fallen weg: Das Textfeld behält z. B. nach einem Tag eins, gespeichert wird ohne.
 */
export async function notizTexte(page: Page): Promise<string[]> {
  return page.getByRole('textbox', { name: 'Notiz', exact: true }).evaluateAll((felder) =>
    felder.map((f) => (f as HTMLTextAreaElement).value.trim()),
  );
}

/** Datum „heute + tage“ als JJJJ-MM-TT, so wie der Browser es sieht (Ortszeit). */
export async function datumIn(page: Page, tage: number): Promise<string> {
  return page.evaluate((t) => {
    const d = new Date();
    d.setDate(d.getDate() + t);
    const zwei = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
  }, tage);
}

/** Das Textfeld der n-ten Notiz in der offenen Liste (ab 0). */
export function notizFeld(page: Page, n: number) {
  return page.getByRole('textbox', { name: 'Notiz', exact: true }).nth(n);
}

/**
 * Wechselt innerhalb der App die Seite, ohne neu zu laden (nur der Teil hinter „#“ ändert sich).
 * Wichtig für das simulierte Drive: Es lebt nur im Arbeitsspeicher und wäre nach einem Neuladen leer.
 */
export async function gehe(page: Page, hash: string) {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
}

/** Pfade und Inhalte aller Dateien im simulierten Drive (`window.gedankenweltTestDrive`). */
export async function driveDateien(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const drive = (window as unknown as { gedankenweltTestDrive: { dateien(): Map<string, string> } })
      .gedankenweltTestDrive;
    return Object.fromEntries(drive.dateien());
  });
}
