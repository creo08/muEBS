// @ts-check
// Admin-Bereich: Aufbuchung, Mitglieder, Artikel, Einstellungen, Laden, Exporte, Zurücksetzen.
import { DB_DEMO, DB_ECHT, SCHEMEN, SPERRE_NACH_MS, VOLLSYSTEM_URL } from './konstanten.js';
import { centText, euro, euroZuCent, saldoText } from './geld.js';
import { nachName, textFehler, speicherFehlerText } from './regeln.js';
import {
  aendereArtikel, aendereMitglied, alleArtikel, alleDaten, alleMitglieder, bucheBetrag,
  geraetLesen, geraetSchreiben, loescheDb, neuerArtikel, neuesMitglied, speichereProjekt,
} from './db.js';
import { leeresProjekt } from './projekt.js';
import { abrechnungCsv } from './csv.js';
import { datenschutzSeite } from './datenschutz.js';
import { ARTIKEL_DATEI, GUTHABEN_DATEI, MITGLIEDER_DATEI, artikelCsv, guthabenCsv, mitgliederCsv } from './umstieg.js';
import { bestaetige, csvName, dateiname, el, fehlerZeile, frage, herunterladen, hilfe, seite, statusZeile, zeitText } from './dom.js';
import { exportiereSicherung, dateiInhalt, importiere, vorherSichern } from './sicherung.js';
import { PruefFehler } from './schema.js';
import { db, zustand } from './zustand.js';

/** @typedef {import('./regeln.js').Projekt} Projekt */

// ---------- PIN (nur Bedienschutz) ----------

/**
 * @param {string} pin
 * @param {string} salz
 */
async function pinHash(pin, salz) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salz}:${pin}`));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** PIN-Hash liegt nur im Store „geraet“, nie in Projekt oder Export. */
async function pinGesetzt() {
  return Boolean(await geraetLesen(db(), 'pin'));
}

/** @param {string} pin */
export async function setzePin(pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error('Der PIN muss genau 4 Ziffern haben');
  if (!globalThis.crypto?.subtle) throw new Error('PIN braucht eine sichere Verbindung (https)');
  const salz = crypto.randomUUID();
  await geraetSchreiben(db(), 'pin', { salz, hash: await pinHash(pin, salz) });
  // Wer den PIN setzt, ist gerade im Admin-Bereich und bleibt entsperrt
  zustand.entsperrt = true;
  zustand.letzteEingabe = Date.now();
}

/** @param {string} pin */
async function pinStimmt(pin) {
  const gespeichert = /** @type {{salz: string, hash: string} | undefined} */ (await geraetLesen(db(), 'pin'));
  return Boolean(gespeichert) && (await pinHash(pin, gespeichert?.salz ?? '')) === gespeichert?.hash;
}

/** Entsperrt bis „Sperren“ oder 5 Minuten ohne Eingabe. */
export function istEntsperrt() {
  return zustand.entsperrt && Date.now() - zustand.letzteEingabe < SPERRE_NACH_MS;
}

/** @param {() => void} weiter */
function pinSeite(weiter) {
  const fehler = fehlerZeile();
  const pin = el('input', { id: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4, pattern: '\\d{4}', required: true });
  seite(
    'Admin-Bereich gesperrt',
    el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (await pinStimmt(pin.value)) {
          zustand.entsperrt = true;
          zustand.letzteEingabe = Date.now();
          weiter();
        } else {
          fehler.textContent = 'PIN falsch';
          pin.value = '';
          pin.focus();
        }
      },
    }, el('label', { for: 'pin' }, 'PIN'), pin, ' ', el('button', { type: 'submit' }, 'Entsperren')),
    fehler,
    el('p', {}, el('a', { href: '#/' }, 'Zurück zur Startseite')),
  );
  pin.focus();
}

// ---------- Bausteine ----------

/**
 * @param {string} text
 * @param {HTMLInputElement | HTMLSelectElement} feld
 */
function feld(text, feld) {
  return el('div', { class: 'feld' }, el('label', { for: feld.id }, text), feld);
}

const zurueck = () => el('p', {}, el('a', { href: '#/admin' }, 'Zurück zum Admin-Bereich'));

/**
 * @param {unknown} f
 */
const meldung = (f) => (f instanceof PruefFehler ? f.message : speicherFehlerText(f));

// ---------- Seiten ----------

/**
 * Einstieg: prüft die Sperre und zeigt die Unterseite.
 * @param {string} teil
 */
export async function adminSeite(teil) {
  if (!istEntsperrt()) {
    zustand.entsperrt = false;
    if (await pinGesetzt()) return pinSeite(() => adminSeite(teil));
  }
  switch (teil) {
    case 'aufbuchung': return aufbuchung();
    case 'mitglieder': return seite('Mitglieder', await mitgliederVerwaltung(), zurueck());
    case 'artikel': return seite('Artikel', await artikelVerwaltung(), zurueck());
    case 'einstellungen': return einstellungen();
    case 'laden': return laden();
    case 'exporte': return exporte();
    case 'datenschutz': return datenschutzSeite('#/admin');
    case 'zuruecksetzen': return zuruecksetzen();
    case 'einrichtung':
      return seite(
        'Mitglieder und Artikel anlegen',
        el('p', {}, 'Lege jetzt Mitglieder und Artikel an. Alles lässt sich später im Admin-Bereich ändern.'),
        hilfe('erste-schritte', 'Erste Schritte'),
        await mitgliederVerwaltung(),
        await artikelVerwaltung(),
        el('p', {}, el('a', { class: 'knopf', href: '#/' }, 'Fertig')),
      );
    default: return menue();
  }
}

async function menue() {
  const letzte = /** @type {string | undefined} */ (await geraetLesen(db(), 'letzte_sicherung'));
  const gesperrt = await pinGesetzt();
  /** @type {Array<[string, string]>} */
  const punkte = [
    ['aufbuchung', 'Aufbuchung (Einzahlung)'],
    ['mitglieder', 'Mitglieder'],
    ['artikel', 'Artikel'],
    ['einstellungen', 'Einstellungen'],
    ['laden', 'Sicherung laden'],
    ['exporte', 'Exporte'],
    ['datenschutz', 'Datenschutz'],
    ['zuruecksetzen', 'Gerät zurücksetzen'],
  ];
  seite(
    'Admin-Bereich',
    el('p', {}, `Letzte Sicherung: ${letzte ? zeitText(letzte) : 'noch nie'}`),
    el('nav', { 'aria-label': 'Admin-Bereich' }, el('ul', { class: 'zeilen' }, ...punkte.map(([ziel, text]) => el('li', {}, el('a', { href: `#/admin/${ziel}` }, text))))),
    el('div', { class: 'leiste' },
      el('a', { class: 'knopf zweit', href: '#/' }, 'Zur Startseite'),
      gesperrt && el('button', { type: 'button', onclick: () => { zustand.entsperrt = false; location.hash = '#/'; } }, 'Sperren'),
    ),
  );
}

