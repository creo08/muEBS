import { test, expect } from './fixtures.js';
import { datenbank, projektDatei, starteMit } from './hilfen.js';

test('Einstellungen: ungespeicherte Änderungen beim Verlassen speichern, verwerfen oder bleiben', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/admin/einstellungen');
  await page.getByLabel('Deckel (stricheln, dann zahlen)').check();
  // Bleiben: Seite und Eingabe bleiben erhalten
  await page.getByRole('navigation', { name: 'Admin-Bereich' }).getByRole('link', { name: 'Exporte' }).click();
  await expect(page.getByRole('dialog')).toContainText('ungespeicherte Änderungen');
  await page.getByRole('dialog').getByRole('button', { name: 'Bleiben' }).click();
  await expect(page).toHaveURL(/#\/admin\/einstellungen$/);
  await expect(page.getByLabel('Deckel (stricheln, dann zahlen)')).toBeChecked();
  // Speichern: wird gespeichert, dann geht es weiter
  await page.getByRole('link', { name: 'Exporte' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name: 'Exporte', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kassierliste' })).toBeVisible();
  // Verwerfen: Farbschema-Vorschau wird zurückgesetzt, nichts gespeichert
  await page.goto(basis + '#/admin/einstellungen');
  await page.getByLabel('Farbschema').selectOption('rot');
  await expect(page.locator('html')).toHaveAttribute('data-schema', 'rot');
  await page.getByRole('link', { name: 'µEBS, zur Startseite' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-schema', 'violett');
  // ohne Änderungen keine Rückfrage
  await page.goto(basis + '#/admin/einstellungen');
  await page.getByRole('link', { name: 'Artikel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Artikel', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Mitglied bearbeiten: ungespeicherte Änderung wird beim Verlassen gespeichert', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/admin/mitglieder/2');
  await page.getByLabel('Spitzname').fill('Bee');
  await page.getByRole('link', { name: 'Zur Liste' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Bente Muster' })).toContainText('Bee');
  expect((await datenbank(page)).mitglieder[1].nickname).toBe('Bee');
});

test('Aufbuchung mit Mitgliedersuche, nur aktive Mitglieder', async ({ page, basis }) => {
  const p = projektDatei();
  p.mitglieder[1].aktiv = false;
  await starteMit(page, basis, p);
  await page.goto(basis + '#/admin/aufbuchung');
  await page.getByLabel('Mitglied suchen').fill('bente');
  await expect(page.getByText('Kein aktives Mitglied gefunden.')).toBeVisible();
  await page.getByLabel('Mitglied suchen').fill('lex');
  await page.getByRole('button', { name: /Alex Beispiel \(Lexi\)/ }).click();
  await page.getByLabel('Betrag in Euro').fill('12,5');
  await page.getByRole('button', { name: 'Aufbuchen' }).click();
  await expect(page.getByText('12,50 € für Alex Beispiel aufgebucht')).toBeVisible();
  // nach dem Aufbuchen wieder bereit für das nächste Mitglied
  await expect(page.getByLabel('Mitglied suchen')).toBeFocused();
  expect((await datenbank(page)).mitglieder[0].guthaben).toBe(1250);
  // direkter Einstieg aus der Mitglieder-Seite
  await page.goto(basis + '#/admin/mitglieder/1');
  await page.getByRole('link', { name: 'Aufbuchen' }).click();
  await expect(page.getByText('Stand: 12,50 €')).toBeVisible();
});

test('Admin-Navigation auf dem Handy: Übersicht als Liste, Unterseiten mit Zurück', async ({ page, basis }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await starteMit(page, basis, projektDatei());
  await page.getByRole('link', { name: 'Admin-Bereich' }).click();
  const nav = page.getByRole('navigation', { name: 'Admin-Bereich' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Mitglieder' }).click();
  await expect(nav).toBeHidden();
  await page.getByRole('link', { name: 'Zurück zum Admin-Bereich' }).click();
  await expect(nav).toBeVisible();
});
