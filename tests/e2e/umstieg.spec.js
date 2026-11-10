// Phase 3: Umstieg ins Vollsystem. Die erwarteten CSV in tests/fixtures/umstieg-grenzfaelle/ sind gegen einen
// echten Import in Ergo Bibamus (Commit 6ef739e, SQLite und PostgreSQL) geprüft.
import { test, expect } from './fixtures.js';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { projektDatei, starteMit } from './hilfen.js';

const GRENZFAELLE = JSON.parse(readFileSync(new URL('../fixtures/umstieg-grenzfaelle.json', import.meta.url), 'utf8'));

/** @param {import('@playwright/test').Page} page @param {string} name */
async function lade(page, name) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()]);
  return { name: d.suggestedFilename(), bytes: await readFile(await d.path()) };
}

for (const schwaerzung of ['ein', 'aus']) {
  test(`Grenzfälle, Schwärzung ${schwaerzung}: Umstiegs-CSV Byte für Byte wie erwartet`, async ({ page, basis }) => {
    const daten = structuredClone(GRENZFAELLE);
    daten.projekt.schwaerzung_aktiv = schwaerzung === 'ein';
    await starteMit(page, basis, daten);
    await page.goto(basis + '#/admin/exporte');
    for (const datei of ['mitglieder_v2.csv', 'artikel_v1.csv', 'guthaben_v1.csv']) {
      const d = await lade(page, datei);
      const erwartet = await readFile(new URL(`../fixtures/umstieg-grenzfaelle/${schwaerzung}/${datei}`, import.meta.url));
      expect(d.bytes.equals(erwartet), `${schwaerzung}/${datei}`).toBe(true);
    }
  });
}

test('Artikelnamen sind eindeutig: ein zweiter Artikel mit gleichem Namen wird abgelehnt, auch gegen inaktive', async ({ page, basis }) => {
  const p = projektDatei();
  p.artikel[1].aktiv = false;
  await starteMit(page, basis, p);
  await page.goto(basis + '#/admin/artikel/neu');
  await page.locator('#neu-artikel').fill('Limo');
  await page.locator('#neu-preis').fill('2');
  await page.getByRole('button', { name: 'Artikel anlegen' }).click();
  await expect(page.getByRole('alert')).toContainText('Es gibt schon einen Artikel „Limo“ (Nr. 2, inaktiv)');
  // Umbenennen auf einen vergebenen Namen ebenso
  await page.goto(basis + '#/admin/artikel/1');
  await page.getByLabel('Name').fill('Limo');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('alert')).toContainText('Es gibt schon einen Artikel „Limo“');
});

test('Umstieg mit doppelten Artikelnamen (z. B. aus einer alten Sicherung): klare Meldung, kein Download', async ({ page, basis }) => {
  const p = projektDatei();
  p.artikel.push({ id: 3, name: 'Bier', preis: 380, reihenfolge: 3, aktiv: false });
  await starteMit(page, basis, p);
  await page.goto(basis + '#/admin/exporte');
  let downloads = 0;
  page.on('download', () => { downloads++; });
  for (const datei of ['mitglieder_v2.csv', 'artikel_v1.csv', 'guthaben_v1.csv']) {
    await page.getByRole('button', { name: datei }).click();
    await expect(page.getByRole('alert')).toContainText('Doppelt: „Bier“ (Nr. 1, 3)');
  }
  expect(downloads).toBe(0);
});
