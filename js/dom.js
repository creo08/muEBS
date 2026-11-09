// @ts-check
// DOM-Bausteine. Texte nur über textContent bzw. Text-Knoten, nie als HTML.
import { REPO_URL } from './konstanten.js';
import { zustand } from './zustand.js';

/** @typedef {Node | string | null | undefined | false} Kind */

/**
 * Element erzeugen. Attribute mit Funktion (z. B. onclick) werden zu Ereignissen.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string | number | boolean | ((e: Event) => void)>} [attribute]
 * @param {...Kind} kinder
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, attribute = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attribute)) {
    if (typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false) e.setAttribute(k, String(v));
  }
  for (const kind of kinder) if (kind) e.append(kind);
  return e;
}

/** Fehlerzeile für Screenreader (role="alert"). */
export function fehlerZeile() {
  return el('p', { class: 'fehler', role: 'alert' });
}

/** Statuszeile für Erfolgsmeldungen. */
export function statusZeile() {
  return el('p', { class: 'status', role: 'status' });
}

let letzterTitel = '';

/**
 * Seite in <main> zeigen. Beim Seitenwechsel bekommt die Überschrift den Fokus.
 * @param {string} titel
 * @param {...Kind} kinder
 */
export function seite(titel, ...kinder) {
  const main = /** @type {HTMLElement} */ (document.getElementById('inhalt'));
  const h1 = el('h1', { tabindex: -1 }, titel);
  main.replaceChildren(h1, ...kinder.filter((k) => k !== null && k !== undefined && k !== false).map((k) => /** @type {Node | string} */ (k)));
  document.title = titel === 'µEBS' ? 'µEBS' : `${titel} – µEBS`;
  if (letzterTitel !== location.hash + titel) h1.focus();
  letzterTitel = location.hash + titel;
}

/**
 * Rückfrage als modaler Dialog. Escape oder Schließen ergibt „abbrechen“.
 * @param {string} text
 * @param {Array<[string, string]>} knoepfe [Wert, Beschriftung]
 * @returns {Promise<string>}
 */
export function frage(text, knoepfe) {
  return new Promise((ok) => {
    const d = el('dialog', { 'aria-labelledby': 'frage-text' });
    d.append(
      el('p', { id: 'frage-text' }, text),
      el('div', { class: 'leiste' }, ...knoepfe.map(([wert, beschriftung], i) => el('button', { type: 'button', class: i === knoepfe.length - 1 ? 'zweit' : '', onclick: () => d.close(wert) }, beschriftung))),
    );
    d.addEventListener('close', () => {
      d.remove();
      ok(d.returnValue || 'abbrechen');
    });
    document.body.append(d);
    d.showModal();
  });
}

/**
 * @param {string} text
 * @param {string} ja Beschriftung des Bestätigungsknopfs
 */
export async function bestaetige(text, ja) {
  return (await frage(text, [['ja', ja], ['abbrechen', 'Abbrechen']])) === 'ja';
}

/**
 * Datei zum Herunterladen anbieten (nur lokal, keine Netzwerkanfrage).
 * @param {string} name
 * @param {string} inhalt
 * @param {string} typ
 */
export function herunterladen(name, inhalt, typ) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  const a = el('a', { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Link auf die Doku im Repo, passend zur laufenden Version.
 * @param {string} doku Dateiname ohne .md
 * @param {string} text
 */
export function hilfe(doku, text) {
  const ref = zustand.version && zustand.version.version !== 'dev' ? `v${zustand.version.version}` : 'main';
  return el('a', { class: 'hilfe', href: `${REPO_URL}/blob/${ref}/docs/${doku}.md`, rel: 'noopener noreferrer' }, `Hilfe: ${text}`);
}

/** @param {number} n */
const zwei = (n) => String(n).padStart(2, '0');

/**
 * muebs_sicherung_JJJJ-MM-TT_HHMM.json; in der Demo mit Präfix muebs_demo_.
 * @param {string} art
 * @param {Date} [jetzt]
 */
export function dateiname(art, jetzt = new Date()) {
  const d = `${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}_${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}`;
  return `${zustand.demo ? 'muebs_demo_' : 'muebs_'}${art}_${d}.json`;
}

/** @param {string} name CSV-Dateiname, in der Demo mit Präfix */
export function csvName(name) {
  return zustand.demo ? `muebs_demo_${name}` : name;
}

/** @param {string} iso */
export function zeitText(iso) {
  return new Date(iso).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' });
}

/** @param {HTMLInputElement | HTMLSelectElement} feld @param {string} text */
export function beschriftet(feld, text) {
  return [el('label', { for: feld.id }, text), feld];
}
