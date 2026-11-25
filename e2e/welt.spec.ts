/** Gedankenwelt mit Kacheln, Unterlisten, Anheften, Notizen mit Namen und Papierkorb. */
import { EINGANG, expect, notizFeld, notizTexte, schreibeInEingang, test, tippe } from './hilfen';

test('neue Liste und Unterliste anlegen, Kacheln und Pfad', async ({ page }) => {
  await page.goto('/#/welt');
  await page.getByRole('button', { name: 'Liste' }).click();
  const dialog = page.getByRole('dialog', { name: 'Neue Liste' });
  await expect(dialog.getByRole('button', { name: 'Anlegen' })).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Name der Liste' }).fill('Reisen');
  await dialog.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Reisen', level: 1 })).toBeVisible();

  await page.getByRole('textbox', { name: 'Neue Notiz' }).click();
  await tippe(page, 'Zug nach Rom');
  await page.getByRole('button', { name: 'Liste bearbeiten' }).click();
  await page.getByRole('button', { name: 'Unterliste anlegen' }).click();
  await page.getByRole('textbox', { name: 'Name der Unterliste' }).fill('Italien');
  await page.getByRole('dialog').getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Italien', level: 1 })).toBeVisible();
  const pfad = page.getByRole('navigation', { name: 'Pfad' });
  await expect(pfad.getByRole('link', { name: 'Reisen' })).toBeVisible();
  await pfad.getByRole('link', { name: 'Reisen' }).click();
  await expect(page.getByRole('link', { name: /Italien/ })).toBeVisible();

  await page.goto('/#/welt');
  await expect(page.getByRole('link', { name: /^Reisen 1 Notiz\b/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Eingang 0 Notizen/ })).toBeVisible();
});

test('Liste anheften', async ({ page }) => {
  await page.goto(EINGANG);
  await page.getByRole('button', { name: 'Liste bearbeiten' }).click();
  await page.getByRole('button', { name: 'Anheften' }).click();
  await page.goto('/#/welt');
  const angeheftet = page.locator('section').filter({ hasText: 'Angeheftet' });
  await expect(angeheftet.getByRole('link', { name: /Eingang/ })).toBeVisible();
});

test('Notiz mit Namen: zugeklappt, aufklappen, wieder zuklappen', async ({ page }) => {
  await schreibeInEingang(page, 'Rezept Pesto\nBasilikum, Pinienkerne, Parmesan\n\nKurz');
  const name = page.getByRole('button', { name: /^Rezept Pesto/ });
  await expect(name).toBeVisible();
  await expect(page.getByText('Basilikum, Pinienkerne, Parmesan')).toBeHidden();
  await page.getByRole('button', { name: 'Aufklappen' }).click();
  await expect.poll(() => notizTexte(page)).toContain('Rezept Pesto\nBasilikum, Pinienkerne, Parmesan');
  await page.getByRole('button', { name: 'Zuklappen' }).click();
  await expect(name).toBeVisible();
  // Einzeilige Notizen haben keinen Pfeil.
  await expect(page.getByRole('button', { name: 'Aufklappen' })).toHaveCount(1);
});

test('Papierkorb: löschen, wiederherstellen, leeren', async ({ page }) => {
  await schreibeInEingang(page, 'Wird gerettet\n\nKommt weg');
  await expect.poll(() => notizTexte(page)).toHaveLength(2);
  // Die Knöpfe einer Notiz sind erst bedienbar, wenn der Cursor in ihr steht.
  await notizFeld(page, 1).click();
  await page.getByRole('button', { name: 'In den Papierkorb' }).nth(1).click();
  await notizFeld(page, 0).click();
  await page.getByRole('button', { name: 'In den Papierkorb' }).nth(0).click();
  await expect.poll(() => notizTexte(page)).toHaveLength(0);

  await page.goto('/#/papierkorb');
  const zeile = page.locator('.korbzeile').filter({ hasText: 'Wird gerettet' });
  await expect(zeile).toContainText('Eingang · noch 30 Tage');
  await zeile.getByRole('button', { name: 'Wiederherstellen' }).click();
  await expect(zeile).toBeHidden();

  await page.getByRole('button', { name: 'Leeren' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Leeren|Endgültig/ }).click();
  await expect(page.getByText(/Kommt weg/)).toBeHidden();

  await page.goto(EINGANG);
  await expect.poll(() => notizTexte(page)).toEqual(['Wird gerettet']);
});
