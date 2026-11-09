// scripts/cleanup.sh in einem Wegwerf-Repo prüfen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKRIPT = new URL('../../scripts/cleanup.sh', import.meta.url).pathname;
// Muster zusammengesetzt, damit cleanup.sh diese Datei selbst nicht meldet
const MIT = 'Co-Authored' + '-By';
const AT = '@';
const SITZUNG = 'https://claude.ai/code/' + 'session_';
const GUT = { GIT_AUTHOR_NAME: 'creo08', GIT_AUTHOR_EMAIL: '285598642+creo08@users.noreply.github.com', GIT_COMMITTER_NAME: 'creo08', GIT_COMMITTER_EMAIL: '285598642+creo08@users.noreply.github.com' };

function repo() {
  const ort = mkdtempSync(join(tmpdir(), 'cleanup-'));
  mkdirSync(join(ort, 'scripts'));
  mkdirSync(join(ort, 'js'));
  copyFileSync(SKRIPT, join(ort, 'scripts/cleanup.sh'));
  writeFileSync(join(ort, 'js/a.js'), "el.textContent = 'x';\nfetch('version.json', { cache: 'no-store' });\n");
  const git = (/** @type {string[]} */ ...a) => execFileSync('git', a, { cwd: ort, env: { ...process.env, ...GUT } });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'Anfang');
  const lauf = (/** @type {string[]} */ ...a) => spawnSync('bash', ['scripts/cleanup.sh', ...a], { cwd: ort, encoding: 'utf8' });
  return { ort, git, lauf, fertig: () => rmSync(ort, { recursive: true, force: true }) };
}

test('sauberes Repo: Exit-Code 0', () => {
  const r = repo();
  const e = r.lauf();
  assert.equal(e.status, 0, e.stdout);
  r.fertig();
});

test('Mitautor, Sitzungs-Link und fremde Identität in der Historie: Exit-Code 1', () => {
  const r = repo();
  r.git('commit', '-q', '--allow-empty', '-m', `x\n\n${MIT}: Jemand <jemand${AT}example.org>\nClaude-` + `Session: ${SITZUNG}abc`);
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'y'], { cwd: r.ort, env: { ...process.env, ...GUT, GIT_AUTHOR_NAME: 'Echter Name' } });
  r.git('tag', '-a', 'v0.0.1', '-m', `Signed-off-by: A <a${AT}example.org>`);
  const e = r.lauf();
  assert.equal(e.status, 1);
  assert.match(e.stdout, /Mitautor/);
  assert.match(e.stdout, /Sitzungs-Zeile/);
  assert.match(e.stdout, /Autor ist Echter Name/);
  assert.match(e.stdout, /Tag v0\.0\.1/);
  assert.match(e.stdout, /nie automatisch umgeschrieben/);
  r.fertig();
});

test('App-Code: externe URL, fremdes fetch und verbotene Senken werden gefunden', () => {
  const r = repo();
  writeFileSync(join(r.ort, 'js/b.js'), "x.innerHTML = s;\nfetch('https://example.org/a');\nnew Worker('w.js');\nsetTimeout('alert(1)', 1);\n/** @type {import('./a.js').X} */\nconst y = 'https://github.com/creo08/muEBS/blob/main/docs/x.md';\n");
  mkdirSync(join(r.ort, 'css'));
  writeFileSync(join(r.ort, 'css/a.css'), 'a { background: url(x.png); }\n');
  const e = r.lauf();
  assert.equal(e.status, 1);
  for (const m of [/innerHTML/, /externe URL https:\/\/example\.org/, /fetch nur auf eigene/, /Worker/, /setTimeout/, /url\(\) in CSS/]) assert.match(e.stdout, m);
  assert.doesNotMatch(e.stdout, /creo08\/muEBS/);
  assert.doesNotMatch(e.stdout, /import\('\.\/a\.js'\)/);
  r.fertig();
});

test('--fix bereinigt Dateien, nicht die Historie', () => {
  const r = repo();
  writeFileSync(join(r.ort, 'NOTIZ.md'), `Text\n${MIT}: Jemand <jemand${AT}example.org>\nSiehe ${SITZUNG}abc123 hier\n`);
  const e = r.lauf('--fix');
  assert.match(e.stdout, /BEREINIGT NOTIZ\.md/);
  assert.equal(readFileSync(join(r.ort, 'NOTIZ.md'), 'utf8'), 'Text\nSiehe  hier\n');
  assert.equal(r.lauf().status, 0);
  r.fertig();
});
