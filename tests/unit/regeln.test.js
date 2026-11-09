import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aufstellung, gesamtpreis, hotlist, kassiertagBeginn, salden, schwaerzung, speicherFehlerText, stornierte, textFehler } from '../../js/regeln.js';

let n = 0;
/** @param {Partial<import('../../js/regeln.js').Buchung>} b */
const buchung = (b) => ({ id: `id-${++n}`, geraet_id: 'g', typ: 'artikel', mitglied_id: 1, artikel_id: 1, storno_von: null, menge: 1, preis_pro_einheit: 100, gesamtpreis: -100, zeitstempel: `2026-01-01T10:00:${String(n).padStart(2, '0')}.000Z`, ...b });

test('Vorzeichen: Artikel negativ, Einzahlungen positiv, Storno 0', () => {
  assert.equal(gesamtpreis('artikel', 3, 350), -1050);
  assert.equal(gesamtpreis('aufbuchung', 1, 2000), 2000);
  assert.equal(gesamtpreis('zahlung', 1, 700), 700);
  assert.equal(gesamtpreis('uebertrag', 1, -700), -700);
  assert.equal(gesamtpreis('storno', 1, 0), 0);
});

test('Storno schaltet um: ungerade Anzahl = storniert', () => {
  const a = buchung({});
  const s1 = buchung({ typ: 'storno', storno_von: a.id, gesamtpreis: 0, artikel_id: null });
  const s2 = buchung({ typ: 'storno', storno_von: a.id, gesamtpreis: 0, artikel_id: null });
  const s3 = buchung({ typ: 'storno', storno_von: a.id, gesamtpreis: 0, artikel_id: null });
  assert.ok(stornierte([a, s1]).has(a.id));
  assert.ok(!stornierte([a, s1, s2]).has(a.id));
  assert.ok(stornierte([a, s1, s2, s3]).has(a.id));
});

test('Saldo = Summe der nicht stornierten Buchungen', () => {
  const auf = buchung({ typ: 'aufbuchung', artikel_id: null, preis_pro_einheit: 2000, gesamtpreis: 2000 });
  const bier = buchung({ menge: 2, preis_pro_einheit: 350, gesamtpreis: -700 });
  const limo = buchung({ gesamtpreis: -250, preis_pro_einheit: 250 });
  const storno = buchung({ typ: 'storno', storno_von: limo.id, gesamtpreis: 0, artikel_id: null });
  const anderer = buchung({ mitglied_id: 2, gesamtpreis: -100 });
  const s = salden([auf, bier, limo, storno, anderer]);
  assert.equal(s.get(1), 1300);
  assert.equal(s.get(2), -100);
});

test('Schwärzung mit Hysterese: an unter Grenze, aus erst bei >= 0', () => {
  assert.equal(schwaerzung(false, -2001, -2000), true);
  assert.equal(schwaerzung(false, -2000, -2000), false);
  assert.equal(schwaerzung(true, -1000, -2000), true);
  assert.equal(schwaerzung(true, -1, -2000), true);
  assert.equal(schwaerzung(true, 0, -2000), false);
  assert.equal(schwaerzung(false, -1, 0), true);
});

test('Kassiertag beginnt um 06:00 Ortszeit', () => {
  assert.deepEqual(kassiertagBeginn(new Date(2026, 2, 10, 5, 59)), new Date(2026, 2, 9, 6, 0));
  assert.deepEqual(kassiertagBeginn(new Date(2026, 2, 10, 6, 0)), new Date(2026, 2, 10, 6, 0));
  assert.deepEqual(kassiertagBeginn(new Date(2026, 2, 10, 23, 30)), new Date(2026, 2, 10, 6, 0));
  assert.deepEqual(kassiertagBeginn(new Date(2026, 0, 1, 2, 0)), new Date(2025, 11, 31, 6, 0));
});

