import { html } from '../lib/preact.js';
import { Page, EmptyState } from '../ui/kit.js';
export function Coach({ hidden }) {
  return html`<${Page} id="coach" hidden=${hidden} title="Coach"><${EmptyState} icon="sparkles" title="In arrivo" text="Questa sezione arriva nei prossimi passi." /><//>`;
}
