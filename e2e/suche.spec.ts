/** Suche auf der Startseite: fehlertolerant, mit Markierung und Sprung zur Notiz. */
import { expect, notizTexte, schreibeInEingang, test } from './hilfen';

test('Suche findet trotz Tippfehler und springt zur Notiz', async ({ page }) => {
  await schreibeInEingang(page, 'Pfandflaschen zurückbringen\n\nZahnarzt anrufen');
  await expect.poll(() => notizTexte(page)).toHaveLength(2);

  await page.goto('/#/');
  await page.getByRole('searchbox', { name: 'Notizen durchsuchen' }).fill('Pfandflashen');
  await expect(page.getByText('1 Treffer')).toBeVisible();
  const treffer = page.getByRole('link', { name: /Pfandflaschen zurückbringen/ });
  await expect(treffer).toBeVisible();
  await expect(treffer.locator('mark')).toHaveText('Pfandflaschen');

  await treffer.click();
  await expect(page).toHaveURL(/#\/liste\//);
  await expect(page.getByRole('heading', { name: 'Eingang', level: 1 })).toBeVisible();
});

test('Suche ohne Treffer und Leeren der Suche', async ({ page }) => {
  await schreibeInEingang(page, 'Etwas ganz anderes');
  await expect.poll(() => notizTexte(page)).toHaveLength(1);

  await page.goto('/#/');
  const suche = page.getByRole('searchbox', { name: 'Notizen durchsuchen' });
  await suche.fill('Quantenmechanik');
  await expect(page.getByText(/0 Treffer|Nichts gefunden|Keine Treffer/)).toBeVisible();
  await page.getByRole('button', { name: 'Suche leeren' }).click();
  await expect(suche).toHaveValue('');
  await expect(page.getByText('Gedanke des Tages', { exact: true })).toBeVisible();
});
