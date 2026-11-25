/** Tagebuch: Tagesseite (Überschrift, Ort, Bewertung, Gewohnheiten), Schreibimpulse, Monat. */
import { expect, ladeNeu, test, tippe } from './hilfen';

test('Tagesseite: Überschrift, Ort, Bewertung, Gewohnheit und Text bleiben gespeichert', async ({ page }) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('textbox', { name: 'Neue Gewohnheit' }).fill('Lesen');
  await page.getByRole('textbox', { name: 'Neue Gewohnheit' }).press('Enter');

  await page.goto('/#/tagebuch');
  await page.getByRole('textbox', { name: 'Überschrift des Tages' }).fill('Ein ruhiger Tag');
  await page.getByRole('textbox', { name: 'Ort des Tages' }).fill('München');
  await page.getByRole('radio', { name: '4 · gut' }).click();
  const lesen = page.getByRole('group', { name: 'Gewohnheiten' }).getByRole('button', { name: 'Lesen' });
  await expect(lesen).toHaveAttribute('aria-pressed', 'false');
  await lesen.click();
  await expect(lesen).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox', { name: 'Neue Notiz' }).click();
  await tippe(page, 'Lange spazieren gewesen.');

  // Kartenlink zum Ort: neuer Tab, ohne Herkunft.
  const karte = page.locator('a.tb-ort-karte');
  await expect(karte).toHaveAttribute('href', /M%C3%BCnchen|München/);
  await expect(karte).toHaveAttribute('rel', 'noopener noreferrer');

  await ladeNeu(page);
  await expect(page.getByRole('textbox', { name: 'Überschrift des Tages' })).toHaveValue('Ein ruhiger Tag');
  await expect(page.getByRole('textbox', { name: 'Ort des Tages' })).toHaveValue('München');
  await expect(page.getByRole('radio', { name: '4 · gut' })).toBeChecked();
  await expect(lesen).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Notiz', exact: true })).toHaveValue('Lange spazieren gewesen.');

  // Startseite: Karte „Tagebuch“ zeigt die Überschrift.
  await page.goto('/#/');
  await expect(page.getByRole('link', { name: /Tagebuch.*Ein ruhiger Tag/ })).toBeVisible();
});

test('Schreibimpuls übernehmen, andere Frage, eigene Fragen', async ({ page }) => {
  await page.goto('/#/tagebuch');
  const frage = page.locator('.tb-impuls-frage');
  const ersteFrage = await frage.textContent();
  await page.getByRole('button', { name: 'Andere Frage' }).click();
  await expect(frage).not.toHaveText(ersteFrage!);
  const zweiteFrage = (await frage.textContent())!;
  await frage.click();
  await expect(page.getByRole('button', { name: 'Frage entfernen' })).toBeVisible();
  await expect(page.locator('.tb-impuls.uebernommen')).toHaveText(zweiteFrage);
  await page.getByRole('button', { name: 'Frage entfernen' }).click();
  await expect(frage).toBeVisible();

  // Eigene Liste: nur noch eine Frage.
  await page.goto('/#/einstellungen');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const feld = page.getByRole('textbox', { name: 'Schreibimpulse, eine Frage pro Zeile' });
  await feld.fill('Wofür bin ich heute dankbar?');
  await feld.blur();
  await page.goto('/#/tagebuch');
  await expect(frage).toHaveText('Wofür bin ich heute dankbar?');
});

test('vorheriger Tag und Monatsübersicht', async ({ page }) => {
  await page.goto('/#/tagebuch');
  await page.getByRole('button', { name: 'Vorheriger Tag' }).click();
  await expect(page.getByRole('button', { name: 'Nächster Tag' })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Überschrift des Tages' }).fill('Gestern war Markt');
  await page.getByRole('radio', { name: '5 · sehr gut' }).click();

  await page.getByRole('link', { name: 'Tagebuch · Monat' }).click();
  await expect(page).toHaveURL(/#\/tagebuch-monat\/\d{4}-\d{2}/);
  await expect(page.getByText('Gestern war Markt')).toBeVisible();
});
