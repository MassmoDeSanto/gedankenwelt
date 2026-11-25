/**
 * Abgleich mit simuliertem Drive und Erinnerungen mit simuliertem Kalender.
 * Das simulierte Drive lebt nur im Arbeitsspeicher: Seiten darum mit `gehe` wechseln, nie neu laden.
 */
import { driveDateien, EINGANG, expect, gehe, notizTexte, test, tippe } from './hilfen';

test('Abgleich: Notiz landet in Drive, Änderung aus Drive kommt an', async ({ page }) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('button', { name: 'Abgleich einschalten' }).click();
  const symbol = page.getByRole('button', { name: /^Google Drive:/ });
  await expect(symbol).toHaveAccessibleName('Google Drive: Abgeglichen');

  await gehe(page, EINGANG.slice(1));
  await page.getByRole('textbox', { name: 'Neue Notiz' }).click();
  await tippe(page, 'Geht nach Drive');
  await gehe(page, '#/einstellungen');
  await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
  await expect(symbol).toHaveAccessibleName('Google Drive: Abgeglichen');
  await expect
    .poll(async () => Object.entries(await driveDateien(page)).find(([, inhalt]) => inhalt.includes('Geht nach Drive'))?.[0])
    .toMatch(/Eingang\.md$/);

  // Jemand ändert die Datei direkt in Drive (z. B. ein anderes Gerät).
  const pfad = Object.entries(await driveDateien(page)).find(([, inhalt]) => inhalt.includes('Geht nach Drive'))![0];
  await page.evaluate((p) => {
    const drive = (window as unknown as { gedankenweltTestDrive: { bearbeiteVonHand(p: string, f: (s: string) => string): void } })
      .gedankenweltTestDrive;
    drive.bearbeiteVonHand(p, (s) => s.replace('Geht nach Drive', 'Geht nach Drive und zurück'));
  }, pfad);
  await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
  await expect(symbol).toHaveAccessibleName('Google Drive: Abgeglichen');
  await gehe(page, EINGANG.slice(1));
  await expect.poll(() => notizTexte(page)).toEqual(['Geht nach Drive und zurück']);
});

test('kaputte _meta.json: Warnzeichen und Hinweis, Kopie in _Sicherung', async ({ page }) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('button', { name: 'Abgleich einschalten' }).click();
  const symbol = page.getByRole('button', { name: /^Google Drive:/ });
  await expect(symbol).toHaveAccessibleName('Google Drive: Abgeglichen');
  await page.evaluate(() => {
    const drive = (window as unknown as { gedankenweltTestDrive: { bearbeiteVonHand(p: string, f: (s: string) => string): void } })
      .gedankenweltTestDrive;
    drive.bearbeiteVonHand('_meta.json', () => '{ kaputt');
  });
  await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
  await expect.poll(async () => Object.keys(await driveDateien(page)).some((p) => p.startsWith('_Sicherung/'))).toBe(true);
  await expect.poll(async () => (await driveDateien(page))['_meta.json']).not.toBe('{ kaputt');
  // Das Wolken-Symbol zeigt den Hinweis, bis man „Verstanden“ tippt.
  await symbol.click();
  const verstanden = page.getByRole('button', { name: 'Verstanden' });
  await expect(verstanden).toBeVisible();
  await expect(page.locator('.drive-hinweis')).toContainText('_meta.json');
  await verstanden.click();
  await expect(verstanden).toBeHidden();
});

test('Erinnerung: Aufgabe mit Uhrzeit wird Termin im simulierten Kalender', async ({ page }) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(page.getByText('Erinnerungen sind aktiv')).toBeVisible();

  await page.goto(EINGANG);
  await page.getByRole('textbox', { name: 'Neue Notiz' }).click();
  await tippe(page, '[ ] Zahnarzt anrufen');
  await page.getByRole('button', { name: 'Fälligkeit, Erinnerung und Wiederholung' }).click();
  await page.getByRole('button', { name: 'Morgen' }).click();
  await page.getByRole('textbox', { name: 'Uhrzeit (optional)' }).fill('09:30');
  await page.getByRole('combobox', { name: 'Erinnerung' }).selectOption({ label: '15 Minuten vorher' });
  await page.keyboard.press('Escape');

  const termine = () =>
    page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('gedankenwelt.simulierterKalender') ?? 'null')));
  await expect.poll(termine, { timeout: 15_000 }).toContain('Zahnarzt anrufen');

  // Abhaken entfernt den Termin wieder.
  await page.getByRole('checkbox', { name: 'Abhaken' }).click();
  await expect.poll(termine, { timeout: 15_000 }).not.toContain('Zahnarzt anrufen');
});
