/** Hell und Dunkel: Umschalten in den Einstellungen, bleibt nach dem Neuladen. */
import { expect, test } from './hilfen';

test('Farbschema Hell/Dunkel umschalten', async ({ page }) => {
  await page.goto('/#/einstellungen');
  const wurzel = page.locator('html');
  const hintergrund = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.getByRole('radio', { name: 'Dunkel' }).check();
  await expect(wurzel).not.toHaveAttribute('data-thema', 'hell');
  const dunkel = await hintergrund();

  await page.getByRole('radio', { name: 'Hell' }).check();
  await expect(wurzel).toHaveAttribute('data-thema', 'hell');
  await expect.poll(hintergrund).not.toBe(dunkel);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f1ec');

  await page.reload();
  await expect(wurzel).toHaveAttribute('data-thema', 'hell');
  await expect(page.getByRole('radio', { name: 'Hell' })).toBeChecked();
});
