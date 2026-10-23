// Intelligenza artificiale (stima del cibo dalla foto, Coach).
// Le richieste passano dalla funzione "ai" su Supabase: la chiave di Anthropic resta sul server, mai sul telefono.

import * as C from './cloud.js';
import { ridimensiona, blobInDataUrl } from './actions.js';

export const disponibile = () => C.collegato();

function serveAccount() {
  if (!C.collegato()) throw new C.ErroreCloud('Per usare l\'intelligenza artificiale collega il tuo account in Altro → Account.', 'non_collegato', 0);
}

/**
 * Stima calorie e macro da foto e/o descrizione.
 * @returns {{descrizione:string, kcal:number, kcal_min:number, kcal_max:number, proteine:number, carboidrati:number, grassi:number, note:string}}
 */
export async function stimaCibo({ foto = null, descrizione = '' }) {
  serveAccount();
  let immagine = null;
  if (foto) {
    const { blob } = await ridimensiona(foto, 1024, 0.82);
    immagine = (await blobInDataUrl(blob)).split(',')[1];
  }
  const r = await C.funzione('ai', { azione: 'stima', immagine, descrizione: (descrizione || '').slice(0, 600) });
  if (!r || typeof r.kcal !== 'number') throw new C.ErroreCloud('Risposta non valida, riprova.', 'risposta', 0);
  return r;
}

/** Messaggio al Coach: messaggi = [{ ruolo: 'io'|'coach', testo }], riassunto = dati dell'app in testo. */
export async function chiediCoach(messaggi, riassunto) {
  serveAccount();
  const r = await C.funzione('ai', {
    azione: 'coach',
    messaggi: messaggi.slice(-20).map(m => ({ role: m.ruolo === 'io' ? 'user' : 'assistant', content: m.testo.slice(0, 4000) })),
    riassunto: riassunto.slice(0, 24000),
  });
  if (!r?.testo) throw new C.ErroreCloud('Risposta vuota, riprova.', 'risposta', 0);
  return r.testo;
}
