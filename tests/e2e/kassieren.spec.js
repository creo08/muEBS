import { test, expect } from './fixtures.js';
import { datenbank, projektDatei, starteMit } from './hilfen.js';

/** @param {import('@playwright/test').Page} page @param {string} basis @param {string[]} artikel */
async function bestelle(page, basis, artikel) {
  await page.goto(basis + '#/buchen/1');
  for (const a of artikel) await page.getByRole('button', { name: a }).click();
  await page.getByRole('button', { name: /^Jetzt .* buchen$/ }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
}

test('Kassieren im Deckel-Modus: voll, teilweise, Storno, Aufstellung seit letztem Stand 0', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei({ modus: 'deckel', schwaerzung_aktiv: false }));
  await bestelle(page, basis, ['Bier 3,50 €', 'Bier 3,50 €']);
  await page.goto(basis + '#/buchen/1');
  await expect(page.getByLabel('Betrag in Euro')).toHaveValue('7,00');
  const aufstellung = page.getByRole('list', { name: 'Aufstellung' });
  await expect(aufstellung).toContainText('2 × Bier');
  await page.getByRole('button', { name: '7,00 € kassiert' }).click();
  await expect(page.locator('#saldo')).toHaveText('Nichts offen');
  await expect(aufstellung).not.toContainText('Bier');

  // Neue Runde: Aufstellung nur seit dem letzten Stand 0
  await bestelle(page, basis, ['Limo 2,50 €', 'Bier 3,50 €']);
  await page.goto(basis + '#/buchen/1');
  await expect(aufstellung).toContainText('1 × Limo');
  await expect(aufstellung).toContainText('1 × Bier');
  await expect(aufstellung).not.toContainText('2 × Bier');
  // Teilzahlung mit geändertem Betrag
  await page.getByLabel('Betrag in Euro').fill('4');
  await page.getByRole('button', { name: '4,00 € kassiert' }).click();
  await expect(page.locator('#saldo')).toHaveText('offen 2,00 €');
  await expect(aufstellung).toContainText('Zahlung');
  await expect(aufstellung).toContainText('Offen2,00 €');
  // Teilzahlung stornieren
  await page.getByRole('button', { name: 'Storno', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stornieren' }).click();
  await expect(page.locator('#saldo')).toHaveText('offen 6,00 €');
  await datenbank(page);

  // Kassierliste
  await page.goto(basis + '#/kassierliste');
  await expect(page.getByText('Summe offen: 6,00 €')).toBeVisible();
  await expect(page.getByText(/Kassiert seit .*: 7,00 €/)).toBeVisible();
  await page.getByRole('button', { name: 'bezahlt' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bezahlt' }).click();
  await expect(page.getByText('Niemand hat etwas offen.')).toBeVisible();
  await expect(page.getByText(/Kassiert seit .*: 13,00 €/)).toBeVisible();
  await datenbank(page);
  // Guthaben im Deckel-Modus
  await page.goto(basis + '#/buchen/2');
  await page.getByLabel('Betrag in Euro').fill('5');
  await page.getByRole('button', { name: '5,00 € kassiert' }).click();
  await expect(page.locator('#saldo')).toHaveText('Guthaben 5,00 €');
});

test('Vorauszahlung: kein Kassieren und keine Kassierliste', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await expect(page.getByRole('link', { name: 'Kassierliste' })).toHaveCount(0);
  await page.goto(basis + '#/buchen/1');
  await expect(page.getByRole('heading', { name: 'Kassieren' })).toHaveCount(0);
  await expect(page.locator('#saldo')).toHaveText('0,00 €');
});
