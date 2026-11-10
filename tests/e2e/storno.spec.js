import { test, expect } from './fixtures.js';
import { datenbank, projektDatei, starteMit } from './hilfen.js';

/** @param {import('@playwright/test').Page} page @param {string} knopf @param {string} bestaetigen */
async function schalte(page, knopf, bestaetigen) {
  await page.getByRole('button', { name: knopf, exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: bestaetigen }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('Storno von Artikel und Zahlung, aufheben und erneut stornieren – Guthaben stimmt nach jedem Schritt', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei({ modus: 'deckel', schwaerzung_aktiv: false }));
  await page.goto(basis + '#/buchen/1');
  await page.getByRole('button', { name: 'Bier 3,50 €' }).click();
  await page.getByRole('button', { name: 'Jetzt 3,50 € buchen' }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  await page.goto(basis + '#/buchen/1');
  await expect(page.locator('#saldo')).toHaveText('offen 3,50 €');

  // Storno mit Rückfrage; Abbrechen ändert nichts
  await page.getByRole('button', { name: 'Storno', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
  expect((await datenbank(page)).buchungen).toHaveLength(1);

  await schalte(page, 'Storno', 'Stornieren');
  await expect(page.locator('#saldo')).toHaveText('Nichts offen');
  await expect(page.locator('tr.storniert')).toHaveCount(1);
  let d = await datenbank(page);
  expect(d.buchungen.find((b) => b.typ === 'storno')).toMatchObject({ gesamtpreis: 0, artikel_id: null });

  await schalte(page, 'Storno aufheben', 'Storno aufheben');
  await expect(page.locator('#saldo')).toHaveText('offen 3,50 €');
  await expect(page.locator('tr.storniert')).toHaveCount(0);
  await datenbank(page);

  await schalte(page, 'Storno', 'Stornieren');
  await expect(page.locator('#saldo')).toHaveText('Nichts offen');
  d = await datenbank(page);
  expect(d.buchungen.filter((b) => b.typ === 'storno')).toHaveLength(3);

  // Zahlung stornieren
  await schalte(page, 'Storno aufheben', 'Storno aufheben');
  await page.getByRole('button', { name: '3,50 € kassiert' }).click();
  await expect(page.locator('#saldo')).toHaveText('Nichts offen');
  await schalte(page, 'Storno', 'Stornieren');
  await expect(page.locator('#saldo')).toHaveText('offen 3,50 €');
  await schalte(page, 'Storno aufheben', 'Storno aufheben');
  await expect(page.locator('#saldo')).toHaveText('Nichts offen');
  await datenbank(page);
});

test('Ein Storno-Eintrag kann nicht storniert werden', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  const ergebnis = await page.evaluate(async () => {
    const db = await import('./js/db.js');
    const h = { blockiert: () => {}, vorMigration: async () => true };
    const d = await db.oeffne('muebs', h);
    await db.bucheBetrag(d, crypto.randomUUID(), 1, 'aufbuchung', 500);
    const [b] = await db.buchungenVon(d, 1);
    await db.schalteStorno(d, crypto.randomUUID(), b.id);
    const storno = (await db.buchungenVon(d, 1)).find((x) => x.typ === 'storno');
    try {
      await db.schalteStorno(d, crypto.randomUUID(), storno.id);
      return 'angenommen';
    } catch (f) {
      return f.message;
    } finally {
      d.close();
    }
  });
  expect(ergebnis).toBe('Ein Storno-Eintrag kann nicht storniert werden');
  const d = await datenbank(page);
  expect(d.buchungen).toHaveLength(2);
});