test('Aufstellung seit dem letzten Zeitpunkt mit guthaben >= 0', () => {
  const namen = new Map([[1, 'Bier'], [2, 'Limo']]);
  const alt = buchung({ gesamtpreis: -350, preis_pro_einheit: 350 });
  const bezahlt = buchung({ typ: 'zahlung', artikel_id: null, preis_pro_einheit: 350, gesamtpreis: 350 });
  const b1 = buchung({ menge: 2, preis_pro_einheit: 350, gesamtpreis: -700 });
  const l1 = buchung({ artikel_id: 2, preis_pro_einheit: 250, gesamtpreis: -250 });
  const b2 = buchung({ preis_pro_einheit: 350, gesamtpreis: -350 });
  const teil = buchung({ typ: 'zahlung', artikel_id: null, preis_pro_einheit: 500, gesamtpreis: 500 });
  const falsch = buchung({ artikel_id: 2, preis_pro_einheit: 250, gesamtpreis: -250 });
  const storno = buchung({ typ: 'storno', storno_von: falsch.id, artikel_id: null, gesamtpreis: 0, preis_pro_einheit: 0 });
  const a = aufstellung([alt, bezahlt, b1, l1, b2, teil, falsch, storno], namen);
  assert.deepEqual(a.posten, [{ name: 'Bier', menge: 3, summe: 1050 }, { name: 'Limo', menge: 1, summe: 250 }]);
  assert.deepEqual(a.zahlungen.map((b) => b.id), [teil.id]);
  assert.equal(a.offen, 800);
  assert.equal(aufstellung([alt, bezahlt], namen).offen, 0);
  assert.deepEqual(aufstellung([alt, bezahlt], namen).posten, []);
});

test('Hotlist: höchste Stückzahl, nur aktive, alphabetisch angezeigt', () => {
  const m = (id, name, aktiv = true) => ({ id, name, nickname: '', aktiv, guthaben: 0, geschwaerzt: false });
  const mitglieder = [m(1, 'Zora'), m(2, 'Anna'), m(3, 'Bert'), m(4, 'Cleo', false), m(5, 'Dora')];
  const b = [
    buchung({ mitglied_id: 1, menge: 5 }), buchung({ mitglied_id: 2, menge: 1 }), buchung({ mitglied_id: 3, menge: 3 }),
    buchung({ mitglied_id: 4, menge: 9 }), buchung({ mitglied_id: 5, typ: 'aufbuchung', artikel_id: null, gesamtpreis: 100 }),
  ];
  const storno = buchung({ mitglied_id: 3, typ: 'storno', storno_von: b[2].id, artikel_id: null, gesamtpreis: 0 });
  assert.deepEqual(hotlist(b, mitglieder, 10).map((x) => x.name), ['Anna', 'Bert', 'Zora']);
  assert.deepEqual(hotlist(b, mitglieder, 2).map((x) => x.name), ['Bert', 'Zora']);
  assert.deepEqual(hotlist([...b, storno], mitglieder, 10).map((x) => x.name), ['Anna', 'Zora']);
  assert.deepEqual(hotlist([], mitglieder, 10), []);
});

test('Textfelder: Länge, Formelzeichen, Steuerzeichen', () => {
  assert.equal(textFehler('Alex', 1, 60), null);
  assert.equal(textFehler('', 0, 40), null);
  assert.ok(textFehler('', 1, 60));
  assert.ok(textFehler('x'.repeat(61), 1, 60));
  for (const t of ['=1', '+1', '-1', '@a', '\ta', '\ra']) assert.ok(textFehler(t, 1, 60), JSON.stringify(t));
  for (const t of ['a\nb', 'a\u0000b', 'a\u007fb', 'a\u0085b']) assert.ok(textFehler(t, 1, 60), JSON.stringify(t));
  assert.equal(textFehler('Bier 0,5 l – „Hell“', 1, 40), null);
});

test('Speicherfehler: voller Speicher wird erkannt', () => {
  assert.equal(speicherFehlerText({ name: 'QuotaExceededError', message: 'x' }), 'Speicher voll – bitte sichern');
  assert.match(speicherFehlerText(new Error('kaputt')), /kaputt/);
});
