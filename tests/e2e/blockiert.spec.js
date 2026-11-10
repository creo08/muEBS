// Ein anderes Fenster hält die Datenbank offen und reagiert nicht: klare Meldungen statt stillem Hängen.
import { test, expect } from './fixtures.js';
import { projektDatei, starteMit } from './hilfen.js';

/**
 * Öffnet in einer zweiten Seite eine Verbindung, die versionchange ignoriert (wie ein eingefrorenes Fenster).
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} basis
 */
async function festhalten(context, basis) {
  const p = await context.newPage();
  await p.goto(basis + 'version.json');
  await p.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open('muebs');
    r.onsuccess = () => { /** @type {any} */ (window).halter = r.result; ok(undefined); };
  }));
  return p;
}

test('Gerät zurücksetzen bei offenem anderen Fenster: Meldung, danach geht es weiter', async ({ page, basis, context }) => {
  await starteMit(page, basis, projektDatei());
  const anderes = await festhalten(context, basis);
  await page.goto(basis + '#/admin/zuruecksetzen');
  await page.getByRole('button', { name: 'Gerät zurücksetzen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ohne Sicherung weiter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByRole('alert')).toContainText('Bitte andere µEBS-Fenster und Browser-Tabs schließen');
  // anderes Fenster schließt: das Löschen läuft weiter, µEBS startet neu
  await anderes.close();
  await expect(page.getByRole('heading', { name: 'Willkommen bei µEBS' })).toBeVisible();
});

test('Start wartet zu lange auf die Daten: Meldung mit „Neu laden“ statt „wird geladen“', async ({ page, basis, context }) => {
  await starteMit(page, basis, projektDatei());
  const anderes = await festhalten(context, basis);
  await page.clock.install();
  // Löschen aus dem eingefrorenen Fenster: es wartet auf dessen eigene Verbindung und blockiert jeden neuen Start.
  // µEBS schließt seine Verbindung (versionchange), lädt neu und wartet dann beim Öffnen.
  await anderes.evaluate(() => { indexedDB.deleteDatabase('muebs'); });
  await expect(page.locator('main')).toHaveText('µEBS wird geladen …');
  // die Version setzt start() erst nach dem Wächter: dann läuft der Start und wartet
  await expect(page.locator('#version')).toHaveText('v1.0.0 (abc1234)');
  await page.clock.fastForward('00:11');
  await expect(page.getByRole('heading', { name: 'µEBS kann nicht starten' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('µEBS wartet auf die Daten.');
  await expect(page.getByRole('button', { name: 'Neu laden' })).toBeVisible();
  await anderes.close();
});
