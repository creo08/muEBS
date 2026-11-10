// Hotlist: so viele Kacheln, wie ohne Scrollen passen, die mit den meisten Stück, alphabetisch angezeigt.
import { test, expect } from './fixtures.js';

/** @param {import('@playwright/test').Page} page */
async function kacheln(page) {
  return page.locator('.kacheln[aria-label="Mitglieder"] .kachel').evaluateAll((els) => {
    const fuss = document.querySelector('footer')?.getBoundingClientRect().top ?? innerHeight;
    return els.map((e) => ({ name: e.querySelector('.name')?.textContent ?? '', unten: e.getBoundingClientRect().bottom, fuss }));
  });
}

test('Hotlist passt sich der Bildschirmgröße an und bleibt alphabetisch', async ({ page, basis }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(basis);
  await page.getByRole('button', { name: 'Demo ansehen' }).click();
  await expect(page.locator('.kachel').first()).toBeVisible();
  const klein = await kacheln(page);
  // alle angezeigten Kacheln ganz sichtbar, ohne Scrollen, und nicht alle 10 Mitglieder der Demo
  expect(klein.length).toBeGreaterThan(0);
  expect(klein.length).toBeLessThan(10);
  for (const k of klein) expect(k.unten).toBeLessThanOrEqual(k.fuss);
  const namen = klein.map((k) => k.name);
  expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b, 'de')));
  // größer: alle 10 aktiven Mitglieder mit Buchungen der letzten 14 Tage
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect.poll(async () => (await kacheln(page)).length).toBe(10);
  // Suche findet trotzdem alle, auch ohne Hotlist-Platz
  await page.setViewportSize({ width: 390, height: 700 });
  await page.getByLabel('Mitglied suchen').fill('e');
  await expect.poll(async () => (await kacheln(page)).length).toBeGreaterThan(klein.length);
});
