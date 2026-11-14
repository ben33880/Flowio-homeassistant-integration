import { LitElement, html, css, nothing } from 'lit';
import './order-list';
import { mergeOrder } from './order-list';
import { entityId, MEASUREMENTS, type Measurement } from './entities';
import { available, type Hass } from './model';
import { attributeScale, gaugeGeometry, numericValue } from './gauge-model';
import { iconFor, toneFor } from './visual';
import {
  gaugeLabel,
  gaugeUnit,
  normalizeHeaderConfig,
  poolStatus,
  statusDescription,
  type HeaderConfig
} from './header-model';

const RING_CIRCUMFERENCE = 2 * Math.PI * 46;
const STATUS_ICONS = {
  ok: 'mdi:check-circle-outline',
  alert: 'mdi:alert-circle-outline',
  unknown: 'mdi:help-circle-outline'
} as const;

class FlowioHeaderCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  declare hass?: Hass;
  private config?: HeaderConfig;

  static getConfigElement() { return document.createElement('flowio-header-card-editor'); }
  static getStubConfig(): HeaderConfig { return normalizeHeaderConfig({}); }
  setConfig(input: unknown) { this.config = normalizeHeaderConfig(input); }
  getCardSize() { return 2; }

  private more(role: Measurement) {
    if (!this.config || !this.hass) return;
    const id = entityId(this.config.entity_prefix, role);
    if (this.hass.states[id]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true }));
    }
  }

  private ring(role: Measurement) {
    const config = this.config!, state = this.hass!.states[entityId(config.entity_prefix, role)];
    const scale = attributeScale(state?.attributes);
    const value = numericValue(available(state) ? state.state : undefined);
    const unit = gaugeUnit(role, state?.attributes.unit_of_measurement);
    const label = gaugeLabel(role);
    const text = value === undefined ? '—' : state!.state;
    const geometry = scale ? gaugeGeometry(value, scale.min, scale.max, undefined, true) : undefined;
    const dash = geometry && geometry.ratio > 0 ? `${geometry.progress} ${geometry.circumference}` : `0 ${RING_CIRCUMFERENCE}`;
    const rotation = geometry ? geometry.start : -90;
    return html`<button type=button class=gauge data-role=${role} data-tone=${toneFor(role)} ?disabled=${!state} @click=${() => this.more(role)}>
      <span class=dial>
        <svg viewBox="0 0 120 120" role=img aria-label=${`${label} : ${text}${unit ? ` ${unit}` : ''}`}>
          <circle class=track cx=60 cy=60 r=46 fill=none stroke-width=8></circle>
          <circle class=progress cx=60 cy=60 r=46 fill=none stroke-width=8 stroke-linecap=round stroke-dasharray=${dash} transform=${`rotate(${rotation} 60 60)`}></circle>
        </svg>
        <span class=reading><strong>${text}</strong>${unit ? html`<small>${unit}</small>` : nothing}</span>
      </span>
      <span class=caption><ha-icon .icon=${iconFor(role)} aria-hidden=true></ha-icon>${label}</span>
    </button>`;
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const status = poolStatus(hass, config.entity_prefix);
    const description = statusDescription(hass, config.entity_prefix);
    return html`<ha-card class=${config.design === 'flowio' ? 'flowio' : ''}>
      ${config.design === 'flowio' ? html`<svg class=wave viewBox="0 0 1200 90" preserveAspectRatio=none aria-hidden=true><path d="M0,55 C150,90 350,10 600,45 C850,80 1050,20 1200,50 L1200,90 L0,90 Z"></path><path d="M0,70 C200,40 400,95 600,65 C800,35 1000,85 1200,60 L1200,90 L0,90 Z"></path></svg>` : nothing}
      <div class=body>
        ${config.status ? html`<div class=status data-tone=${status.tone}>
          <span class=eyebrow>${config.title}</span>
          <div class=status-line>
            <ha-icon class=status-icon .icon=${STATUS_ICONS[status.tone]} aria-hidden=true></ha-icon>
            <span class=status-title>${status.label}</span>
          </div>
          ${description ? html`<p class=status-description>${description}</p>` : nothing}
        </div>` : nothing}
        <div class=gauges>${config.measurements.map(role => this.ring(role))}</div>
      </div>
    </ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit);--fio-water:var(--flowio-water-color,var(--blue-color,var(--primary-color)));--fio-air:var(--flowio-air-color,var(--amber-color,var(--accent-color,var(--primary-color))));--fio-ph:var(--flowio-ph-color,var(--purple-color,var(--accent-color,var(--primary-color))));--fio-orp:var(--flowio-orp-color,var(--cyan-color,var(--info-color,var(--primary-color))));--fio-pressure:var(--flowio-pressure-color,var(--orange-color,var(--accent-color,var(--primary-color))))}
    ha-card{position:relative;overflow:hidden}
    .body{display:flex;flex-wrap:wrap;align-items:center;gap:16px 24px;padding:30px 16px}
    .status{flex:1 1 240px;min-width:0}
    .eyebrow{display:block;font-size:calc(.68rem * var(--fio-font-scale, 1.32));font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--secondary-text-color)}
    .status-line{display:flex;align-items:center;gap:10px;margin-top:6px}
    .status-icon{flex-shrink:0;--mdc-icon-size:26px;color:var(--secondary-text-color)}
    .status[data-tone=ok] .status-icon{color:var(--success-color,#2e7d32)}
    .status[data-tone=alert] .status-icon{color:var(--error-color)}
    .status-title{font-size:calc(1.35rem * var(--fio-font-scale, 1.32));font-weight:600;line-height:1.2;overflow-wrap:anywhere}
    .status-description{margin:6px 0 0;font-size:calc(.82rem * var(--fio-font-scale, 1.32));line-height:1.45;color:var(--secondary-text-color)}
    .gauges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px 18px;margin-inline-start:auto}
    .gauge{display:flex;flex-direction:column;align-items:center;gap:4px;width:120px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    .gauge:disabled{cursor:default}
    .dial{position:relative;width:109px;height:109px}
    .dial svg{display:block;width:100%;height:100%}
    .track{stroke:var(--divider-color);opacity:.6}
    .progress{stroke:var(--fio-accent);transition:stroke-dasharray .24s ease}
    .reading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
    .reading strong{font-size:calc(1.2rem * var(--fio-font-scale, 1.32));font-weight:600;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
    .reading small{font-size:calc(.66rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .caption{display:flex;align-items:center;gap:4px;font-size:calc(.72rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .caption ha-icon{--mdc-icon-size:15px;color:var(--fio-accent)}
    .gauge[data-tone=water]{--fio-accent:var(--fio-water)}
    .gauge[data-tone=air]{--fio-accent:var(--fio-air)}
    .gauge[data-tone=ph]{--fio-accent:var(--fio-ph)}
    .gauge[data-tone=orp]{--fio-accent:var(--fio-orp)}
    .gauge[data-tone=pressure]{--fio-accent:var(--fio-pressure)}
    .wave{position:absolute;left:0;right:0;bottom:0;width:100%;height:64px;display:block;pointer-events:none}
    .wave path{fill:rgba(255,255,255,.07)}
    .wave path:last-child{fill:rgba(255,255,255,.10)}
    ha-card.flowio{background:linear-gradient(120deg,#0b3f6b,#0a3055 55%,#082a49);border:0;color:#fff}
    ha-card.flowio .eyebrow{color:#8fd3f4}
    ha-card.flowio .status-icon{color:#5fd0e0}
    ha-card.flowio .status[data-tone=ok] .status-icon{color:#5fd0e0}
    ha-card.flowio .status[data-tone=alert] .status-icon{color:#ffb4ab}
    ha-card.flowio .status-title{color:#fff}
    ha-card.flowio .status-description{color:rgba(255,255,255,.82)}
    ha-card.flowio .track{stroke:rgba(255,255,255,.16);opacity:1}
    ha-card.flowio .reading strong{color:#fff}
    ha-card.flowio .reading small{color:rgba(255,255,255,.75)}
    ha-card.flowio .caption{color:rgba(255,255,255,.88);text-transform:uppercase;letter-spacing:.08em;font-weight:600}
    ha-card.flowio .gauge[data-tone=water]{--fio-accent:#38d0e8}
    ha-card.flowio .gauge[data-tone=orp]{--fio-accent:#34d399}
    ha-card.flowio .gauge[data-tone=air]{--fio-accent:#fbbf24}
    ha-card.flowio .gauge[data-tone=ph]{--fio-accent:#c084fc}
    ha-card.flowio .gauge[data-tone=pressure]{--fio-accent:#fb923c}
    @container(max-width:620px){.body{justify-content:center}.status{flex-basis:100%}.gauges{width:100%;justify-content:center;margin-inline-start:0}}
    @media (prefers-reduced-motion: reduce){.progress{transition:none}}
  `;
}

class FlowioHeaderCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: HeaderConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeHeaderConfig(input); this.error = ''; }

  private commit(config: HeaderConfig) {
    this.config = config;
    this.error = '';
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    if (!this.config) return;
    try {
      const value = (event.detail?.value ?? {}) as Record<string, unknown>;
      const selected = Array.isArray(value.measurements) ? value.measurements as Measurement[] : this.config.measurements;
      this.commit(normalizeHeaderConfig({ ...value, measurements: mergeOrder(this.config.measurements, selected) }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private reorder(order: string[]) {
    if (!this.config) return;
    try {
      this.commit(normalizeHeaderConfig({ ...this.config, measurements: order }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'design', selector: { select: { mode: 'dropdown', options: [{ value: 'standard', label: 'Standard' }, { value: 'flowio', label: 'Flow.io' }] } } },
      { name: 'status', selector: { boolean: {} } }
    ];
    const measurementSchema = [{ name: 'measurements', selector: { select: { multiple: true, mode: 'list', options: MEASUREMENTS.map(value => ({ value, label: gaugeLabel(value) })) } } }];
    const labels: Record<string, string> = {
      title: 'Libellé',
      entity_prefix: 'Préfixe firmware',
      design: 'Design',
      status: 'Afficher l’état du bassin',
      measurements: 'Jauges affichées'
    };
    const computeLabel = (field: { name: string }) => labels[field.name] ?? field.name;
    const items = this.config.measurements.map(role => ({ value: role, label: gaugeLabel(role) }));
    return html`${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form><flowio-order-list .items=${items} @order-changed=${(event: CustomEvent) => this.reorder(event.detail.order)}></flowio-order-list><ha-form .hass=${this.hass} .data=${this.config} .schema=${measurementSchema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form>`;
  }

  static styles = css`:host{display:block}p[role=alert]{color:var(--error-color)}`;
}

if (!customElements.get('flowio-header-card')) customElements.define('flowio-header-card', FlowioHeaderCard);
if (!customElements.get('flowio-header-card-editor')) customElements.define('flowio-header-card-editor', FlowioHeaderCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-header-card')) {
  registry.customCards.push({ type: 'flowio-header-card', name: 'Flow.io État du bassin', description: 'État, description et jauges Eau · ORP · Air.', preview: true });
}
