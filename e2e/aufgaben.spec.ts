/** Aufgaben: Kästchen, Termin, Wiederholung, Priorität und Stand, „Alle Aufgaben“ mit Filter-Chips. */
import { datumIn, expect, notizFeld, notizTexte, schreibeInEingang, test } from './hilfen';

const TERMIN = 'Fälligkeit, Erinnerung und Wiederholung';

test('„[ ] “ wird zum Kästchen, Abhaken und wieder öffnen', async ({ page }) => {
  await schreibeInEingang(page, '[ ] Koffer packen');
  await expect.poll(() => notizTexte(page)).toEqual(['Koffer packen']);
  await page.getByRole('checkbox', { name: 'Abhaken' }).click();
  const erledigt = page.getByRole('checkbox', { name: 'Als offen markieren' });
  await expect(erledigt).toBeChecked();
  await page.reload();
  await erledigt.click();
  await expect(page.getByRole('checkbox', { name: 'Abhaken' })).not.toBeChecked();
});

test('tägliche Wiederholung: Abhaken schiebt auf morgen, Rückgängig zurück', async ({ page }) => {
  await schreibeInEingang(page, '[ ] Blumen gießen');
  await page.getByRole('button', { name: TERMIN }).click();
  await page.getByRole('button', { name: 'Heute' }).click();
  await page.getByRole('combobox', { name: 'Wiederholung' }).selectOption({ label: 'Täglich' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: TERMIN })).toHaveText(/heute.*täglich/);

  await page.getByRole('checkbox', { name: 'Abhaken' }).click();
  await expect(page.getByRole('button', { name: TERMIN })).toHaveText(/morgen.*täglich/);
  await expect(page.getByRole('checkbox', { name: 'Abhaken' })).not.toBeChecked();
  const meldung = page.getByRole('status').filter({ hasText: 'Nächstes Mal' });
  await expect(meldung).toBeVisible();
  await meldung.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: TERMIN })).toHaveText(/heute.*täglich/);
});

test('Priorität geht reihum, Stand wechselt zwischen offen und in Arbeit', async ({ page }) => {
  await schreibeInEingang(page, '[ ] Steuer machen');
  const prio = page.getByRole('button', { name: /^Priorität/ });
  await expect(prio).toHaveAccessibleName('Priorität setzen (hoch)');
  await prio.click();
  await expect(prio).toHaveAccessibleName('Priorität hoch – tippen für mittel');
  await prio.click();
  await expect(prio).toHaveAccessibleName('Priorität mittel – tippen für niedrig');
  await prio.click();
  await expect(prio).toHaveAccessibleName('Priorität niedrig – tippen für keine');
  await prio.click();
  await expect(prio).toHaveAccessibleName('Priorität setzen (hoch)');

  const stand = page.getByRole('button', { name: /tippen für (in Arbeit|offen)/ });
  await expect(stand).toHaveAccessibleName('Offen – tippen für in Arbeit');
  await stand.click();
  await expect(stand).toHaveAccessibleName('In Arbeit – tippen für offen');
  await page.reload();
  await notizFeld(page, 0).click();
  await expect(stand).toHaveAccessibleName('In Arbeit – tippen für offen');
});

test('„Alle Aufgaben“: Filter-Chips und To-do-Box auf der Startseite', async ({ page }) => {
  await schreibeInEingang(page, '[ ] Steuer machen\n\n[ ] Blumen gießen\n\n[ ] Irgendwann');
  await expect.poll(() => notizTexte(page)).toHaveLength(3);
  // „Steuer machen“: vor fünf Tagen fällig, hoch, in Arbeit.
  await notizFeld(page, 0).click();
  await page.getByRole('button', { name: TERMIN }).first().click();
  await page.getByRole('textbox', { name: 'Datum' }).fill(await datumIn(page, -5));
  await page.keyboard.press('Escape');
  await notizFeld(page, 0).click();
  await page.getByRole('button', { name: /^Priorität/ }).click();
  await page.getByRole('button', { name: 'Offen – tippen für in Arbeit' }).click();
  // „Blumen gießen“: morgen.
  await notizFeld(page, 1).click();
  await page.getByRole('button', { name: TERMIN }).nth(1).click();
  await page.getByRole('button', { name: 'Morgen' }).click();
  await page.keyboard.press('Escape');

  await page.goto('/#/aufgaben');
  const chips = page.getByRole('navigation', { name: 'Aufgaben filtern' });
  await expect(chips.getByRole('link', { name: 'Alle 3' })).toBeVisible();
  await expect(chips.getByRole('link', { name: 'Überfällig 1' })).toBeVisible();
  await expect(chips.getByRole('link', { name: 'In Arbeit 1' })).toBeVisible();
  await expect(chips.getByRole('link', { name: 'Hoch 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Steuer machen' })).toBeVisible();
  await expect(page.getByText('seit 5 Tagen')).toBeVisible();

  await chips.getByRole('link', { name: 'Überfällig 1' }).click();
  await expect(page).toHaveURL(/#\/aufgaben\/ueberfaellig$/);
  await expect(page.getByRole('link', { name: 'Steuer machen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Blumen gießen' })).toBeHidden();

  // Abhaken direkt in der Übersicht.
  await chips.getByRole('link', { name: 'Alle 3' }).click();
  await page.getByRole('link', { name: 'Irgendwann' }).locator('..').getByRole('checkbox', { name: 'Abhaken' }).click();
  await expect(chips.getByRole('link', { name: 'Alle 2' })).toBeVisible();

  await page.goto('/#/');
  await expect(page.getByRole('link', { name: '1 überfällig' })).toBeVisible();
  await expect(page.getByRole('link', { name: '2 offen' })).toBeVisible();
  await page.getByRole('link', { name: 'Steuer machen' }).click();
  await expect(page.getByRole('heading', { name: 'Eingang', level: 1 })).toBeVisible();
});
