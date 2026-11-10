// Migration der Datenbank: Eine höhere DB_VERSION wird per Route in js/konstanten.js eingesetzt;
// dazu die echte Migration von Version 1 (v0.1.0) auf Version 2.
import { test, expect } from './fixtures.js';
import { datenbank, download, projektDatei, starteMit } from './hilfen.js';

// Ohne Service Worker, damit die Route jede Anfrage nach konstanten.js sieht
test.use({ serviceWorkers: 'block' });

/** @param {import('@playwright/test').Page} page */
async function hoehereVersion(page) {
  await page.route('**/js/konstanten.js', async (route) => {
    const antwort = await route.fetch();
    const text = await antwort.text();
    expect(text).toContain('DB_VERSION = 2;');
    await route.fulfill({ response: antwort, body: text.replace('DB_VERSION = 2;', 'DB_VERSION = 3;') });
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
  await hoehereVersion(page);
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('Vorher sichern?');
  const s = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Sicherung herunterladen' }).click());
  expect(s.name).toMatch(/^muebs_sicherung_/);
  expect(JSON.parse(s.text).mitglieder).toEqual(vorher.mitglieder);
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  expect(await dbVersion(page)).toBe(3);
  const nachher = await datenbank(page);
  expect(nachher.mitglieder).toEqual(vorher.mitglieder);
  expect(nachher.geraet.geraet_id).toBe(vorher.geraet.geraet_id);
});

test('Abbrechen lässt die alte Datenbank unverändert', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await hoehereVersion(page);
  await page.reload();
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('alert')).toContainText('Aktualisierung der Daten abgebrochen.');
  expect(await dbVersion(page)).toBe(2);
  expect((await datenbank(page)).mitglieder).toHaveLength(2);
});

test('neues Gerät: keine Rückfrage, Datenbank direkt in der neuen Version', async ({ page, basis }) => {
  await hoehereVersion(page);
  await page.goto(basis);
  await expect(page.getByRole('heading', { name: 'Willkommen bei µEBS' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await dbVersion(page)).toBe(3);
});

test('echte Migration von Version 1 (v0.1.0): Schwärzungs-Merker aus dem Verlauf neu bestimmt', async ({ page, basis }) => {
  // eine Datenbank im Zustand von v0.1.0 anlegen, bevor die App sie öffnet
  await page.goto(basis + 'version.json');
  await page.evaluate(() => new Promise((ok, nein) => {
    const r = indexedDB.open('muebs', 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('geraet');
      db.createObjectStore('projekt');
      db.createObjectStore('mitglied', { keyPath: 'id' });
      db.createObjectStore('artikel', { keyPath: 'id' });
      const b = db.createObjectStore('buchung', { keyPath: 'id' });
      b.createIndex('mitglied_id', 'mitglied_id');
      b.createIndex('zeitstempel', 'zeitstempel');
      const g = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
      r.transaction.objectStore('geraet').put(g, 'geraet_id');
      r.transaction.objectStore('projekt').put({ farbschema: 'violett', modus: 'vorauszahlung', schwaerzung_aktiv: true, schwaerzungs_grenze: -2000 }, 'einstellungen');
      r.transaction.objectStore('artikel').put({ id: 1, name: 'Bier', preis: 350, reihenfolge: 1, aktiv: true });
      // v0.1.0: Storno der auslösenden Buchung ließ den Merker stehen
      r.transaction.objectStore('mitglied').put({ id: 1, name: 'Alex Beispiel', nickname: '', aktiv: true, guthaben: -1000, geschwaerzt: true });
      const basis = { geraet_id: g, mitglied_id: 1, storno_von: null, menge: 1 };
      b.put({ ...basis, id: 'a0000000-0000-4000-8000-000000000001', typ: 'uebertrag', artikel_id: null, preis_pro_einheit: -1000, gesamtpreis: -1000, zeitstempel: '2026-01-01T10:00:00.000Z' });
      b.put({ ...basis, id: 'a0000000-0000-4000-8000-000000000002', typ: 'artikel', artikel_id: 1, menge: 5, preis_pro_einheit: 350, gesamtpreis: -1750, zeitstempel: '2026-01-01T11:00:00.000Z' });
      b.put({ ...basis, id: 'a0000000-0000-4000-8000-000000000003', typ: 'storno', artikel_id: null, storno_von: 'a0000000-0000-4000-8000-000000000002', preis_pro_einheit: 0, gesamtpreis: 0, zeitstempel: '2026-01-01T12:00:00.000Z' });
    };
    r.onsuccess = () => { r.result.close(); ok(undefined); };
    r.onerror = () => nein(r.error);
  }));
  await page.goto(basis);
  await expect(page.getByRole('dialog')).toContainText('Vorher sichern?');
  await page.getByRole('dialog').getByRole('button', { name: 'Ohne Sicherung weiter' }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  expect(await dbVersion(page)).toBe(2);
  const d = await datenbank(page);
  expect(d.mitglieder[0]).toMatchObject({ guthaben: -1000, geschwaerzt: false });
  await page.getByLabel('Mitglied suchen').fill('Alex');
  await expect(page.locator('.kachel')).not.toHaveClass(/geschwaerzt/);
});

test('Wächter ruht, solange „Vorher sichern?“ auf eine Antwort wartet', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await hoehereVersion(page);
  await page.clock.install();
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('Vorher sichern?');
  // länger überlegen als der Wächter wartet
  await page.clock.fastForward('00:30');
  await expect(page.getByRole('heading', { name: 'µEBS kann nicht starten' })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Ohne Sicherung weiter' }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  await page.clock.fastForward('00:30');
  await expect(page.getByRole('heading', { name: 'µEBS kann nicht starten' })).toHaveCount(0);
});
