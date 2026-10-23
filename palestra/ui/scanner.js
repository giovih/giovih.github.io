// Lettore di codici a barre con la fotocamera.
// Usa BarcodeDetector se il telefono lo ha, altrimenti ZXing (caricato solo quando serve).

import { html, useEffect, useRef, useState } from '../lib/preact.js';
import { Icon } from './icons.js';
import { aptico } from './haptics.js';

let zxing = null;

async function creaLettore() {
  if ('BarcodeDetector' in window) {
    try {
      const formati = await window.BarcodeDetector.getSupportedFormats?.();
      const voluti = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter(f => !formati || formati.includes(f));
      if (voluti.length) {
        const det = new window.BarcodeDetector({ formats: voluti });
        return async sorgente => (await det.detect(sorgente))[0]?.rawValue || null;
      }
    } catch { /* uso ZXing */ }
  }
  zxing = zxing || await import('../lib/zxing.js');
  const { MultiFormatReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource, DecodeHintType, BarcodeFormat } = zxing;
  const lettore = new MultiFormatReader();
  lettore.setHints(new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async video => {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    // ritaglio la fascia centrale (dove c'è il mirino): più veloce e più preciso
    const w = Math.min(vw, 1000), h = Math.round(Math.min(vh, vw * 0.5));
    const sx = Math.round((vw - w) / 2), sy = Math.round((vh - h) / 2);
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, sx, sy, w, h, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
    try {
      return lettore.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h)))).getText();
    } catch { return null; }
  };
}

/**
 * Vista a tutto schermo della fotocamera. onCodice(codice) quando trova un codice, onChiudi() per uscire.
 */
export function Scanner({ onCodice, onChiudi }) {
  const video = useRef(null);
  const [stato, setStato] = useState('avvio'); // avvio | pronto | negato | errore
  const [manuale, setManuale] = useState('');

  useEffect(() => {
    let stream = null, fermo = false, timer = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (fermo) return stream.getTracks().forEach(t => t.stop());
        const v = video.current;
        v.srcObject = stream;
        v.setAttribute('playsinline', '');
        await v.play();
        setStato('pronto');
        const leggi = await creaLettore();
        const ciclo = async () => {
          if (fermo) return;
          const c = await leggi(v).catch(() => null);
          if (c && !fermo) { fermo = true; aptico('successo'); onCodice(c); return; }
          timer = setTimeout(ciclo, 120);
        };
        ciclo();
      } catch (e) {
        setStato(e?.name === 'NotAllowedError' ? 'negato' : 'errore');
      }
    })();
    return () => { fermo = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const invia = () => { const c = manuale.replace(/\D/g, ''); if (c.length >= 6) onCodice(c); };

  return html`<div class="scanner" role="dialog" aria-label="Scansiona il codice a barre">
    <video ref=${video} muted playsinline autoplay></video>
    <div class="scan-velo"></div>
    <div class="scan-mirino"><i></i></div>
    <div class="scan-top">
      <button type="button" class="icon-btn big scan-chiudi" onClick=${onChiudi} aria-label="Chiudi"><${Icon} name="xmark" size=${22} /></button>
    </div>
    <div class="scan-testo">
      ${stato === 'negato' ? 'Permetti l\'uso della fotocamera nelle impostazioni di iPhone, oppure scrivi il codice qui sotto.'
        : stato === 'errore' ? 'Fotocamera non disponibile: scrivi il codice qui sotto.'
        : 'Inquadra il codice a barre dentro il riquadro'}
    </div>
    <div class="scan-manuale">
      <input class="field" inputmode="numeric" placeholder="Oppure scrivi il codice" value=${manuale}
        onInput=${e => setManuale(e.currentTarget.value)} onKeyDown=${e => e.key === 'Enter' && invia()} aria-label="Codice a barre" />
      <button type="button" class="btn btn-primary" onClick=${invia} disabled=${manuale.replace(/\D/g, '').length < 6}>Cerca</button>
    </div>
  </div>`;
}
