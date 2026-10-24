// Sincronizzazione con Supabase (passo 6). Per ora solo l'interfaccia usata dalle schermate.

const ascoltatori = new Set();
export const ascolta = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };

/** fase: spento | inattivo | invio | ricezione | errore | offline */
export const stato = () => ({ fase: 'spento', ultimo: null, daInviare: 0, errore: null });

export async function sincronizzaOra() {}

export function avviaSync() {}
