// @ts-check
// Leeres Projekt: Mitglieder, Artikel, Einstellungen ohne Buchungen.

/** @typedef {import('./schema.js').Daten} Daten */

/**
 * @param {Daten} daten
 * @param {boolean} uebernehmen true: je Saldo ≠ 0 eine Buchung typ uebertrag; false: alle Guthaben auf 0
 * @param {string} geraet
 * @returns {Daten}
 */
export function leeresProjekt(daten, uebernehmen, geraet) {
  const zeit = new Date().toISOString();
  const mitglieder = daten.mitglieder.map((m) => ({
    id: m.id,
    name: m.name,
    nickname: m.nickname,
    aktiv: m.aktiv,
    guthaben: uebernehmen ? m.guthaben : 0,
    // der Verlauf besteht danach nur aus dem Übertrag
    geschwaerzt: uebernehmen && m.guthaben < daten.projekt.schwaerzungs_grenze,
  }));
  const buchungen = uebernehmen
    ? mitglieder.filter((m) => m.guthaben !== 0).map((m) => ({
      id: crypto.randomUUID(),
      geraet_id: geraet,
      typ: /** @type {'uebertrag'} */ ('uebertrag'),
      mitglied_id: m.id,
      artikel_id: null,
      storno_von: null,
      menge: 1,
      preis_pro_einheit: m.guthaben,
      gesamtpreis: m.guthaben,
      zeitstempel: zeit,
    }))
    : [];
  return { projekt: daten.projekt, mitglieder, artikel: daten.artikel, buchungen };
}
