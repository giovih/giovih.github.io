// Feedback aptico, suono e schermo acceso.
// Su iPhone (iOS 18+) il web non ha l'API di vibrazione, ma un interruttore nativo
// <input type="checkbox" switch> produce un "tic" del Taptic Engine quando cambia: lo usiamo di nascosto.

let interruttore = null;

function prendiInterruttore() {
  if (interruttore) return interruttore;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  interruttore = label;
  return label;
}

/** Tocco aptico leggero. Funziona solo dentro un gesto dell'utente (tocco). */
export function aptico(tipo = 'leggero') {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(tipo === 'successo' ? [12, 60, 18] : tipo === 'forte' ? 25 : 10);
      return;
    }
    prendiInterruttore().click();
    if (tipo === 'successo') setTimeout(() => prendiInterruttore().click(), 90);
  } catch { /* niente */ }
}

/* ---------- suono di fine recupero ---------- */

let audio = null;

/** Da chiamare a ogni tocco: sblocca l'audio (Safari lo permette solo dopo un gesto). */
export function sbloccaAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* niente */ }
}

/** Tre note brevi e morbide. */
export function suonoFine() {
  if (!audio) return;
  try {
    const t0 = audio.currentTime + 0.02;
    [[880, 0], [1175, 0.16], [1568, 0.32]].forEach(([f, dt]) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + dt);
      g.gain.linearRampToValueAtTime(0.35, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.32);
      o.connect(g); g.connect(audio.destination);
      o.start(t0 + dt); o.stop(t0 + dt + 0.35);
    });
  } catch { /* niente */ }
}

/* ---------- schermo acceso durante l'allenamento ---------- */

let blocco = null;
let voglioSchermo = false;

export async function schermoAcceso(si) {
  voglioSchermo = si;
  try {
    if (si && !blocco && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      blocco = await navigator.wakeLock.request('screen');
      blocco.addEventListener('release', () => { blocco = null; });
    } else if (!si && blocco) {
      await blocco.release();
      blocco = null;
    }
  } catch { blocco = null; }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && voglioSchermo) schermoAcceso(true);
  });
}
