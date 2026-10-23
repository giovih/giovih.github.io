// Regole per unire i dati del telefono con quelli salvati online.
// Ogni record ha: kind, id, data, updated (millisecondi, ora del telefono che l'ha modificato),
// deleted (cancellato), dirty (modificato sul telefono e non ancora inviato).
// Vince la modifica più recente (per singolo record): niente doppioni perché gli id sono unici
// (uuid per pasti e allenamenti, il giorno per peso, acqua e creatina).

/** true se il record remoto deve sostituire quello locale. */
export function vinceRemoto(locale, remoto) {
  if (!remoto) return false;
  if (!locale) return true;
  if (remoto.updated > locale.updated) return true;
  if (remoto.updated < locale.updated) return false;
  return !locale.dirty; // stesso istante: se ho modifiche non inviate tengo le mie
}

/**
 * Applica una lista di record remoti alla mappa locale (Map "kind/id" → record).
 * @returns {object[]} record locali cambiati
 */
export function applicaRemoti(mappa, remoti) {
  const cambiati = [];
  for (const r of remoti) {
    if (!r || !r.kind || r.id == null) continue;
    const k = `${r.kind}/${r.id}`;
    const loc = mappa.get(k);
    const rem = { kind: r.kind, id: String(r.id), data: r.deleted ? null : r.data, updated: +r.updated || 0, deleted: !!r.deleted, dirty: false };
    if (vinceRemoto(loc, rem)) {
      mappa.set(k, rem);
      cambiati.push(rem);
    }
  }
  return cambiati;
}

/** Il prossimo "updated" per un record: sempre crescente anche se l'orologio torna indietro. */
export const prossimoUpdated = (precedente, ora = Date.now()) => Math.max(ora, (precedente || 0) + 1);

/** Dopo un invio riuscito: segno come puliti solo i record non modificati nel frattempo. */
export function segnaInviati(mappa, inviati) {
  const puliti = [];
  for (const s of inviati) {
    const k = `${s.kind}/${s.id}`;
    const loc = mappa.get(k);
    if (loc && loc.dirty && loc.updated === s.updated) {
      loc.dirty = false;
      puliti.push(loc);
    }
  }
  return puliti;
}