async function aufbuchung() {
  const mitglieder = (await alleMitglieder(db())).filter((m) => m.aktiv).sort(nachName);
  const fehler = fehlerZeile();
  const status = statusZeile();
  const wahl = el('select', { id: 'auf-mitglied', required: true }, el('option', { value: '' }, 'Bitte wählen'), ...mitglieder.map((m) => el('option', { value: m.id }, m.nickname ? `${m.name} (${m.nickname})` : m.name)));
  const betrag = el('input', { id: 'auf-betrag', inputmode: 'decimal', autocomplete: 'off', placeholder: '20,00', required: true });
  const knopf = el('button', { type: 'submit' }, 'Aufbuchen');
  seite(
    'Aufbuchung',
    el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.textContent = status.textContent = '';
        const cent = euroZuCent(betrag.value);
        const m = mitglieder.find((x) => x.id === Number(wahl.value));
        if (!m) return void (fehler.textContent = 'Bitte ein Mitglied wählen');
        if (cent === null || cent <= 0) return void (fehler.textContent = 'Bitte einen Betrag über 0 mit höchstens 2 Nachkommastellen eingeben');
        knopf.disabled = true;
        try {
          await bucheBetrag(db(), zustand.geraet, m.id, 'aufbuchung', cent);
          status.textContent = `${euro(cent)} für ${m.name} aufgebucht`;
          betrag.value = '';
        } catch (f) {
          fehler.textContent = speicherFehlerText(f);
        }
        knopf.disabled = false;
      },
    }, feld('Mitglied', wahl), feld('Betrag in Euro', betrag), el('p', {}, knopf)),
    fehler,
    status,
    zurueck(),
  );
}

