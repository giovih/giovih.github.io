import { html } from '../lib/preact.js';
import { Page, EmptyState } from '../ui/kit.js';
export function Progressi({ hidden }) {
  return html`<${Page} id="progressi" hidden=${hidden} title="Progressi"><${EmptyState} icon="sparkles" title="In arrivo" text="Questa sezione arriva nei prossimi passi." /><//>`;
}
