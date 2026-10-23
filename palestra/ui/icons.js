// Icone in stile SF Symbols (disegnate a mano su griglia 24×24, tratto arrotondato).
// Le SF Symbols vere non si possono usare sul web: queste ne riprendono peso e proporzioni.

import { html } from '../lib/preact.js';

const F = 'fill="currentColor" stroke="none"';

const GEAR = 'M10.39 4.78L10.65 2.5L13.35 2.5L13.61 4.78L15.97 5.75L17.76 4.32L19.68 6.24L18.25 8.03L19.22 10.39L21.5 10.65L21.5 13.35L19.22 13.61L18.25 15.97L19.68 17.76L17.76 19.68L15.97 18.25L13.61 19.22L13.35 21.5L10.65 21.5L10.39 19.22L8.03 18.25L6.24 19.68L4.32 17.76L5.75 15.97L4.78 13.61L2.5 13.35L2.5 10.65L4.78 10.39L5.75 8.03L4.32 6.24L6.24 4.32L8.03 5.75Z';
const STAR = 'M12 3.6l2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.6l-5.1 2.7.97-5.68L3.75 9.6l5.7-.83Z';
const SPARK_BIG = 'M10.5 3.5c.7 4.4 3.1 6.8 7.5 7.5-4.4.7-6.8 3.1-7.5 7.5-.7-4.4-3.1-6.8-7.5-7.5 4.4-.7 6.8-3.1 7.5-7.5Z';
const SPARK_SMALL = 'M18.6 15c.28 1.75 1.25 2.72 3 3-1.75.28-2.72 1.25-3 3-.28-1.75-1.25-2.72-3-3 1.75-.28 2.72-1.25 3-3Z';
const BUBBLE = 'M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v7.8a2.6 2.6 0 0 1-2.6 2.6h-6.9l-4.3 3.3c-.4.3-.9 0-.9-.5V17A2.6 2.6 0 0 1 4 14.4Z';