/** Mitglieder anlegen und ändern. Gelöscht wird nie, nur deaktiviert. */
async function mitgliederVerwaltung() {
  const bereich = el('section', { class: 'verwaltung', 'aria-labelledby': 'mv-titel' });
  const fehler = fehlerZeile();
  const status = statusZeile();
  const zeichne = async () => {
    const mitglieder = (await alleMitglieder(db())).sort(nachName);
    const name = el('input', { id: 'neu-name', autocomplete: 'off', maxlength: 60, required: true });
    const nick = el('input', { id: 'neu-nick', autocomplete: 'off', maxlength: 40 });
    const neu = el('form', {
      'aria-label': 'Neues Mitglied',
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.textContent = status.textContent = '';
        const n = name.value.trim();
        const s = nick.value.trim();
        const f = textFehler(n, 1, 60) ? `Name ${textFehler(n, 1, 60)}` : textFehler(s, 0, 40) ? `Spitzname ${textFehler(s, 0, 40)}` : null;
        if (f) return void (fehler.textContent = f);
        try {
          const id = await neuesMitglied(db(), n, s);
          await zeichne();
          status.textContent = `${n} angelegt (Nr. ${id})`;
          /** @type {HTMLInputElement | null} */ (bereich.querySelector('#neu-name'))?.focus();
        } catch (x) {
          fehler.textContent = meldung(x);
        }
      },
    }, feld('Name', name), feld('Spitzname (optional)', nick), el('button', { type: 'submit' }, 'Mitglied anlegen'));
    const zeilen = mitglieder.map((m) => {
      const mn = el('input', { id: `m${m.id}-name`, value: m.name, maxlength: 60, autocomplete: 'off', required: true });
      const ms = el('input', { id: `m${m.id}-nick`, value: m.nickname, maxlength: 40, autocomplete: 'off' });
      const ma = el('input', { id: `m${m.id}-aktiv`, type: 'checkbox', checked: m.aktiv });
      return el('form', {
        'aria-label': `Mitglied ${m.name}`,
        onsubmit: async (e) => {
          e.preventDefault();
          fehler.textContent = status.textContent = '';
          const n = mn.value.trim();
          const s = ms.value.trim();
          const f = textFehler(n, 1, 60) ? `Name ${textFehler(n, 1, 60)}` : textFehler(s, 0, 40) ? `Spitzname ${textFehler(s, 0, 40)}` : null;
          if (f) return void (fehler.textContent = f);
          try {
            await aendereMitglied(db(), m.id, { name: n, nickname: s, aktiv: ma.checked });
            status.textContent = `${n} gespeichert`;
          } catch (x) {
            fehler.textContent = meldung(x);
          }
        },
      },
      el('span', {}, `Nr. ${m.id}`),
      feld('Name', mn), feld('Spitzname', ms),
      el('label', { class: 'inline', for: ma.id }, ma, 'aktiv'),
      el('span', {}, zustand.projekt ? saldoText(m.guthaben, zustand.projekt.modus) || '0,00 €' : ''),
      el('button', { type: 'submit' }, 'Speichern'));
    });
    bereich.replaceChildren(el('h2', { id: 'mv-titel' }, 'Mitglieder'), neu, fehler, status, ...zeilen);
  };
  await zeichne();
  return bereich;
}

