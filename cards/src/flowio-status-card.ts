import { LitElement, html, css, nothing } from 'lit';
import { available, type Hass } from './model';
import { InstallationController, type InstallationHass } from './installation-controller';
import { normalizeStatusConfig, statusBindings, statusLabel, statusValue, type StatusConfig } from './status-model';

class FlowioStatusCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  declare hass?: Hass & InstallationHass;
  private config?: StatusConfig;
  private installation = new InstallationController(this, () => this.hass);
  static getConfigElement() { return document.createElement('flowio-status-card-editor'); }
  static getStubConfig(): StatusConfig { return normalizeStatusConfig({}); }
  setConfig(input: unknown) { this.config = normalizeStatusConfig(input); }
  getCardSize() { return 2; }
  private more(entityId: string) {
    if (this.hass?.states[entityId]) this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }
  private tile(item: ReturnType<typeof statusBindings>[number]) {
    const state = this.hass?.states[item.id];
    const value = statusValue(item.item, state);
    return html`<button type=button class=tile data-entity=${item.id} data-available=${available(state) ? 'true' : 'false'} ?disabled=${!state} @click=${() => this.more(item.id)}>
      <span>${item.label}</span><strong>${value}</strong>
    </button>`;
  }
  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    if (this.installation.error) return html`<ha-card><div class=body><p class=error role=alert>${this.installation.error}</p></div></ha-card>`;
    const installation = this.installation.value;
    if (!installation) return html`<ha-card><div class=body>Chargement des réglages de l’intégration Flow.io…</div></ha-card>`;
    const bindings = statusBindings(installation.prefix, config.items);
    return html`<ha-card><div class=body>
      ${config.title ? html`<h3 class=title>${config.title}</h3>` : nothing}
      ${bindings.length ? html`<div class=grid>${bindings.map(item => this.tile(item))}</div>` : html`<p class=empty>Aucune information sélectionnée.</p>`}
    </div></ha-card>`;
  }
  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit)}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .title{margin:0 0 10px;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .empty{margin:0;font-size:calc(.82rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .error{margin:0 0 10px;color:var(--error-color);font-size:calc(.78rem * var(--fio-font-scale, 1.32))}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:10px}
    .tile{display:flex;flex-direction:column;gap:4px;min-width:0;padding:10px;text-align:left;font:inherit;color:inherit;background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:12px;cursor:pointer}
    .tile:disabled{cursor:default}
    .tile span{font-size:calc(.68rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .tile strong{font-size:calc(.85rem * var(--fio-font-scale, 1.32));font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  `;
}
class FlowioStatusCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: StatusConfig;
  private error = '';
  setConfig(input: unknown) { this.config = normalizeStatusConfig(input); this.error = ''; }
  private commit(config: StatusConfig) {
    this.config = config;
    this.error = '';
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }
  private changed(event: CustomEvent) {
    event.stopPropagation();
    if (!this.config) return;
    try {
      const value = (event.detail?.value ?? {}) as Record<string, unknown>;
      this.commit(normalizeStatusConfig({ ...value, items: Array.isArray(value.items) ? value.items : this.config.items }));
    } catch (error) { this.error = error instanceof Error ? error.message : 'Configuration invalide'; }
  }
  render() {
    if (!this.config || !this.hass) return nothing;
    const labels: Record<string, string> = { title: 'Titre', items: 'Informations' };
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'items', selector: { select: { multiple: true, mode: 'list', options: [] } } }
    ];
    return html`<p>Le préfixe est fourni par l’intégration Flow.io.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>`;
  }
  static styles = css`
    :host{display:block}
    p{color:var(--secondary-text-color);line-height:1.5}
    p[role=alert]{color:var(--error-color)}
  `;
}
if (!customElements.get('flowio-status-card')) customElements.define('flowio-status-card', FlowioStatusCard);
if (!customElements.get('flowio-status-card-editor')) customElements.define('flowio-status-card-editor', FlowioStatusCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-status-card')) {
  registry.customCards.push({ type: 'flowio-status-card', name: 'Flow.io État système', description: 'État système Flow.io : réseau, mémoire, tension et courant.', preview: true });
}
