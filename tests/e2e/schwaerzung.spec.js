import { test, expect } from './fixtures.js';
import { datenbank, projektDatei, starteMit } from './hilfen.js';

/** Projekt mit Alex bei -25,00 € (unter der Grenze -20,00 €). */
function geschwaerzt(aktiv = true, modus = 'deckel') {
  const p = projektDatei({ modus, schwaerzung_aktiv: aktiv });
  p.typ = 'sicherung';
  p.mitglieder[0].guthaben = -2500;
  p.mitglieder[0].geschwaerzt = true;
  p.buchungen.push({ id: '0b6b2c1e-3f5d-4a8e-9c1b-2d3e4f5a6b7c', geraet_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', typ: 'uebertrag', mitglied_id: 1, artikel_id: null, storno_von: null, menge: 1, preis_pro_einheit: -2500, gesamtpreis: -2500, zeitstempel: '2026-01-01T10:00:00.000Z' });
  return p;
}

test('Schwärzung ein: geschwärzt kann keine Artikel buchen, aber kassieren und aufbuchen', async ({ page, basis }) => {
  await starteMit(page, basis, geschwaerzt());
  await page.getByLabel('Mitglied suchen').fill('Alex');
  await expect(page.locator('.kachel')).toHaveClass(/geschwaerzt/);
  await page.locator('.kachel').click();
  await expect(page.getByRole('alert')).toContainText('Geschwärzt');
  await expect(page.getByRole('button', { name: 'Bier 3,50 €' })).toBeDisabled();
  // Teilzahlung: bleibt geschwärzt bis guthaben >= 0
  await page.getByLabel('Betrag in Euro').fill('10');
  await page.getByRole('button', { name: '10,00 € kassiert' }).click();
  await expect(page.locator('#saldo')).toHaveText('offen 15,00 €');
  await expect(page.getByRole('button', { name: 'Bier 3,50 €' })).toBeDisabled();
  // Aufbuchung im Admin-Bereich bleibt möglich und hebt bei >= 0 auf
  await page.goto(basis + '#/admin/aufbuchung');
  await page.getByLabel('Mitglied', { exact: true }).selectOption({ label: 'Alex Beispiel (Lexi)' });
  await page.getByLabel('Betrag in Euro').fill('15');
  await page.getByRole('button', { name: 'Aufbuchen' }).click();
  await expect(page.getByRole('status')).toContainText('aufgebucht');
  await page.goto(basis + '#/buchen/1');
  await expect(page.getByRole('button', { name: 'Bier 3,50 €' })).toBeEnabled();
  const d = await datenbank(page);
  expect(d.mitglieder[0]).toMatchObject({ guthaben: 0, geschwaerzt: false });
});

test('Schwärzung aus: keine schwarze Kachel, Buchen möglich', async ({ page, basis }) => {
  await starteMit(page, basis, geschwaerzt(false));
  await page.getByLabel('Mitglied suchen').fill('Alex');
  await expect(page.locator('.kachel')).not.toHaveClass(/geschwaerzt/);
  await page.locator('.kachel').click();
  await page.getByRole('button', { name: 'Bier 3,50 €' }).click();
  await page.getByRole('button', { name: 'Jetzt 3,50 € buchen' }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  expect((await datenbank(page)).mitglieder[0].guthaben).toBe(-2850);
});

test('Schwärzung in den Einstellungen einschalten schwärzt sofort', async ({ page, basis }) => {
  await starteMit(page, basis, geschwaerzt(false, 'vorauszahlung'));
  await page.goto(basis + '#/admin/einstellungen');
  await expect(page.locator('#speicher-status')).not.toBeEmpty();
  await page.getByLabel('Schwärzung ein').check();
  await page.getByLabel('Schwärzungsgrenze in Euro (0 oder negativ)').fill('-30');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.getByText('Einstellungen gespeichert')).toBeVisible();
  expect((await datenbank(page)).mitglieder[0].geschwaerzt).toBe(false);
  await page.getByLabel('Schwärzungsgrenze in Euro (0 oder negativ)').fill('-20');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.getByText('Einstellungen gespeichert')).toBeVisible();
  expect((await datenbank(page)).mitglieder[0].geschwaerzt).toBe(true);
  await page.getByLabel('Schwärzungsgrenze in Euro (0 oder negativ)').fill('5');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.getByRole('alert')).toContainText('0 oder negativ');
});
