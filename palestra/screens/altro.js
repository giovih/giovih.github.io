import { html } from '../lib/preact.js';
import { Page, EmptyState } from '../ui/kit.js';
export function Altro({ hidden }) {
  return html`<${Page} id="altro" hidden=${hidden} title="Altro"><${EmptyState} icon="sparkles" title="In arrivo" text="Questa sezione arriva nei prossimi passi." /><//>`;
}
