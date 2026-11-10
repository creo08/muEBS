import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrechnungCsv, csvDatei, textFeld } from '../../js/csv.js';
import { artikelCsv, guthabenCsv, mitgliederCsv, ARTIKEL_SPALTEN, GUTHABEN_SPALTEN, MITGLIEDER_SPALTEN } from '../../js/umstieg.js';

test('Textfeld: Anführungszeichen verdoppeln, Formelanfang mit \' entschärfen', () => {
  assert.equal(textFeld('a"b'), '"a""b"');
  for (const z of ['=', '+', '-', '@', '\t', '\r']) assert.equal(textFeld(`${z}x`), `"'${z}x"`);
  assert.equal(textFeld('x=1'), '"x=1"');
  assert.equal(textFeld(''), '""');
});

test('CSV-Datei: BOM, Semikolon, CRLF', () => {
  assert.equal(csvDatei(['a', 'b'], [['1', '"x"']]), '\uFEFF"a";"b"\r\n1;"x"\r\n');
});

const mitglieder = [
  { id: 1, name: 'Alex', nickname: '', aktiv: true, guthaben: -700, geschwaerzt: false },
  { id: 2, name: 'Bente', nickname: 'B', aktiv: false, guthaben: 0, geschwaerzt: false },
];

test('Umstieg: Spalten wie im Vollsystem', () => {
  assert.deepEqual(MITGLIEDER_SPALTEN, ['id', 'name', 'nickname', 'aktiv', 'schwaerzungs_grenze']);
  assert.deepEqual(ARTIKEL_SPALTEN, ['id', 'reihenfolge', 'name', 'preis', 'aktiv', 'typ']);
  assert.deepEqual(GUTHABEN_SPALTEN, ['id', 'betrag']);
  const projekt = { farbschema: 'violett', modus: 'deckel', schwaerzung_aktiv: true, schwaerzungs_grenze: -2000 };
  assert.equal(mitgliederCsv(mitglieder, projekt), '\uFEFF"id";"name";"nickname";"aktiv";"schwaerzungs_grenze"\r\n1;"Alex";"";1;-20,00\r\n2;"Bente";"B";0;-20,00\r\n');
  assert.match(mitgliederCsv(mitglieder, { ...projekt, schwaerzung_aktiv: false }), /\r\n1;"Alex";"";1;\r\n/);
  assert.equal(artikelCsv([{ id: 3, name: 'Bier', preis: 350, reihenfolge: 2, aktiv: true }]), '\uFEFF"id";"reihenfolge";"name";"preis";"aktiv";"typ"\r\n3;2;"Bier";3,50;1;"stueck"\r\n');
  assert.equal(guthabenCsv(mitglieder), '\uFEFF"id";"betrag"\r\n1;-7,00\r\n');
});

test('Abrechnung: guthaben, offen, bezahlt', () => {
  const zahlung = { id: 'z', geraet_id: 'g', typ: 'zahlung', mitglied_id: 2, artikel_id: null, storno_von: null, menge: 1, preis_pro_einheit: 300, gesamtpreis: 300, zeitstempel: '2026-01-01T10:00:00.000Z' };
  const csv = abrechnungCsv(mitglieder, [zahlung]);
  assert.equal(csv, '\uFEFF"id";"name";"nickname";"guthaben";"offen";"bezahlt"\r\n1;"Alex";"";-7,00;7,00;0,00\r\n2;"Bente";"B";0,00;0,00;3,00\r\n');
});
