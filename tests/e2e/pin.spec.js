import { test, expect } from './fixtures.js';
import { datenbank, download, projektDatei, starteMit } from './hilfen.js';

test('PIN sperrt den Admin-Bereich, Sicherung geht ohne PIN, PIN nie in Sicherung oder Projekt', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/admin/einstellungen');
  await page.getByLabel('PIN (4 Ziffern)').fill('1234');
  await page.getByLabel('PIN wiederholen').fill('1234');
  await page.getByRole('button', { name: 'PIN setzen' }).click();
  await expect(page.getByText('PIN gespeichert')).toBeVisible();
  await page.goto(basis + '#/admin');
  await page.getByRole('button', { name: 'Sperren' }).click();
  await page.getByRole('link', { name: 'Admin-Bereich' }).click();
  await expect(page.getByRole('heading', { name: 'Admin-Bereich gesperrt' })).toBeVisible();
  await page.getByLabel('PIN').fill('0000');
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('alert')).toHaveText('PIN falsch');
  // Sicherung ohne PIN von der Startseite
  await page.goto(basis + '#/');
  const s = await download(page, () => page.getByRole('button', { name: 'Sicherung exportieren' }).click());
  expect(s.name).toMatch(/^muebs_sicherung_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
  const geraet = (await datenbank(page)).geraet;
  expect(geraet.pin).toBeTruthy();
  for (const geheim of [JSON.stringify(geraet.pin), String(geraet.geraet_id), '1234', '"pin"']) expect(s.text).not.toContain(geheim);
  await page.goto(basis + '#/admin');
  await page.getByLabel('PIN').fill('1234');
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Admin-Bereich', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Exporte' }).click();
  await page.getByRole('button', { name: 'Leeres Projekt exportieren' }).click();
  const p = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Guthaben übernehmen' }).click());
  for (const geheim of [JSON.stringify(geraet.pin), '"pin"']) expect(p.text).not.toContain(geheim);
});

test('Sperre nach 5 Minuten ohne Eingabe', async ({ page, basis }) => {
  await page.clock.install();
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/admin/einstellungen');
  await page.getByLabel('PIN (4 Ziffern)').fill('4321');
  await page.getByLabel('PIN wiederholen').fill('4321');
  await page.getByRole('button', { name: 'PIN setzen' }).click();
  await expect(page.getByText('PIN gespeichert')).toBeVisible();
  // Kurz vor Ablauf noch offen …
  await page.clock.fastForward('04:00');
  await page.goto(basis + '#/admin/artikel');
  await expect(page.getByRole('heading', { name: 'Artikel', level: 1 })).toBeVisible();
  await page.clock.fastForward('05:10');
  await expect(page.getByRole('heading', { name: 'Admin-Bereich gesperrt' })).toBeVisible();
});
