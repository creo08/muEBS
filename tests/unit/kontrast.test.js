// Kontrast aller Farbschemen, berechnet aus css/schemen.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../css/schemen.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../css/app.css', import.meta.url), 'utf8');

/** @param {string} hex */
function luminanz(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** @param {string} a @param {string} b */
export function kontrast(a, b) {
  const [h, d] = [luminanz(a), luminanz(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
}

/** @param {string} quelle */
function variablen(quelle) {
  return Object.fromEntries([...quelle.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const schemen = [...css.matchAll(/\[data-schema="(\w+)"\]\s*\{([^}]*)\}/g)].map((m) => ({ name: m[1], v: variablen(m[2]) }));
const global = variablen(app);

test('es gibt genau 8 Farbschemen', () => {
  assert.deepEqual(schemen.map((s) => s.name), ['violett', 'blau', 'tuerkis', 'gruen', 'gelb', 'orange', 'rot', 'grau']);
});

test('Violett übernimmt die Werte aus Ergo Bibamus', () => {
  const v = schemen[0].v;
  assert.equal(v.hintergrund, '#F0EDF8');
  assert.equal(v.haupt, '#6B5B9E');
  assert.equal(v.hover, '#574A85');
  assert.equal(v.sekundaer, '#D8D2EE');
  assert.equal(v.akzent, '#9B8EC4');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((i) => v[`kachel-${i}`]), ['#5A4A8C', '#6B5B9E', '#574A85', '#7A5694', '#8A4F86', '#4E4377', '#6E4D8A', '#855B9E']);
  assert.equal(global['text-dunkel'], '#2A2737');
  assert.equal(global['text-hell'], '#F7F5FC');
});

for (const s of schemen) {
  test(`Kontrast ${s.name} >= 4,5:1`, () => {
    for (let i = 1; i <= 8; i++) {
      const k = kontrast(s.v[`kachel-${i}`], s.v['kachel-text']);
      assert.ok(k >= 4.5, `Kachel ${i}: ${k.toFixed(2)}`);
    }
    for (const f of ['haupt', 'hover']) {
      const k = kontrast(s.v[f], global['text-hell']);
      assert.ok(k >= 4.5, `${f} mit hellem Text: ${k.toFixed(2)}`);
      const k2 = kontrast(s.v[f], s.v.hintergrund);
      assert.ok(k2 >= 4.5, `${f} als Text auf Hintergrund: ${k2.toFixed(2)}`);
    }
    assert.ok(kontrast(s.v.hintergrund, global['text-dunkel']) >= 4.5, 'Text auf Hintergrund');
    assert.ok(kontrast(s.v.hintergrund, global['text-leise']) >= 4.5, 'leiser Text auf Hintergrund');
    assert.ok(kontrast(s.v.sekundaer, global['text-leise']) >= 4.5, 'leiser Text auf Sekundärfarbe (Tabellen, Navigation)');
    assert.ok(kontrast(s.v.hintergrund, global['fehler']) >= 4.5, 'Fehlertext auf Hintergrund');
    for (const f of ['haupt', 'hover']) assert.ok(kontrast(s.v[f], global['flaeche']) >= 4.5, `${f} auf Fläche`);
    assert.ok(kontrast(s.v.sekundaer, global['text-dunkel']) >= 4.5, 'Text auf Sekundärfarbe');
  });
}

test('geschwärzte Kachel ist schwarz mit weißer Schrift', () => {
  assert.equal(global['geschwaerzt-hg'], '#000000');
  assert.equal(global['geschwaerzt-text'], '#FFFFFF');
  assert.match(app, /\.geschwaerzt\s*\{[^}]*background:\s*var\(--geschwaerzt-hg\);[^}]*color:\s*var\(--geschwaerzt-text\);/);
});

test('Fläche und Fehler: Text lesbar', () => {
  for (const t of ['text-dunkel', 'text-leise', 'fehler']) assert.ok(kontrast(global['flaeche'], global[t]) >= 4.5, t);
  assert.ok(kontrast(global['fehler-flaeche'], global['fehler']) >= 4.5, 'Fehler auf Fehlerfläche');
  assert.ok(kontrast(global['text-dunkel'], global['text-hell']) >= 4.5, 'Banner');
});
