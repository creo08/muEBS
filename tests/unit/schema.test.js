import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pruefeDatei, MELDUNG_NEUER, MELDUNG_UNSTIMMIG, MELDUNG_DEMO } from '../../js/schema.js';

const DEMO = readFileSync(new URL('../../demo/demo.json', import.meta.url), 'utf8');
const datei = () => JSON.parse(DEMO);

test('demo.json ist eine gültige, stimmige Datei', () => {
  const d = pruefeDatei(datei(), { echt: false });
  assert.equal(d.demo, true);
  assert.ok(d.mitglieder.some((m) => m.geschwaerzt), 'enthält eine Schwärzung');
  assert.ok(d.buchungen.some((b) => b.typ === 'storno'));
});

test('Demo-Datei wird in echt abgelehnt', () => {
  assert.throws(() => pruefeDatei(datei(), { echt: true }), { message: MELDUNG_DEMO });
});

test('Daten werden in neue Objekte kopiert', () => {
  const roh = datei();
  const d = pruefeDatei(roh, { echt: false });
  assert.notEqual(d.mitglieder[0], roh.mitglieder[0]);
  assert.deepEqual(d.mitglieder[0], roh.mitglieder[0]);
});

/** @param {(d: any) => void} aendern */
const mit = (aendern) => { const d = datei(); aendern(d); return d; };

test('Format fehlt, unbekannt oder höher', () => {
  for (const f of [undefined, 0, 2, '1', 1.5]) assert.throws(() => pruefeDatei(mit((d) => { d.format = f; }), { echt: false }), { message: MELDUNG_NEUER }, String(f));
});

test('verbotene Schlüssel an jeder Stelle', () => {
  for (const k of ['__proto__', 'constructor', 'prototype']) {
    const text = DEMO.replace('"mitglied_id":', `"${k}":{},"mitglied_id":`);
    assert.throws(() => pruefeDatei(JSON.parse(text), { echt: false }), /Unzulässiger Schlüssel/, k);
  }
});

test('Typen, Felder, Verweise und Stimmigkeit', () => {
  const faelle = [
    [(d) => { d.mitglieder[0].guthaben = 1.5; }, /ganze Zahl/],
    [(d) => { d.mitglieder[0].id = '1'; }, /ganze Zahl/],
    [(d) => { d.mitglieder[0].name = ''; }, /darf nicht leer sein/],
    [(d) => { d.mitglieder[0].name = 'x'.repeat(61); }, /höchstens 60/],
    [(d) => { d.mitglieder[0].nickname = '@x'; }, /beginnen/],
    [(d) => { d.mitglieder[0].email = 'x'; }, /unbekanntes Feld/],
    [(d) => { delete d.mitglieder[0].aktiv; }, /fehlt/],
    [(d) => { d.mitglieder.push({ ...d.mitglieder[0] }); }, /doppelt/],
    [(d) => { d.artikel[0].preis = 0; }, /preis/],
    [(d) => { d.artikel[0].preis = 100001; }, /preis/],
    [(d) => { d.artikel[0].name = 'a\u0001'; }, /Steuerzeichen/],
    [(d) => { d.buchungen[0].id = 'x'; }, /UUID/],
    [(d) => { d.buchungen[0].zeitstempel = '2026-01-01 10:00'; }, /Zeitstempel/],
    [(d) => { d.buchungen[0].typ = 'geschenk'; }, /typ/],
    [(d) => { d.buchungen[0].mitglied_id = 999; }, /gibt es nicht/],
    [(d) => { const b = d.buchungen.find((x) => x.typ === 'artikel'); b.artikel_id = 999; }, /gibt es nicht/],
    [(d) => { const b = d.buchungen.find((x) => x.typ === 'artikel'); b.gesamtpreis += 1; }, /Betrag passt nicht/],
    [(d) => { d.buchungen.find((x) => x.typ === 'aufbuchung').artikel_id = 1; }, /artikel_id muss null/],
    [(d) => { d.buchungen.find((x) => x.typ === 'storno').storno_von = '11111111-2222-4333-8444-555555555555'; }, /gibt/],
    [(d) => { const s = d.buchungen.find((x) => x.typ === 'storno'); d.buchungen.push({ ...s, id: '11111111-2222-4333-8444-555555555555', storno_von: s.id }); }, /Storno-Eintrag/],
    [(d) => { d.mitglieder[0].guthaben += 1; }, new RegExp(MELDUNG_UNSTIMMIG)],
    [(d) => { d.projekt.schwaerzungs_grenze = 100; }, /schwaerzungs_grenze/],
    [(d) => { d.projekt.farbschema = 'pink'; }, /Farbschema/],
    [(d) => { d.typ = 'irgendwas'; }, /typ/],
    [(d) => { d.buchungen = {}; }, /Liste/],
  ];
  for (const [aendern, meldung] of faelle) assert.throws(() => pruefeDatei(mit(aendern), { echt: false }), meldung, aendern.toString());
});

test('tief verschachtelte Datei wird sauber abgelehnt, lange Feldnamen gekürzt', () => {
  const tief = JSON.parse('['.repeat(100000) + ']'.repeat(100000));
  assert.throws(() => pruefeDatei({ ...datei(), buchungen: tief }, { echt: false }), /zu tief verschachtelt/);
  const lang = 'x'.repeat(100000);
  assert.throws(() => pruefeDatei(mit((d) => { d.mitglieder[0][lang] = 1; }), { echt: false }), (f) => f.message.length < 200);
});

test('Schwärzungs-Merker wird aus dem Verlauf bestimmt, nicht aus der Datei übernommen', () => {
  const roh = datei();
  const vorher = roh.mitglieder.map((m) => m.geschwaerzt);
  for (const m of roh.mitglieder) m.geschwaerzt = !m.geschwaerzt;
  const d = pruefeDatei(roh, { echt: false });
  assert.deepEqual(d.mitglieder.map((m) => m.geschwaerzt), vorher);
});

test('Keine Datei', () => {
  for (const roh of [null, [], 'x', 1]) assert.throws(() => pruefeDatei(roh, { echt: false }));
});
