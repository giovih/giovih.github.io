import { html } from '../lib/preact.js';
import { Page, EmptyState } from '../ui/kit.js';
export function Cibo({ hidden }) {
  return html`<${Page} id="cibo" hidden=${hidden} title="Cibo"><${EmptyState} icon="sparkles" title="In arrivo" text="Questa sezione arriva nei prossimi passi." /><//>`;
}
