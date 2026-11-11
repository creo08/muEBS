import { test, expect, DEMO } from './fixtures.js';
import { datenbank, download, projektDatei, starteMit } from './hilfen.js';

test('neues Projekt Schritt für Schritt, dann Mitglieder und Artikel anlegen', async ({ page, basis }) => {
  await page.goto(basis);
  await page.getByRole('link', { name: 'Neues Projekt' }).click();
  await expect(page.getByRole('heading', { name: /Schritt 1 von 4/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hilfe: Modus' })).toHaveAttribute('href', 'https://github.com/creo08/muEBS/blob/v1.0.0/docs/stricheln-und-kassieren.md');
  await page.getByLabel('Deckel: stricheln, dann zahlen').check();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Farbschema').selectOption('gruen');
  await expect(page.locator('html')).toHaveAttribute('data-schema', 'gruen');
  await page.getByRole('button', { name: 'Weiter' }).click();
  // Deckel: Schwärzung standardmäßig aus
  await expect(page.getByLabel('Schwärzung ein')).not.toBeChecked();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Mitglieder und Artikel anlegen' })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).first().fill('Alex Beispiel');
  await page.getByRole('button', { name: 'Mitglied anlegen' }).click();
  await expect(page.getByText('Alex Beispiel angelegt (Nr. 1)')).toBeVisible();
  await page.locator('#neu-artikel').fill('Bier');
  await page.locator('#neu-preis').fill('3,5');
  await page.getByRole('button', { name: 'Artikel anlegen' }).click();
  await expect(page.getByText('Bier angelegt (Nr. 1)')).toBeVisible();
  await page.getByRole('link', { name: 'Fertig' }).click();
  // auch ohne Buchungen ist der Bildschirm mit den aktiven Mitgliedern gefüllt
  await expect(page.locator('.kachel .name')).toHaveText(['Alex Beispiel']);
  await page.getByLabel('Mitglied suchen').fill('lex');
  await expect(page.locator('.kachel')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Kassierliste' })).toBeVisible();
});

test('Text mit Formelzeichen am Anfang wird abgelehnt', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/admin/mitglieder/neu');
  await page.locator('#neu-name').fill('=HYPERLINK("x")');
  await page.getByRole('button', { name: 'Mitglied anlegen' }).click();
  await expect(page.getByRole('alert')).toHaveText('Name darf nicht mit = + - @ beginnen');
});

test('Sicherung/Projekt laden auf der Init-Seite', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.getByLabel('Mitglied suchen').fill('Bente');
  await expect(page.locator('.kachel')).toHaveText(/Bente Muster/);
  await datenbank(page);
});

test('Demo starten und beenden ohne Einfluss auf echte Daten; Demo-Export wird in echt abgelehnt', async ({ page, basis }) => {
  await page.goto(basis);
  await page.getByRole('button', { name: 'Demo ansehen' }).click();
  await expect(page.locator('#demo-banner')).toBeVisible();
  // Hotlist ist gefüllt, weil die Zeitstempel verschoben wurden
  await expect(page.locator('.kachel').first()).toBeVisible();
  await expect(page.locator('.geschwaerzt').first()).toBeVisible();
  const demo = await datenbank(page, 'muebs_demo');
  expect(demo.buchungen.length).toBe(DEMO.buchungen.length);
  const echt = await datenbank(page, 'muebs');
  expect(echt.mitglieder).toEqual([]);
  const sicherung = await download(page, () => page.getByRole('button', { name: 'Sicherung exportieren' }).click());
  expect(sicherung.name).toMatch(/^muebs_demo_sicherung_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
  expect(JSON.parse(sicherung.text).demo).toBe(true);
  await page.getByRole('button', { name: 'Demo beenden' }).click();
  await expect(page.getByRole('heading', { name: 'Willkommen bei µEBS' })).toBeVisible();
  await expect(page.locator('#demo-banner')).toBeHidden();
  const namen = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(namen).not.toContain('muebs_demo');
  await page.getByLabel('Sicherung/Projekt laden (.json)').setInputFiles({ name: sicherung.name, mimeType: 'application/json', buffer: Buffer.from(sicherung.text) });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Demo-Daten können nicht als echte Daten geladen werden');
  expect((await datenbank(page)).mitglieder).toEqual([]);
});

test('Datenschutz ist von der Init-Seite und aus dem Admin-Bereich erreichbar', async ({ page, basis }) => {
  await page.goto(basis);
  await page.getByRole('link', { name: 'Datenschutz' }).click();
  await expect(page.getByText('GitHub protokolliert beim Laden der App die IP-Adresse.')).toBeVisible();
  await page.getByRole('link', { name: 'Zurück' }).click();
  await starteMit(page, basis, projektDatei());
  await page.getByRole('link', { name: 'Admin-Bereich' }).click();
  await page.getByRole('link', { name: 'Datenschutz' }).click();
  await expect(page.getByText('Eine geschwärzte Kachel sehen alle, die an der Schank stehen.')).toBeVisible();
});
