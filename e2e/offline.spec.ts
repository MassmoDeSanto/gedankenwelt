/**
 * Offline-Betrieb (gebaute Version mit Service Worker): Einmal geladen, startet die App ohne
 * Internet, und Geschriebenes bleibt gespeichert.
 */
import { EINGANG, expect, ladeNeu, notizTexte, test, tippe } from './hilfen';

test('App startet ohne Internet und speichert weiter', async ({ page, context }) => {
  await page.goto('/');
  // Warten, bis der Service Worker die App-Dateien zwischengespeichert hat. Die Seite steuert er
  // erst ab dem nächsten Laden – darum einmal neu laden und prüfen, dass er es jetzt tut.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await ladeNeu(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await ladeNeu(page);
  await expect(page.getByRole('searchbox', { name: 'Notizen durchsuchen' })).toBeVisible();

  await page.goto(EINGANG);
  await page.getByRole('textbox', { name: 'Neue Notiz' }).click();
  await tippe(page, 'Ohne Netz geschrieben');
  await ladeNeu(page);
  await expect.poll(() => notizTexte(page)).toEqual(['Ohne Netz geschrieben']);
  await context.setOffline(false);
});