const ICONS = {
  // Barra delle schede
  house: '<path d="M3.8 10.6 12 3.9l8.2 6.7"/><path d="M5.8 9.2v10.1c0 .8.6 1.4 1.4 1.4h3.3v-5.6h3v5.6h3.3c.8 0 1.4-.6 1.4-1.4V9.2"/>',
  houseFill: `<path ${F} d="M11.4 3.2a1 1 0 0 1 1.2 0l8.3 6.8a.9.9 0 0 1-1.1 1.4l-.6-.5v8.4c0 1.1-.9 2-2 2h-3.4v-5.5c0-.6-.4-1-1-1h-1.6c-.6 0-1 .4-1 1v5.5H6.8c-1.1 0-2-.9-2-2v-8.4l-.6.5a.9.9 0 0 1-1.1-1.4Z"/>`,
  forkKnife: '<path d="M5.4 3v4.9a2.6 2.6 0 0 0 5.2 0V3M8 3v18"/><path d="M18.4 21V3c-2.3.9-3.7 3.3-3.7 6.6v4.6h3.7"/>',
  forkKnifeFill: '<path stroke-width="2.3" d="M5.4 3v4.9a2.6 2.6 0 0 0 5.2 0V3M8 3v18"/><path stroke-width="2.3" fill="currentColor" d="M18.4 21V3c-2.3.9-3.7 3.3-3.7 6.6v4.6h3.7"/>',
  chart: '<path d="M3.5 20.5h17"/><path d="M5 16.2l4.6-4.6 3.4 3.4 6.5-6.7"/><path d="M14.8 8.3h4.7V13"/>',
  chartFill: '<path stroke-width="2.3" d="M3.5 20.5h17"/><path stroke-width="2.3" d="M5 16.2l4.6-4.6 3.4 3.4 6.5-6.7"/><path stroke-width="2.3" d="M14.8 8.3h4.7V13"/>',
  sparkles: `<path d="${SPARK_BIG}"/><path d="${SPARK_SMALL}"/>`,
  sparklesFill: `<path ${F} d="${SPARK_BIG}"/><path ${F} d="${SPARK_SMALL}"/>`,
  gear: `<path d="${GEAR}"/><circle cx="12" cy="12" r="3.2"/>`,
  gearFill: `<path ${F} fill-rule="evenodd" d="${GEAR}M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"/>`,

  // Azioni
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
  checkBold: '<path stroke-width="2.6" d="M5 12.6l4.4 4.4L19 7.4"/>',
  xmark: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevronLeft: '<path stroke-width="2.2" d="M15 4.5 7.5 12l7.5 7.5"/>',
  chevronRight: '<path stroke-width="2.2" d="M9 4.5l7.5 7.5L9 19.5"/>',
  chevronDown: '<path stroke-width="2.2" d="M4.5 9l7.5 7.5L19.5 9"/>',
  chevronUp: '<path stroke-width="2.2" d="M4.5 15 12 7.5l7.5 7.5"/>',
  ellipsis: `<circle ${F} cx="5.5" cy="12" r="1.7"/><circle ${F} cx="12" cy="12" r="1.7"/><circle ${F} cx="18.5" cy="12" r="1.7"/>`,
  ellipsisCircle: `<circle cx="12" cy="12" r="9.2"/><circle ${F} cx="7.8" cy="12" r="1.3"/><circle ${F} cx="12" cy="12" r="1.3"/><circle ${F} cx="16.2" cy="12" r="1.3"/>`,
  swap: '<path d="M4.5 8h14.5"/><path d="M15.5 4.5 19 8l-3.5 3.5"/><path d="M19.5 16H5"/><path d="M8.5 12.5 5 16l3.5 3.5"/>',
  pencil: '<path d="M4 20l1.1-4.6L16.2 4.3a1.6 1.6 0 0 1 2.3 0l1.2 1.2a1.6 1.6 0 0 1 0 2.3L8.6 18.9Z"/><path d="M14.3 6.2l3.5 3.5"/>',
  note: '<path d="M5 4.5h14v10.5l-4.5 4.5H5Z"/><path d="M14.5 19.5V15H19"/><path d="M8.5 9h7M8.5 12.5h4"/>',
  trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8v1.7"/><path d="M6.5 6.5l.9 12.7c.1.8.7 1.3 1.5 1.3h6.2c.8 0 1.4-.5 1.5-1.3l.9-12.7"/><path d="M10 10.5v6M14 10.5v6"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="12.5" rx="2.2"/><path d="M15.5 8.5V5.6c0-1.1-.9-2.1-2.1-2.1H6.1C5 3.5 4 4.4 4 5.6v8.3C4 15 5 16 6.1 16h2.4"/>',
  share: '<path d="M12 14.5V3.5"/><path d="M8 7.3l4-3.8 4 3.8"/><path d="M8.5 10.5H7a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2h-1.5"/>',
  download: '<path d="M12 3.5v11"/><path d="M8 10.7l4 3.8 4-3.8"/><path d="M5 15.5v3.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5"/>',
  arrowUp: '<path stroke-width="2.4" d="M12 19V5.5M6 11.2 12 5.2l6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7M9 7h8v8"/>',
  arrowDownRight: '<path d="M7 7l10 10M17 9v8H9"/>',
  arrowRight: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  sync: '<path d="M19.6 10.8a7.8 7.8 0 0 0-14.3-3.6"/><path d="M4.4 13.2a7.8 7.8 0 0 0 14.3 3.6"/><path d="M5 3.5v3.9h3.9"/><path d="M19 20.5v-3.9h-3.9"/>',
  backspace: '<path d="M8.8 5.5h10.4c.9 0 1.6.7 1.6 1.6v9.8c0 .9-.7 1.6-1.6 1.6H8.8L3.4 12Z"/><path d="M11.8 9.5l5 5M16.8 9.5l-5 5"/>',
  keyboardDown: '<rect x="3" y="3.5" width="18" height="11.5" rx="2.2"/><path d="M7 7.5h.01M10.3 7.5h.01M13.6 7.5h.01M17 7.5h.01M8 11.2h8"/><path d="M9.5 18.2 12 20.5l2.5-2.3"/>',

  // Allenamento
  dumbbell: '<rect x="4.6" y="7.6" width="2.6" height="8.8" rx="1.2"/><rect x="7.2" y="5.6" width="2.6" height="12.8" rx="1.2"/><rect x="14.2" y="5.6" width="2.6" height="12.8" rx="1.2"/><rect x="16.8" y="7.6" width="2.6" height="8.8" rx="1.2"/><path d="M9.8 12h4.4M2.5 12h2.1M19.4 12h2.1"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M9.5 2.8h5M12 2.8v3.2M12 13.5l3.2-3.2M18.3 6.6l1.3-1.3"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M9.5 2.8h5M12 2.8v3.2M12 9.5v4h3"/>',
  flame: '<path d="M12 21.4c-3.8 0-6.4-2.6-6.4-6.3 0-2.8 1.7-4.6 3.2-6.4.4 1.3 1.1 2.2 2.1 2.7-.2-3.2 1.1-5.9 3.4-8.1.3 3.5 1.9 5.2 3.2 7.1.9 1.3 1.7 2.9 1.7 4.8 0 3.6-2.7 6.2-6.4 6.2Z"/>',
  bolt: '<path d="M13.3 2.8 5.6 13.6h5.6l-.9 7.6 7.9-11h-5.6Z"/>',
  gauge: '<path d="M4.2 17.5a8.6 8.6 0 1 1 15.6 0"/><path d="M12 13.5l3.6-4.3"/><circle cx="12" cy="13.8" r="1.4"/>',
  trophy: '<path d="M8 4h8v5.3a4 4 0 0 1-8 0Z"/><path d="M8 6H5.2c0 2.5 1.2 4 2.9 4.2M16 6h2.8c0 2.5-1.2 4-2.9 4.2"/><path d="M12 13.3v3.4M8.5 20.5h7M9.6 16.7h4.8l.6 3.8H9Z"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r=".9"/><circle cx="4.6" cy="12" r=".9"/><circle cx="4.6" cy="17.5" r=".9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 9.8h17M8 3v4M16 3v4"/>',
  calendarCheck: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 9.8h17M8 3v4M16 3v4M8.8 14.7l2.2 2.2 4.3-4.3"/>',
  moonZ: '<path d="M18.8 14.6A7.8 7.8 0 0 1 9.4 5.2a7.8 7.8 0 1 0 9.4 9.4Z"/><path d="M14.5 3.5h3.5l-3.5 4h3.5"/>',
  figure: '<circle cx="12" cy="4.6" r="1.9"/><path d="M12 8v6.2M6.5 9.5c2 1 3.7 1.4 5.5 1.4s3.5-.4 5.5-1.4M12 14.2l-2.7 6.3M12 14.2l2.7 6.3"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 9.5a5.4 5.4 0 0 1 8 0"/><path d="M12 11.2l1.5-2.4"/>',

  // Cibo
  sunrise: '<path d="M4 17.5h16M7 17.5a5 5 0 0 1 10 0"/><path d="M12 4v3.5M5.6 9.3l1.8 1.8M18.4 9.3l-1.8 1.8M2.5 13.6h1.7M19.8 13.6h1.7M8.5 21h7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z"/>',
  cup: '<path d="M5 8h11v6.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5Z"/><path d="M16 9.5h1.2a2.6 2.6 0 0 1 0 5.2H16"/><path d="M8 3.5c-.6.8-.6 1.6 0 2.4M11.5 3.5c-.6.8-.6 1.6 0 2.4"/>',
  bag: '<path d="M5 8h14l-1.1 11.4c-.1.9-.8 1.6-1.7 1.6H7.8c-.9 0-1.6-.7-1.7-1.6Z"/><path d="M8.7 10V7a3.3 3.3 0 0 1 6.6 0v3"/>',
  drop: '<path d="M12 3.3c3.3 4.1 6.2 7.7 6.2 11.2a6.2 6.2 0 0 1-12.4 0c0-3.5 2.9-7.1 6.2-11.2Z"/>',
  dropFill: `<path ${F} d="M12 3.3c3.3 4.1 6.2 7.7 6.2 11.2a6.2 6.2 0 0 1-12.4 0c0-3.5 2.9-7.1 6.2-11.2Z"/>`,
  pill: '<g transform="rotate(-45 12 12)"><rect x="8.4" y="3" width="7.2" height="18" rx="3.6"/><path d="M8.4 12h7.2"/></g>',
  barcode: '<path d="M3.5 8V5.7c0-1.2 1-2.2 2.2-2.2H8M16 3.5h2.3c1.2 0 2.2 1 2.2 2.2V8M20.5 16v2.3c0 1.2-1 2.2-2.2 2.2H16M8 20.5H5.7c-1.2 0-2.2-1-2.2-2.2V16"/><path d="M7.5 8v8M10 8v8M12.3 8v8M14.5 8v8M16.5 8v8"/>',
  search: '<circle cx="10.6" cy="10.6" r="6.4"/><path d="M15.4 15.4 20 20"/>',
  star: `<path d="${STAR}"/>`,
  starFill: `<path ${F} d="${STAR}"/>`,
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  clockBack: '<path d="M4.3 12.5a7.8 7.8 0 1 0 2.3-5.6"/><path d="M4.3 4.7v3.6h3.6"/><path d="M12 8v4.3l2.8 1.8"/>',
  camera: '<path d="M4 7.6h3.1l1.6-2.2h6.6l1.6 2.2H20c.6 0 1 .4 1 1v9.9c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V8.6c0-.6.4-1 1-1Z"/><circle cx="12" cy="13.2" r="3.6"/>',
  photo: '<rect x="3" y="4.5" width="18" height="15" rx="2.6"/><path d="M3 16.2l5-4.6 4 3.6 3-2.6 6 5"/><circle cx="16" cy="9" r="1.6"/>',
  photoStack: '<rect x="3.5" y="6.5" width="14" height="13" rx="2.4"/><path d="M7 3.5h11.1c1.3 0 2.4 1.1 2.4 2.4V16"/><path d="M3.5 16.5l4-3.6 3.2 2.8 2.3-2 4.5 4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14.5-14-.8 9.5-5.8 14-13.5 14Z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',

  // Informazioni e stato
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle ${F} cx="12" cy="7.8" r="1.15"/>`,
  warning: `<path d="M10.4 4.3a1.8 1.8 0 0 1 3.2 0l7.2 12.9a1.8 1.8 0 0 1-1.6 2.7H4.8a1.8 1.8 0 0 1-1.6-2.7Z"/><path d="M12 9.3v4.5"/><circle ${F} cx="12" cy="16.6" r="1.1"/>`,
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4Z"/><path d="M10 20.5a2.1 2.1 0 0 0 4 0"/>',
  cloud: '<path d="M7.2 18.5a4.4 4.4 0 0 1-.7-8.8 6 6 0 0 1 11.4-.9 4.9 4.9 0 0 1-.4 9.7Z"/>',
  cloudCheck: '<path d="M7.2 18.5a4.4 4.4 0 0 1-.7-8.8 6 6 0 0 1 11.4-.9 4.9 4.9 0 0 1-.4 9.7Z"/><path d="M9.3 13.2l2 2 3.6-3.6"/>',
  cloudOff: '<path d="M7.2 18.5a4.4 4.4 0 0 1-.7-8.8 6 6 0 0 1 2-2.8M12.4 5.5a6 6 0 0 1 5.5 3.3 4.9 4.9 0 0 1 2.4 8.3"/><path d="M4 4l16 16"/>',
  person: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.8" r="3.1"/><path d="M6.4 18.3a6.9 6.9 0 0 1 11.2 0"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  nosign: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 4.2 4.5 5.8 4.5 8.5S7.5 16.3 7.5 20.5M16.5 3.5c0 4.2-4.5 5.8-4.5 8.5s4.5 4.3 4.5 8.5"/>',
  book: '<path d="M12 6.4c-1.8-1.5-4.6-2.2-8.4-2v13.6c3.8-.2 6.6.5 8.4 2 1.8-1.5 4.6-2.2 8.4-2V4.4c-3.8-.2-6.6.5-8.4 2Z"/><path d="M12 6.4V20"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  paintbrush: '<path d="M14.5 4.5l5 5-7 7-5-5Z"/><path d="M7.5 11.5c-2.5 0-3.5 2-3.5 4.5 0 1.5-.5 2.5-1 3 3 .5 7-.5 7.5-4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  doc: '<path d="M6.5 3.5h7.5l4.5 4.5v11c0 .8-.7 1.5-1.5 1.5h-10.5c-.8 0-1.5-.7-1.5-1.5v-14c0-.8.7-1.5 1.5-1.5Z"/><path d="M13.5 3.5V8h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  bubble: `<path d="${BUBBLE}"/>`,
  bubbleFill: `<path ${F} d="${BUBBLE}"/>`,
  play: `<path ${F} d="M7.5 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8c.6-.4.6-1.2 0-1.6l-10-6.8c-.7-.5-1.6 0-1.6.8Z"/>`,
  forward: `<path ${F} d="M4 6.4v11.2c0 .7.8 1.1 1.4.7l7.6-5.6c.5-.4.5-1 0-1.4L5.4 5.7C4.8 5.3 4 5.7 4 6.4Z"/><path ${F} d="M12 6.4v11.2c0 .7.8 1.1 1.4.7l7.6-5.6c.5-.4.5-1 0-1.4l-7.6-5.6c-.6-.4-1.4 0-1.4.7Z"/>`,
  circle: '<circle cx="12" cy="12" r="9"/>',
  checkCircle: `<circle ${F} cx="12" cy="12" r="10"/><path stroke="var(--on-accent, #fff)" stroke-width="2.2" d="M7.6 12.3l3 3 5.8-6"/>`,
};

/**
 * Icona. name = chiave di ICONS. size in px. label = testo per VoiceOver (se manca, l'icona è decorativa).
 */
export function Icon({ name, size = 24, label, class: cls = '', strokeWidth }) {
  const inner = ICONS[name] || ICONS.circle;
  return html`<svg class=${'icon ' + cls} width=${size} height=${size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width=${strokeWidth || 1.8} stroke-linecap="round" stroke-linejoin="round"
    role=${label ? 'img' : null} aria-label=${label || null} aria-hidden=${label ? null : 'true'}
    dangerouslySetInnerHTML=${{ __html: inner }}></svg>`;
}

export const ICON_NAMES = Object.keys(ICONS);
