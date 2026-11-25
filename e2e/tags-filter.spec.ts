/** Tag-Dropdown beim Schreiben und Filter der Suche. */
import { expect, notizTexte, schreibeInEingang, test } from './hilfen';

test('Tag-Dropdown schlägt vorhandene Tags vor und übernimmt sie mit Enter', async ({ page }) => {
  await schreibeInEingang(page, 'Zug buchen #reise \n\nHotel #re');
  const liste = page.getByRole('listbox', { name: 'Tags' });
  await expect(liste.getByRole('option', { name: /#reise/ })).toHaveAttribute('aria-selected', 'true');
  await expect(liste.getByRole('option', { name: /neu anlegen/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(liste).toBeHidden();
  await expect.poll(() => notizTexte(page)).toEqual(['Zug buchen #reise', 'Hotel #reise']);
});

test('Escape schließt das Tag-Dropdown, ohne etwas einzusetzen', async ({ page }) => {
  await schreibeInEingang(page, 'Etwas #neu');
  const liste = page.getByRole('listbox', { name: 'Tags' });
  await expect(liste).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(liste).toBeHidden();
  await expect.poll(() => notizTexte(page)).toEqual(['Etwas #neu']);
});

test('Tag-Knopf an der Notiz setzt ein # und öffnet das Dropdown', async ({ page }) => {
  await schreibeInEingang(page, 'Erste #arbeit \n\nZweite');
  await page.getByRole('button', { name: 'Tag einfügen' }).last().click();
  await expect(page.getByRole('listbox', { name: 'Tags' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => notizTexte(page)).toEqual(['Erste #arbeit', 'Zweite #arbeit']);
});

test('Suche mit Filtern: Liste, Tag und Aufgaben', async ({ page }) => {
  await schreibeInEingang(page, 'Zug buchen #reise \n\n[ ] Koffer packen #reise \n\nBrot kaufen #einkauf ');
  await expect.poll(() => notizTexte(page)).toHaveLength(3);

  await page.goto('/#/');
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('combobox', { name: 'Liste' }).selectOption({ label: 'Eingang' });
  await page.getByRole('button', { name: '#reise' }).click();
  await expect(page.getByText('2 Treffer')).toBeVisible();
  await expect(page.getByRole('link', { name: /Zug buchen/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Brot kaufen/ })).toBeHidden();

  await page.getByRole('radio', { name: 'Offen' }).check();
  await expect(page.getByText('1 Treffer')).toBeVisible();
  await expect(page.getByRole('link', { name: /Koffer packen/ })).toBeVisible();

  // Filter und Suchwort wirken zusammen.
  await page.getByRole('radio', { name: 'Alle' }).first().check();
  await page.getByRole('searchbox', { name: 'Notizen durchsuchen' }).fill('Zug');
  await expect(page.getByText('1 Treffer')).toBeVisible();
  await expect(page.getByRole('link', { name: /Zug buchen/ })).toBeVisible();
});

test('Suchfilter Datum: nichts vor dem Erstelltag', async ({ page }) => {
  await schreibeInEingang(page, 'Heute geschrieben');
  await expect.poll(() => notizTexte(page)).toHaveLength(1);
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('textbox', { name: 'bis' }).fill('2020-01-01');
  await expect(page.getByRole('link', { name: /Heute geschrieben/ })).toBeHidden();
  await page.getByRole('textbox', { name: 'bis' }).fill('');
  await page.getByRole('textbox', { name: 'von' }).fill('2020-01-01');
  await expect(page.getByRole('link', { name: /Heute geschrieben/ })).toBeVisible();
});
