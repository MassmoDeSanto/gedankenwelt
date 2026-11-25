/** Import aus Apple Notizen mit den erfundenen Testdateien (src/logik/import/testdaten). */
import { expect, test } from './hilfen';

const TESTDATEN = 'src/logik/import/testdaten/';

test('Import per Kurzbefehl-Dateien: Vorschau, Import, Suche, Rückgängig', async ({ page }) => {
  await page.goto('/#/import');
  const wahl = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Dateien auswählen' }).first().click();
  await (await wahl).setFiles([TESTDATEN + 'Wocheneinkauf.txt', TESTDATEN + 'Reise nach Lissabon.txt']);

  await expect(page.getByRole('heading', { name: 'Vorschau', level: 1 })).toBeVisible();
  await expect(page.getByText('16 Notizen in 6 Listen, 5 Aufgaben, davon 3 offen')).toBeVisible();
  await expect(page.getByText('1 Bild oder Anhang wird nicht übernommen')).toBeVisible();

  await page.getByRole('button', { name: '16 Notizen importieren' }).click();
  // Ohne Google-Verbindung fragt die App nach.
  await page.getByRole('dialog', { name: 'Nicht mit Google verbunden' }).getByRole('button', { name: 'Trotzdem importieren' }).click();
  await expect(page.getByRole('heading', { name: 'Import fertig', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Zur Gedankenwelt' }).click();
  await expect(page.getByRole('link', { name: /^Haushalt 6 Notizen/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Projekte 10 Notizen/ })).toBeVisible();

  // Importiertes ist durchsuchbar, offene Aufgaben stehen in den To-dos.
  await page.goto('/#/');
  await page.getByRole('searchbox', { name: 'Notizen durchsuchen' }).fill('Haferflocken');
  await expect(page.getByRole('link', { name: /Haferflocken.*Wocheneinkauf/ })).toBeVisible();
  await page.goto('/#/aufgaben');
  await expect(page.getByRole('link', { name: 'Haferflocken' })).toBeVisible();

  // Rückgängig unter Einstellungen.
  await page.goto('/#/einstellungen');
  await expect(page.getByText(/Import-Verlauf.*2 Dateien · 6 Listen · 16 Notizen/)).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import rückgängig machen' });
  await expect(dialog).toContainText('16 Notizen und 6 Listen aus diesem Import wandern in den Papierkorb');
  await dialog.getByRole('button', { name: 'In den Papierkorb' }).click();
  await page.goto('/#/welt');
  await expect(page.getByRole('link', { name: /^Haushalt/ })).toBeHidden();
  await expect(page.getByRole('link', { name: /^Projekte/ })).toBeHidden();
});

test('Import durch Einfügen von Text (Weg C)', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: 'Text einfügen' }).click();
  await page.getByRole('textbox', { name: 'Titel' }).fill('Ideen fürs Wochenende');
  await page.getByRole('textbox', { name: 'Text der Notiz' }).fill('Museum besuchen\n\nFreunde einladen');
  await page.getByRole('button', { name: 'Zur Vorschau' }).click();
  await expect(page.getByRole('heading', { name: 'Vorschau', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Notizen? importieren$/ }).click();
  await page.getByRole('button', { name: 'Trotzdem importieren' }).click();
  await expect(page.getByRole('heading', { name: 'Import fertig', level: 1 })).toBeVisible();
  await page.goto('/#/');
  await page.getByRole('searchbox', { name: 'Notizen durchsuchen' }).fill('Museum');
  await expect(page.getByRole('link', { name: /Museum besuchen/ })).toBeVisible();
});
