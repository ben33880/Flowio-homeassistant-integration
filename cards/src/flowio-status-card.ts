import { LitElement, html, css, nothing } from 'lit';
import type { Hass } from './model';
import {
  STATUS_ITEMS,
  normalizeStatusConfig,
  statusBindings,
  statusLabel,
  statusValue,
  type StatusConfig,
  type StatusItem
} from './status-model';

const ICONS: Record<StatusItem, string> = {
  wifi_ip: 'mdi:ip-network-outline',
  wifi_mac: 'mdi:identifier',
  wifi_rssi: 'mdi:wifi',
  sys_upt_mn: 'mdi:clock-outline',
  sys_hp_free: 'mdi:memory',
  sys_hp_min_free: 'mdi:memory',
  sys_hp_frag: 'mdi:memory',
  voltage: 'mdi:flash-outline',
  current: 'mdi:current-ac'
};

class FlowioStatusCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  declare hass?: Hass;
  private config?: StatusConfig;

  static getConfigElement() { return document.createElement('flowio-status-card-editor'); }
  static getStubConfig(): StatusConfig { return normalizeStatusConfig({}); }
  setConfig(input: unknown) { this.config = normalizeStatusConfig(input); }
  getCardSize() { return 3; }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const bindings = statusBindings(config.entity_prefix, config.items);
    return html`<ha-card><div class=body>
      <h3 class=title>${config.title}</h3>
      <div class=list>${bindings.map(binding => {
        const state = hass.states[binding.id];
        return html`<button type=button class=row data-item=${binding.item} ?disabled=${!state} @click=${() => this.more(binding.id)}>
          <span class=icon-plate><ha-icon .icon=${ICONS[binding.item]} aria-hidden=true></ha-icon></span>
          <span class=label>${binding.label}</span>
          <strong class=value>${statusValue(binding.item, state)}</strong>
        </button>`;
      })}</div>
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit)}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .title{margin:0 0 12px;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .list{display:flex;flex-direction:column}
    .row{display:flex;align-items:center;gap:12px;min-height:48px;padding:8px 0;border:0;border-bottom:1px solid var(--divider-color);background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;overflow-wrap:anywhere}
    .row:last-child{border-bottom:0}
    .row:disabled{cursor:default}
    .icon-plate{display:inline-flex;align-items:center;justify-content:center;flex:0 0 30px;width:30px;height:30px;border-radius:9px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 14%,var(--ha-card-background,var(--card-background-color)))}
    .icon-plate ha-icon{--mdc-icon-size:18px}
    .label{flex:1 1 0;min-width:0;font-size:calc(.84rem * var(--fio-font-scale, 1.32))}
    .value{font-size:calc(.86rem * var(--fio-font-scale, 1.32));font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
  `;
}

class FlowioStatusCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: StatusConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeStatusConfig(input); this.error = ''; }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    try {
      this.config = normalizeStatusConfig(event.detail.value);
      this.error = '';
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this.config }, bubbles: true, composed: true }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'items', selector: { select: { multiple: true, mode: 'list', options: STATUS_ITEMS.map(item => ({ value: item, label: statusLabel(item) })) } } }
    ];
    const labels: Record<string, string> = { title: 'Titre', entity_prefix: 'Préfixe firmware', items: 'Informations affichées' };
    return html`${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>`;
  }

  static styles = css`:host{display:block}p[role=alert]{color:var(--error-color)}`;
}

if (!customElements.get('flowio-status-card')) customElements.define('flowio-status-card', FlowioStatusCard);
if (!customElements.get('flowio-status-card-editor')) customElements.define('flowio-status-card-editor', FlowioStatusCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-status-card')) {
  registry.customCards.push({ type: 'flowio-status-card', name: 'Flow.io État système', description: 'Réseau, mémoire et fonctionnement du contrôleur.', preview: true });
}
