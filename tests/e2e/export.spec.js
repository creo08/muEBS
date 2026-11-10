import { test, expect } from './fixtures.js';
import { datenbank, download, projektDatei, starteMit } from './hilfen.js';

const BOM = '\uFEFF';

/** Projekt mit Formelzeichen im Spitznamen und Anführungszeichen, Alex -7,00 €, Bente +5,00 €. */
function daten() {
  const p = projektDatei();
  p.typ = 'sicherung';
  p.mitglieder[0].nickname = 'Lexi "Chef"';
  p.mitglieder[1].nickname = 'Bente; @home';
  p.artikel[0].name = 'Bier "Hell"';
  p.mitglieder[0].guthaben = -700;
  p.mitglieder[1].guthaben = 500;
  const g = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  p.buchungen = [
    { id: 'a0000000-0000-4000-8000-000000000001', geraet_id: g, typ: 'artikel', mitglied_id: 1, artikel_id: 1, storno_von: null, menge: 2, preis_pro_einheit: 350, gesamtpreis: -700, zeitstempel: '2026-01-01T10:00:00.000Z' },
    { id: 'a0000000-0000-4000-8000-000000000002', geraet_id: g, typ: 'zahlung', mitglied_id: 2, artikel_id: null, storno_von: null, menge: 1, preis_pro_einheit: 500, gesamtpreis: 500, zeitstempel: '2026-01-01T11:00:00.000Z' },
  ];
  return p;
}

/** @param {string} text */
const zeilen = (text) => {
  expect(text.startsWith(BOM)).toBe(true);
  expect(text.endsWith('\r\n')).toBe(true);
  expect(text.replaceAll('\r\n', '')).not.toContain('\n');
  return text.slice(1).split('\r\n').slice(0, -1);
};

test('Umstiegs-CSV mit den Spalten des Vollsystems und Schutz gegen Formel-Injection', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  await page.goto(basis + '#/admin/exporte');
  await expect(page.getByRole('link', { name: 'https://github.com/relaxin101/barsystem' })).toHaveAttribute('href', 'https://github.com/relaxin101/barsystem');
  await expect(page.getByRole('link', { name: 'Hilfe: Umstieg' })).toHaveAttribute('href', /docs\/umstieg-ins-vollsystem\.md$/);
  const m = await download(page, () => page.getByRole('button', { name: 'mitglieder_v1.csv' }).click());
  expect(m.name).toBe('mitglieder_v1.csv');
  expect(zeilen(m.text)).toEqual([
    '"id";"name";"nickname";"aktiv";"schwaerzungs_grenze"',
    '1;"Alex Beispiel";"Lexi ""Chef""";1;-20,00',
    '2;"Bente Muster";"Bente; @home";1;-20,00',
  ]);
  const a = await download(page, () => page.getByRole('button', { name: 'artikel_v1.csv' }).click());
  expect(zeilen(a.text)).toEqual([
    '"id";"reihenfolge";"name";"preis";"aktiv";"typ"',
    '1;1;"Bier ""Hell""";3,50;1;"stueck"',
    '2;2;"Limo";2,50;1;"stueck"',
  ]);
  const g = await download(page, () => page.getByRole('button', { name: 'guthaben_v1.csv' }).click());
  expect(zeilen(g.text)).toEqual(['"id";"betrag"', '1;-7,00', '2;5,00']);
});

test('Schwärzung aus: schwaerzungs_grenze leer', async ({ page, basis }) => {
  const d = daten();
  d.projekt.schwaerzung_aktiv = false;
  await starteMit(page, basis, d);
  await page.goto(basis + '#/admin/exporte');
  const m = await download(page, () => page.getByRole('button', { name: 'mitglieder_v1.csv' }).click());
  expect(zeilen(m.text)[1]).toBe('1;"Alex Beispiel";"Lexi ""Chef""";1;');
});

test('Formel-Injection: gefährlicher Anfang wird in allen CSV mit \' entschärft', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  // Spitznamen mit Formelzeichen lassen sich nicht anlegen; die Maskierung prüfen wir an der Funktion direkt
  const ergebnis = await page.evaluate(async () => {
    const { textFeld } = await import('./js/csv.js');
    return ['=1+1', '+1', '-1', '@SUMME(A1)', '\tx', '\rx', 'a"b', 'normal'].map(textFeld);
  });
  expect(ergebnis).toEqual(['"\'=1+1"', '"\'+1"', '"\'-1"', '"\'@SUMME(A1)"', '"\'\tx"', '"\'\rx"', '"a""b"', '"normal"']);
});

test('Leeres Projekt mit Guthaben auf 0 exportiert abrechnung_v1.csv', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  await page.goto(basis + '#/admin/exporte');
  await page.getByRole('button', { name: 'Leeres Projekt exportieren' }).click();
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.getByRole('dialog').getByRole('button', { name: 'Guthaben auf 0 setzen' }).click();
  await expect.poll(() => downloads.length).toBe(2);
  const { readFile } = await import('node:fs/promises');
  const [projekt, abrechnung] = downloads;
  expect(projekt.suggestedFilename()).toMatch(/^muebs_projekt_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
  const p = JSON.parse(await readFile(await projekt.path(), 'utf8'));
  expect(p.typ).toBe('projekt');
  expect(p.buchungen).toEqual([]);
  expect(p.mitglieder.map((m) => m.guthaben)).toEqual([0, 0]);
  expect(abrechnung.suggestedFilename()).toBe('abrechnung_v1.csv');
  expect(zeilen(await readFile(await abrechnung.path(), 'utf8'))).toEqual([
    '"id";"name";"nickname";"guthaben";"offen";"bezahlt"',
    '1;"Alex Beispiel";"Lexi ""Chef""";-7,00;7,00;0,00',
    '2;"Bente Muster";"Bente; @home";5,00;0,00;5,00',
  ]);
  // das leere Projekt lässt sich laden
  await page.goto(basis + '#/admin/laden');
  await page.getByLabel('Datei (.json)').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(p)) });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ohne Sicherung weiter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByText('Daten geladen')).toBeVisible();
  expect((await datenbank(page)).buchungen).toEqual([]);
});

test('Leeres Projekt mit übernommenen Guthaben: je Saldo ≠ 0 eine Buchung uebertrag', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  await page.goto(basis + '#/admin/exporte');
  await page.getByRole('button', { name: 'Leeres Projekt exportieren' }).click();
  const p = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Guthaben übernehmen' }).click());
  const datei = JSON.parse(p.text);
  expect(datei.buchungen.map((b) => [b.typ, b.mitglied_id, b.gesamtpreis])).toEqual([['uebertrag', 1, -700], ['uebertrag', 2, 500]]);
  await page.goto(basis + '#/admin/laden');
  await page.getByLabel('Datei (.json)').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(p.text) });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ohne Sicherung weiter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByText('Daten geladen')).toBeVisible();
  const d = await datenbank(page);
  expect(d.mitglieder.map((m) => m.guthaben)).toEqual([-700, 500]);
  // Übertrag ist stornierbar wie jede Buchung
  await page.goto(basis + '#/buchen/1');
  await page.getByRole('button', { name: 'Storno', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stornieren' }).click();
  await expect(page.locator('#saldo')).toHaveText('0,00 €');
  await datenbank(page);
});
