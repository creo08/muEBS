import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centText, euroZuCent, saldoText } from '../../js/geld.js';

test('Euro-Eingabe ohne Gleitkomma in Cent', () => {
  assert.equal(euroZuCent('12,50'), 1250);
  assert.equal(euroZuCent('12.5'), 1250);
  assert.equal(euroZuCent('0,01'), 1);
  assert.equal(euroZuCent(' 3 '), 300);
  assert.equal(euroZuCent('-20,00'), -2000);
  assert.equal(euroZuCent('−20'), -2000);
  assert.equal(euroZuCent('0,1'), 10);
  // 0.1 + 0.2 als Gleitkomma wäre 30.000000000000004
  assert.equal(euroZuCent('0,3'), 30);
  assert.equal(euroZuCent('-0'), 0);
});

test('mehr als 2 Nachkommastellen und Unsinn werden abgelehnt', () => {
  for (const t of ['1,234', '1.005', '', ',5', '1,', 'abc', '1e3', '1.000,00', '12 50', '+5', '9999999999']) assert.equal(euroZuCent(t), null, t);
});

test('Cent als Text', () => {
  assert.equal(centText(1250), '12,50');
  assert.equal(centText(5), '0,05');
  assert.equal(centText(-2000), '-20,00');
  assert.equal(centText(0), '0,00');
});

test('Saldo-Anzeige je Modus', () => {
  assert.equal(saldoText(-350, 'vorauszahlung'), '\u22123,50 €');
  assert.equal(saldoText(-350, 'deckel'), 'offen 3,50 €');
  assert.equal(saldoText(0, 'deckel'), '');
  assert.equal(saldoText(500, 'deckel'), 'Guthaben 5,00 €');
});