/** Artikel anlegen und ändern. Gelöscht wird nie, nur deaktiviert. */
async function artikelVerwaltung() {
  const bereich = el('section', { class: 'verwaltung', 'aria-labelledby': 'av-titel' });
  const fehler = fehlerZeile();
  const status = statusZeile();
  /**
   * @param {string} name
   * @param {string} preis
   * @param {string} reihenfolge
   */
  const lies = (name, preis, reihenfolge) => {
    const n = name.trim();
    const p = euroZuCent(preis);
    const r = Number(reihenfolge);
    const tf = textFehler(n, 1, 40);
    if (tf) return `Name ${tf}`;
    if (p === null || p < 1 || p > 100000) return 'Preis muss zwischen 0,01 € und 1000,00 € liegen (höchstens 2 Nachkommastellen)';
    if (!Number.isInteger(r)) return 'Reihenfolge muss eine ganze Zahl sein';
    return { name: n, preis: p, reihenfolge: r };
  };
  const zeichne = async () => {
    const artikel = (await alleArtikel(db())).sort((a, b) => a.reihenfolge - b.reihenfolge || a.id - b.id);
    const name = el('input', { id: 'neu-artikel', autocomplete: 'off', maxlength: 40, required: true });
    const preis = el('input', { id: 'neu-preis', inputmode: 'decimal', autocomplete: 'off', placeholder: '2,50', required: true });
    const reihe = el('input', { id: 'neu-reihe', type: 'number', step: 1, value: artikel.reduce((m, a) => Math.max(m, a.reihenfolge), 0) + 1 });
    const neu = el('form', {
      'aria-label': 'Neuer Artikel',
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.textContent = status.textContent = '';
        const w = lies(name.value, preis.value, reihe.value);
        if (typeof w === 'string') return void (fehler.textContent = w);
        try {
          const id = await neuerArtikel(db(), w);
          await zeichne();
          status.textContent = `${w.name} angelegt (Nr. ${id})`;
        } catch (x) {
          fehler.textContent = meldung(x);
        }
      },
    }, feld('Name', name), feld('Preis in Euro', preis), feld('Reihenfolge', reihe), el('button', { type: 'submit' }, 'Artikel anlegen'));
    const zeilen = artikel.map((a) => {
      const an = el('input', { id: `a${a.id}-name`, value: a.name, maxlength: 40, autocomplete: 'off', required: true });
      const ap = el('input', { id: `a${a.id}-preis`, value: centText(a.preis), inputmode: 'decimal', autocomplete: 'off', required: true });
      const ar = el('input', { id: `a${a.id}-reihe`, type: 'number', step: 1, value: a.reihenfolge });
      const aa = el('input', { id: `a${a.id}-aktiv`, type: 'checkbox', checked: a.aktiv });
      return el('form', {
        'aria-label': `Artikel ${a.name}`,
        onsubmit: async (e) => {
          e.preventDefault();
          fehler.textContent = status.textContent = '';
          const w = lies(an.value, ap.value, ar.value);
          if (typeof w === 'string') return void (fehler.textContent = w);
          try {
            await aendereArtikel(db(), a.id, { ...w, aktiv: aa.checked });
            status.textContent = `${w.name} gespeichert`;
          } catch (x) {
            fehler.textContent = meldung(x);
          }
        },
      },
      el('span', {}, `Nr. ${a.id}`),
      feld('Name', an), feld('Preis', ap), feld('Reihenfolge', ar),
      el('label', { class: 'inline', for: aa.id }, aa, 'aktiv'),
      el('button', { type: 'submit' }, 'Speichern'));
    });
    bereich.replaceChildren(el('h2', { id: 'av-titel' }, 'Artikel'), neu, fehler, status, ...zeilen);
  };
  await zeichne();
  return bereich;
}

async function einstellungen() {
  const p = /** @type {Projekt} */ (zustand.projekt);
  const fehler = fehlerZeile();
  const status = statusZeile();
  const schema = el('select', { id: 'schema' }, ...SCHEMEN.map((s) => el('option', { value: s.wert, selected: s.wert === p.farbschema }, s.name)));
  schema.addEventListener('change', () => document.documentElement.setAttribute('data-schema', schema.value));
  /** @param {'vorauszahlung' | 'deckel'} wert @param {string} text */
  const modusFeld = (wert, text) => el('label', { class: 'inline' }, el('input', { type: 'radio', name: 'modus', value: wert, checked: p.modus === wert }), text);
  const schwaerzung = el('input', { id: 'schwaerzung', type: 'checkbox', checked: p.schwaerzung_aktiv });
  const grenze = el('input', { id: 'grenze', inputmode: 'decimal', autocomplete: 'off', value: centText(p.schwaerzungs_grenze) });
  const formular = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      fehler.textContent = status.textContent = '';
      const g = euroZuCent(grenze.value);
      if (g === null || g > 0) return void (fehler.textContent = 'Schwärzungsgrenze muss 0 oder negativ sein, z. B. -20,00');
      const modus = /** @type {HTMLInputElement | null} */ (formular.querySelector('input[name="modus"]:checked'))?.value === 'deckel' ? 'deckel' : 'vorauszahlung';
      /** @type {Projekt} */
      const neu = { farbschema: schema.value, modus, schwaerzung_aktiv: schwaerzung.checked, schwaerzungs_grenze: g };
      try {
        await speichereProjekt(db(), neu);
        zustand.projekt = neu;
        status.textContent = 'Einstellungen gespeichert';
      } catch (x) {
        fehler.textContent = speicherFehlerText(x);
      }
    },
  },
  feld('Farbschema', schema),
  hilfe('einstellungen', 'Farbschema'),
  el('fieldset', {}, el('legend', {}, 'Modus'), modusFeld('vorauszahlung', 'Vorauszahlung (erst aufbuchen, dann stricheln)'), modusFeld('deckel', 'Deckel (stricheln, dann zahlen)'), hilfe('stricheln-und-kassieren', 'Modus')),
  el('fieldset', {}, el('legend', {}, 'Schwärzung'), el('label', { class: 'inline', for: 'schwaerzung' }, schwaerzung, 'Schwärzung ein'), feld('Schwärzungsgrenze in Euro (0 oder negativ)', grenze), hilfe('einstellungen', 'Schwärzung')),
  el('p', {}, el('button', { type: 'submit' }, 'Einstellungen speichern')));

  seite(
    'Einstellungen',
    hilfe('einstellungen', 'Einstellungen'),
    formular,
    fehler,
    status,
    await pinBereich(),
    await speicherBereich(),
    zurueck(),
  );
}

