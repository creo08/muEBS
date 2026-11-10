import { test, expect } from './fixtures.js';
import { datenbank, projektDatei, starteMit } from './hilfen.js';

/** @param {import('@playwright/test').Page} page @param {string} name @param {string} betrag */
async function aufbuchen(page, name, betrag) {
  await page.goto(page.url().split('#')[0] + '#/admin/aufbuchung');
  await page.getByLabel('Mitglied', { exact: true }).selectOption({ label: name });
  await page.getByLabel('Betrag in Euro').fill(betrag);
  await page.getByRole('button', { name: 'Aufbuchen' }).click();
  await expect(page.getByRole('status')).toContainText('aufgebucht');
}

test('Guthabenrechnung und Bestellung bis zur Bestätigung, Doppeltipp bucht nur einmal', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await aufbuchen(page, 'Alex Beispiel (Lexi)', '20');
  await datenbank(page);
  await page.goto(basis + '#/buchen/1');
  await expect(page.locator('#saldo')).toHaveText('20,00 €');
  const bier = page.getByRole('button', { name: 'Bier 3,50 €' });
  await bier.click();
  await bier.click();
  await bier.click();
  await page.getByRole('button', { name: 'Limo 2,50 €' }).click();
  await expect(page.getByRole('button', { name: 'Jetzt 13,00 € buchen' })).toBeEnabled();
  await page.getByRole('button', { name: /Ein Stück Bier entfernen/ }).click();
  await expect(page.getByRole('list', { name: 'Bestellung' })).toContainText('2 × Bier');
  await page.getByRole('button', { name: /Ein Stück Limo entfernen/ }).click();
  await expect(page.getByRole('list', { name: 'Bestellung' })).not.toContainText('Limo');
  await page.getByRole('button', { name: 'Jetzt 7,00 € buchen' }).dblclick();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  const d = await datenbank(page);
  expect(d.buchungen.filter((b) => b.typ === 'artikel')).toHaveLength(1);
  expect(d.buchungen.find((b) => b.typ === 'artikel')).toMatchObject({ menge: 2, preis_pro_einheit: 350, gesamtpreis: -700, artikel_id: 1, storno_von: null });
  expect(d.mitglieder.find((m) => m.id === 1).guthaben).toBe(1300);
  // Hotlist zeigt jetzt Alex
  await expect(page.locator('.kachel')).toHaveText(/Alex Beispiel/);
});

test('Buchen-Seite: unbekannte id führt zur Startseite', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/buchen/99');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
});

test('Buchen ohne Auswahl ist gesperrt und Zurück führt zur Startseite', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/buchen/2');
  await expect(page.getByRole('button', { name: 'Jetzt 0,00 € buchen' })).toBeDisabled();
  await page.getByRole('link', { name: 'Zurück' }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
});
