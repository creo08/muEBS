import { test, expect } from './fixtures.js';
import { projektDatei, starteMit } from './hilfen.js';

test('nach dem Laden wird die Startseite nur einmal gezeichnet (Suche bleibt erhalten)', async ({ page, basis }) => {
  await page.addInitScript(() => {
    /** @type {any} */ (window).__seiten = 0;
    new MutationObserver((liste) => {
      for (const m of liste) for (const n of m.addedNodes) if (n instanceof HTMLElement && n.matches('h1') && n.textContent === 'µEBS') /** @type {any} */ (window).__seiten++;
    }).observe(document, { childList: true, subtree: true });
  });
  await starteMit(page, basis, projektDatei());
  await page.getByLabel('Mitglied suchen').fill('Alex');
  await expect(page.locator('.kachel')).toHaveCount(1);
  expect(await page.evaluate(() => /** @type {any} */ (window).__seiten)).toBe(1);
});
