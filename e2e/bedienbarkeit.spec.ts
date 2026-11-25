/**
 * Bedienbarkeit (PHASE-6.md, Abschnitt 5): automatische Prüfung mit axe-core.
 *
 * axe sucht Fehler, die Bildschirmleser und Tastatur stören: Knöpfe ohne Namen, Felder ohne
 * Beschriftung, falsche Rollen, doppelte IDs und Ähnliches. Die Kontraste prüft axe hier nicht:
 * Das misst `werkzeuge/kontraste.mjs` genauer, direkt an den Farben in `stil.css`.
 */
import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';
import { expect, gehe, schreibeInEingang, test } from './hilfen';

const SEITEN: [string, string][] = [
  ['Start', '#/'],
  ['Liste', '#/liste/00000000000000000000000000'],
  ['Aufgaben', '#/aufgaben'],
  ['Gedankenwelt', '#/welt'],
  ['Tagebuch', '#/tagebuch'],
  ['Einstellungen', '#/einstellungen'],
  ['Import', '#/import'],
  ['Papierkorb', '#/papierkorb'],
];

/** Prüft die offene Seite und gibt die Funde lesbar zurück (leer = alles gut). */
async function pruefe(page: Page): Promise<string[]> {
  const ergebnis = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  return ergebnis.violations.map(
    (v) => `${v.id}: ${v.help} – ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

for (const thema of ['Hell', 'Dunkel'] as const) {
  test(`axe findet keine Fehler (${thema})`, async ({ page }) => {
    // Etwas Inhalt, damit Notizen, Aufgaben und Papierkorb nicht leer sind
    await schreibeInEingang(page, 'Erster Gedanke\n[ ] Brot kaufen\nNotiz für den Papierkorb');
    await page.getByRole('textbox', { name: 'Notiz', exact: true }).last().click();
    await page.getByRole('button', { name: 'In den Papierkorb' }).last().click();

    await gehe(page, '#/einstellungen');
    await page.getByRole('radio', { name: thema }).check();

    const funde: Record<string, string[]> = {};
    for (const [name, hash] of SEITEN) {
      await gehe(page, hash);
      await page.waitForLoadState('networkidle');
      const f = await pruefe(page);
      if (f.length) funde[name] = f;
    }
    expect(funde).toEqual({});
  });
}

test('Tastatur: Fokus sichtbar, Dialog hält den Fokus und schließt mit Escape', async ({ page }) => {
  await schreibeInEingang(page, 'Notiz für den Papierkorb');
  await page.getByRole('button', { name: 'In den Papierkorb' }).last().click();

  // Startseite: Mit Tab bekommen Knöpfe und Links einen sichtbaren Fokusrahmen.
  await gehe(page, '#/');
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const rahmen = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (el.matches('input, textarea')) return 'Textfeld (Cursor)';
      return getComputedStyle(el).outlineStyle;
    });
    expect(rahmen).not.toBe('none');
  }

  // Papierkorb leeren: Dialog öffnet mit Fokus auf „Abbrechen“, Tab bleibt im Dialog.
  await gehe(page, '#/papierkorb');
  const leeren = page.getByRole('button', { name: 'Leeren', exact: true });
  await leeren.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }

  // Escape schließt, der Fokus kehrt zum Knopf zurück, nichts wurde gelöscht.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(leeren).toBeFocused();
  await expect(page.getByText('Notiz für den Papierkorb')).toBeVisible();
});