async function pinBereich() {
  const bereich = el('section', { 'aria-labelledby': 'pin-titel' });
  const fehler = fehlerZeile();
  const status = statusZeile();
  const zeichne = async () => {
    const gesetzt = await pinGesetzt();
    const pin1 = el('input', { id: 'pin-neu', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4 });
    const pin2 = el('input', { id: 'pin-wdh', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4 });
    bereich.replaceChildren(
      el('h2', { id: 'pin-titel' }, 'PIN'),
      el('p', {}, gesetzt ? 'Ein PIN sperrt den Admin-Bereich.' : 'Kein PIN gesetzt.', ' Der PIN ist nur ein Bedienschutz.'),
      hilfe('datensicherheit', 'PIN'),
      el('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          fehler.textContent = status.textContent = '';
          if (pin1.value !== pin2.value) return void (fehler.textContent = 'Die beiden PINs stimmen nicht überein');
          try {
            await setzePin(pin1.value);
            await zeichne();
            status.textContent = 'PIN gespeichert';
          } catch (x) {
            fehler.textContent = speicherFehlerText(x).replace('Speichern fehlgeschlagen: ', '');
          }
        },
      }, feld(gesetzt ? 'Neuer PIN (4 Ziffern)' : 'PIN (4 Ziffern)', pin1), feld('PIN wiederholen', pin2), el('p', {}, el('button', { type: 'submit' }, gesetzt ? 'PIN ändern' : 'PIN setzen'))),
      gesetzt ? el('button', {
        type: 'button',
        class: 'zweit',
        onclick: async () => {
          if (!(await bestaetige('PIN entfernen? Der Admin-Bereich ist dann ohne PIN erreichbar.', 'PIN entfernen'))) return;
          await geraetSchreiben(db(), 'pin', undefined);
          await zeichne();
          status.textContent = 'PIN entfernt';
        },
      }, 'PIN entfernen') : '',
      fehler,
      status,
    );
  };
  await zeichne();
  return bereich;
}

async function speicherBereich() {
  const s = navigator.storage;
  let text = 'Dieser Browser kann dauerhaften Speicher nicht melden.';
  if (s && typeof s.persisted === 'function') {
    text = (await s.persisted()) ? 'Dauerhafter Speicher ist gewährt: Der Browser löscht die Daten nicht von selbst.' : 'Dauerhafter Speicher ist nicht gewährt: Der Browser kann die Daten bei Speichermangel löschen. Regelmäßig sichern.';
  }
  return el('section', { 'aria-labelledby': 'speicher-titel' }, el('h2', { id: 'speicher-titel' }, 'Speicher'), el('p', { id: 'speicher-status' }, text), hilfe('sicherung-und-projekt', 'Datenerhalt'));
}

function laden() {
  const fehler = fehlerZeile();
  const status = statusZeile();
  const datei = el('input', { id: 'datei', type: 'file', accept: '.json,application/json' });
  const knopf = el('button', { type: 'submit' }, 'Laden');
  seite(
    'Sicherung laden',
    el('p', {}, 'Lädt eine Sicherung oder ein leeres Projekt. Alle Daten am Gerät werden ersetzt.'),
    hilfe('sicherung-und-projekt', 'Sicherung laden'),
    el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.textContent = status.textContent = '';
        const f = datei.files?.[0];
        if (!f) return void (fehler.textContent = 'Bitte eine Datei wählen');
        knopf.disabled = true;
        try {
          if (await importiere(f)) {
            document.documentElement.setAttribute('data-schema', zustand.projekt?.farbschema ?? 'violett');
            status.textContent = 'Daten geladen';
          }
        } catch (x) {
          fehler.textContent = meldung(x);
        }
        knopf.disabled = false;
      },
    }, feld('Datei (.json)', datei), el('p', {}, knopf)),
    fehler,
    status,
    zurueck(),
  );
}

