// Funzioni comuni alle schermate.

import { useState, useEffect } from '../lib/preact.js';
import { isoDay } from '../core/dates.js';

/** Ora corrente che si aggiorna ogni `ms` (per orologi e conti alla rovescia). */
export function useOra(ms = 1000, attivo = true) {
  const [ora, setOra] = useState(() => Date.now());
  useEffect(() => {
    if (!attivo) return;
    const t = setInterval(() => setOra(Date.now()), ms);
    const vis = () => { if (!document.hidden) setOra(Date.now()); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [ms, attivo]);
  return ora;
}

/** Giorno di oggi che cambia anche a mezzanotte se l'app resta aperta. */
export function useOggi() {
  const ora = useOra(30000);
  return isoDay(new Date(ora));
}

/** Colore CSS di un tono. */
export const coloreTono = tono => `var(--tono-${tono || 'ambra'})`;

/** Applica il tema (auto, scuro, chiaro) e il colore della barra di stato. */
export function applicaTema(tema) {
  const root = document.documentElement;
  if (tema === 'scuro' || tema === 'chiaro') root.dataset.tema = tema;
  else delete root.dataset.tema;
  const scuro = tema === 'scuro' || (tema !== 'chiaro' && matchMedia('(prefers-color-scheme: dark)').matches);
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    if (tema === 'auto') {
      m.setAttribute('content', m.getAttribute('media')?.includes('dark') ? '#0b0b0d' : '#f2f2f7');
    } else {
      m.setAttribute('content', scuro ? '#0b0b0d' : '#f2f2f7');
    }
  }
}

/** Apre il selettore di file (foto) e restituisce il file scelto. */
export function scegliFile({ accept = 'image/*', capture } = {}) {
  return new Promise(ok => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    if (capture) i.setAttribute('capture', capture);
    i.style.display = 'none';
    i.onchange = () => { ok(i.files?.[0] || null); i.remove(); };
    document.body.appendChild(i);
    i.click();
  });
}

/** Scarica un file sul telefono (o apre la condivisione su iPhone). */
export async function salvaFile(nome, testo, tipo = 'application/json') {
  const blob = new Blob([testo], { type: tipo });
  const file = new File([blob], nome, { type: tipo });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e?.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}
