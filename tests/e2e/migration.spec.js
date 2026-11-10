// Migration der Datenbank: Eine höhere DB_VERSION wird per Route in js/konstanten.js eingesetzt.
import { test, expect } from './fixtures.js';
import { datenbank, download, projektDatei, starteMit } from './hilfen.js';

// Ohne Service Worker, damit die Route jede Anfrage nach konstanten.js sieht
test.use({ serviceWorkers: 'block' });

/** @param {import('@playwright/test').Page} page */
async function version2(page) {
  await page.route('**/js/konstanten.js', async (route) => {
    const antwort = await route.fetch();
    const text = await antwort.text();
    expect(text).toContain('DB_VERSION = 1;');
    await route.fulfill({ response: antwort, body: text.replace('DB_VERSION = 1;', 'DB_VERSION = 2;') });
  });
}

/** @param {import('@playwright/test').Page} page */
const dbVersion = (page) => page.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open('muebs');
  r.onsuccess = () => { ok(r.result.version); r.result.close(); };
}));

test('bestehende Daten: erst „Vorher sichern?“, dann Migration ohne Datenverlust', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  const vorher = await datenbank(page);
  await version2(page);
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('Vorher sichern?');
  const s = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Sicherung herunterladen' }).click());
  expect(s.name).toMatch(/^muebs_sicherung_/);
  expect(JSON.parse(s.text).mitglieder).toEqual(vorher.mitglieder);
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  expect(await dbVersion(page)).toBe(2);
  const nachher = await datenbank(page);
  expect(nachher.mitglieder).toEqual(vorher.mitglieder);
  expect(nachher.geraet.geraet_id).toBe(vorher.geraet.geraet_id);
});

test('Abbrechen lässt die alte Datenbank unverändert', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await version2(page);
  await page.reload();
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('alert')).toContainText('Aktualisierung der Daten abgebrochen.');
  expect(await dbVersion(page)).toBe(1);
  expect((await datenbank(page)).mitglieder).toHaveLength(2);
});

test('neues Gerät: keine Rückfrage, Datenbank direkt in der neuen Version', async ({ page, basis }) => {
  await version2(page);
  await page.goto(basis);
  await expect(page.getByRole('heading', { name: 'Willkommen bei µEBS' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await dbVersion(page)).toBe(2);
});
