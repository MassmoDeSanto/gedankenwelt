/** Schreiben nach der Absatz-Regel: 1× Enter = neue Zeile, 2× Enter = neue Notiz. */
import { expect, notizTexte, schreibeInEingang, test, tippe } from './hilfen';

test('einmal Enter bleibt in der Notiz, zweimal Enter beginnt eine neue', async ({ page }) => {
  await schreibeInEingang(page, 'Erste Zeile\nzweite Zeile\n\nNeue Notiz');
  // Mehrzeilig = Notiz mit Namen (README Abschnitt 12): Ohne Cursor ist sie zugeklappt.
  await expect(page.getByRole('button', { name: /^Erste Zeile/ })).toBeVisible();
  await page.getByRole('button', { name: 'Aufklappen' }).click();
  await expect.poll(() => notizTexte(page)).toEqual(['Erste Zeile\nzweite Zeile', 'Neue Notiz']);
});

test('mehr als zweimal Enter erzeugt keine leeren Notizen', async ({ page }) => {
  await schreibeInEingang(page, 'Eins\n\n\n\nZwei');
  await expect.poll(() => notizTexte(page)).toEqual(['Eins', 'Zwei']);
});

test('Notizen sind nach dem Neuladen noch da', async ({ page }) => {
  await schreibeInEingang(page, 'Bleibt gespeichert\n\nAuch das');
  await expect.poll(() => notizTexte(page)).toHaveLength(2);
  await page.reload();
  await expect.poll(() => notizTexte(page)).toEqual(['Bleibt gespeichert', 'Auch das']);
  // Jede Notiz trägt ihr Erstelldatum.
  await expect(page.getByText(/^\d{1,2}\. \w{3}/).first()).toBeVisible();
});

test('Rücktaste am Anfang einer Notiz führt sie mit der oberen zusammen', async ({ page }) => {
  await schreibeInEingang(page, 'Oben\n\nUnten');
  await expect.poll(() => notizTexte(page)).toEqual(['Oben', 'Unten']);
  // Cursor an den Anfang von „Unten“ und Rücktaste.
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await expect.poll(() => notizTexte(page)).toEqual(['Oben\nUnten']);
});

test('eine Notiz lässt sich mitten im Text teilen', async ({ page }) => {
  await schreibeInEingang(page, 'Vorne Hinten');
  await expect.poll(() => notizTexte(page)).toEqual(['Vorne Hinten']);
  // Cursor hinter „Vorne“, dann zweimal Enter.
  for (let i = 0; i < 'Hinten'.length; i++) await page.keyboard.press('ArrowLeft');
  await tippe(page, '\n\n');
  await expect.poll(() => notizTexte(page)).toEqual(['Vorne', 'Hinten']);
});