function exporte() {
  const fehler = fehlerZeile();
  const status = statusZeile();
  /** @param {() => Promise<void>} aktion */
  const sicher = (aktion) => async () => {
    fehler.textContent = status.textContent = '';
    try {
      await aktion();
      status.textContent = 'Export erstellt';
    } catch (x) {
      fehler.textContent = meldung(x);
    }
  };
  seite(
    'Exporte',
    el('h2', {}, 'Sicherung'),
    el('p', {}, 'Alle Daten außer PIN und Geräte-Kennung. Mit „Sicherung laden“ wird der Zustand wiederhergestellt.'),
    el('button', { type: 'button', onclick: sicher(exportiereSicherung) }, 'Sicherung exportieren'),
    hilfe('sicherung-und-projekt', 'Sicherung'),
    el('h2', {}, 'Leeres Projekt'),
    el('p', {}, 'Mitglieder, Artikel und Einstellungen ohne Buchungen, z. B. für ein neues Semester.'),
    el('button', {
      type: 'button',
      onclick: sicher(async () => {
        const wahl = await frage('Guthaben im neuen Projekt?', [['null', 'Guthaben auf 0 setzen'], ['uebernehmen', 'Guthaben übernehmen'], ['abbrechen', 'Abbrechen']]);
        if (wahl === 'abbrechen') throw new PruefFehler('Abgebrochen');
        const daten = await alleDaten(db());
        herunterladen(dateiname('projekt'), dateiInhalt('projekt', leeresProjekt(daten, wahl === 'uebernehmen', zustand.geraet)), 'application/json');
        if (wahl === 'null') herunterladen(csvName('abrechnung_v1.csv'), abrechnungCsv(daten.mitglieder, daten.buchungen), 'text/csv');
      }),
    }, 'Leeres Projekt exportieren'),
    hilfe('sicherung-und-projekt', 'Leeres Projekt'),
    el('h2', {}, 'Umstieg ins Vollsystem'),
    el('p', {}, 'Drei CSV-Dateien für den Import in ein leeres Ergo-Bibamus-Vollsystem.'),
    el('p', {}, 'Vollsystem: ', el('a', { href: VOLLSYSTEM_URL, rel: 'noopener noreferrer' }, VOLLSYSTEM_URL)),
    el('div', { class: 'leiste' },
      el('button', { type: 'button', onclick: sicher(async () => herunterladen(csvName(MITGLIEDER_DATEI), mitgliederCsv((await alleDaten(db())).mitglieder, /** @type {Projekt} */ (zustand.projekt)), 'text/csv')) }, MITGLIEDER_DATEI),
      el('button', { type: 'button', onclick: sicher(async () => herunterladen(csvName(ARTIKEL_DATEI), artikelCsv((await alleDaten(db())).artikel), 'text/csv')) }, ARTIKEL_DATEI),
      el('button', { type: 'button', onclick: sicher(async () => herunterladen(csvName(GUTHABEN_DATEI), guthabenCsv((await alleDaten(db())).mitglieder), 'text/csv')) }, GUTHABEN_DATEI),
    ),
    hilfe('umstieg-ins-vollsystem', 'Umstieg'),
    fehler,
    status,
    zurueck(),
  );
}

function zuruecksetzen() {
  const fehler = fehlerZeile();
  seite(
    'Gerät zurücksetzen',
    el('p', {}, 'Löscht alle Daten dieses Geräts, auch den PIN und die Demo. Danach startet µEBS wie beim ersten Mal.'),
    el('button', {
      type: 'button',
      onclick: async () => {
        try {
          if (!(await vorherSichern())) return;
          if (!(await bestaetige('Alle Daten und der PIN werden gelöscht.', 'Weiter'))) return;
          if (!(await bestaetige('Wirklich endgültig löschen? Das lässt sich nicht rückgängig machen.', 'Endgültig löschen'))) return;
          zustand.db?.close();
          zustand.echt?.close();
          await loescheDb(DB_DEMO);
          await loescheDb(DB_ECHT);
          location.hash = '#/';
          location.reload();
        } catch (x) {
          fehler.textContent = speicherFehlerText(x);
        }
      },
    }, 'Gerät zurücksetzen'),
    fehler,
    zurueck(),
  );
}
