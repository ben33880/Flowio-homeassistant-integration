import { LitElement, html, css, nothing } from 'lit';
import './flowio-gauge';
import { available, type Hass } from './model';
import {
  PROBE_MODES,
  normalizeProbeConfig,
  probeDisplayName,
  probeLabel,
  probeMode,
  probeNamePrefix,
  probeScale,
  probeValue,
  rawProbeName,
  resolveProbeColor,
  type ProbeConfig
} from './probe-model';

const PALETTE = ['#0288d1', '#00acc1', '#26a69a', '#43a047', '#7cb342', '#fbc02d', '#ffa000', '#f4511e', '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#546e7a', '#9e9e9e'];

class FlowioProbeCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  declare hass?: Hass;
  private config?: ProbeConfig;

  static getConfigElement() { return document.createElement('flowio-probe-card-editor'); }
  static getStubConfig(): ProbeConfig { return normalizeProbeConfig({}); }
  setConfig(input: unknown) { this.config = normalizeProbeConfig(input); }
  getCardSize() { return 3; }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  private probe(id: string, prefix: string) {
    const config = this.config!, state = this.hass!.states[id];
    const label = probeLabel(config, state, prefix) || probeDisplayName(rawProbeName(id, state), prefix);
    const unit = typeof state?.attributes.unit_of_measurement === 'string' ? state.attributes.unit_of_measurement : '';
    const value = probeValue(state);
    const scale = probeScale(config, state);
    const text = !state ? 'Entité absente' : !available(state) ? 'Indisponible' : value === undefined ? state.state : `${state.state}${unit ? ` ${unit}` : ''}`;
    const { tone, custom } = resolveProbeColor(config, state);
    const availability = available(state) ? 'true' : 'false';
    if (probeMode(config) === 'gauge') {
      return html`<div class="probe gauge" data-entity=${id} data-tone=${tone} data-available=${availability} style=${custom ? `--fio-accent:${custom}` : ''}>
        <button type=button class=probe-head ?disabled=${!state} @click=${() => this.more(id)}>
          <strong class=probe-value>${available(state) ? '' : !state ? 'Entité absente' : 'Indisponible'}</strong>
        </button>
        <flowio-gauge .value=${value} .valueText=${state?.state} .min=${scale?.min} .max=${scale?.max} .variant=${'arc'} .label=${label} .unit=${unit}></flowio-gauge>
      </div>`;
    }
    const ratio = value !== undefined && scale ? Math.min(100, Math.max(0, (value - scale.min) / (scale.max - scale.min) * 100)) : 0;
    return html`<div class=probe data-entity=${id} data-tone=${tone} data-available=${availability} style=${custom ? `--fio-accent:${custom}` : ''}>
      <button type=button class=probe-head ?disabled=${!state} @click=${() => this.more(id)}>
        <strong class=probe-value>${text}</strong>
      </button>
      <div class=bar aria-hidden=true><span class=fill style=${`width:${ratio}%`}></span></div>
      ${scale ? html`<div class=limits aria-hidden=true><span>${scale.min}</span><span>${scale.max}</span></div>` : nothing}
    </div>`;
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const id = config.entity;
    const state = id ? hass.states[id] : undefined;
    const prefix = probeNamePrefix(config, hass.states);
    const label = id ? probeLabel(config, state, prefix) : '';
    return html`<ha-card><div class=body>
      ${id ? html`${label ? html`<h3 class=title>${label}</h3>` : nothing}<div class=probes>${this.probe(id, prefix)}</div>` : html`<p class=empty>Aucune entité sélectionnée.</p>`}
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit);--fio-accent:var(--primary-color);--fio-water:var(--flowio-water-color,var(--blue-color,var(--primary-color)));--fio-air:var(--flowio-air-color,var(--amber-color,var(--accent-color,var(--primary-color))));--fio-ph:var(--flowio-ph-color,var(--purple-color,var(--accent-color,var(--primary-color))));--fio-orp:var(--flowio-orp-color,var(--cyan-color,var(--info-color,var(--primary-color))));--fio-pressure:var(--flowio-pressure-color,var(--orange-color,var(--accent-color,var(--primary-color))))}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .title{margin:0 0 8px;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .empty{margin:0;font-size:calc(.82rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .probes{display:block}
    .probe{min-width:0}
    .probe[data-tone=water]{--fio-accent:var(--fio-water)}
    .probe[data-tone=air]{--fio-accent:var(--fio-air)}
    .probe[data-tone=ph]{--fio-accent:var(--fio-ph)}
    .probe[data-tone=orp]{--fio-accent:var(--fio-orp)}
    .probe[data-tone=pressure]{--fio-accent:var(--fio-pressure)}
    .probe-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;width:100%;min-width:0;padding:0;border:0;background:none;text-align:left;font:inherit;color:inherit;cursor:pointer;overflow-wrap:anywhere}
    .probe-head:disabled{cursor:default}
    .probe-name{font-size:calc(.86rem * var(--fio-font-scale, 1.32));font-weight:600;line-height:1.3}
    .probe-value{font-size:calc(.9rem * var(--fio-font-scale, 1.32));font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
    .bar{position:relative;height:12px;margin-top:8px;border-radius:999px;background:var(--secondary-background-color);overflow:hidden}
    .fill{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--fio-accent),color-mix(in srgb,var(--fio-accent) 45%,var(--ha-card-background,var(--card-background-color))));transition:width .2s ease}
    .limits{display:flex;justify-content:space-between;margin-top:5px;font-size:calc(.62rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color);font-variant-numeric:tabular-nums}
    .probe.gauge{display:flex;flex-direction:column;gap:4px}
    .probe.gauge flowio-gauge{width:100%;max-width:100%;margin-top:4px}
    @media (prefers-reduced-motion: reduce){.fill{transition:none}}
  `;
}

class FlowioProbeCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: ProbeConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeProbeConfig(input); this.error = ''; }

  private commit(config: ProbeConfig) {
    this.config = config;
    this.error = '';
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    if (!this.config) return;
    try {
      const value = (event.detail?.value ?? {}) as Record<string, unknown>;
      this.commit(normalizeProbeConfig({ ...value, item: this.config.item }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private setItem(patch: { name?: string; color?: string; min?: number; max?: number; mode?: string }) {
    if (!this.config) return;
    try {
      const next: Record<string, unknown> = { ...this.config.item };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || (value === '' && key !== 'name')) delete next[key];
        else next[key] = value;
      }
      this.commit(normalizeProbeConfig({ ...this.config, item: next }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private setScale(minRaw: string, maxRaw: string) {
    const min = minRaw === '' ? undefined : Number(minRaw);
    const max = maxRaw === '' ? undefined : Number(maxRaw);
    this.setItem({ min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined });
  }

  private options(): { value: string; label: string }[] {
    if (!this.hass || !this.config) return [];
    const stem = this.config.entity_prefix ? `${this.config.entity_prefix}_` : '';
    const ids = Object.keys(this.hass.states).filter(id => id.startsWith(`sensor.${stem}`)).sort();
    const prefix = probeNamePrefix(this.config, this.hass.states);
    return ids.map(id => ({ value: id, label: `${probeDisplayName(rawProbeName(id, this.hass!.states[id]), prefix)} · ${id}` }));
  }

  private item() {
    const config = this.config!, id = config.entity, item = config.item;
    const label = probeLabel(config, this.hass!.states[id], probeNamePrefix(config, this.hass!.states));
    const selected = item.color ?? '';
    return html`<div class=items>
      <label class=field><span>Nom convivial</span><input type=text .value=${item.name ?? ''} placeholder=${label} @change=${(event: Event) => this.setItem({ name: (event.target as HTMLInputElement).value })}></label>
      <div class=field><span>Min / Max</span><div class=scales><input type=number .value=${item.min ?? ''} placeholder=${'min'} @change=${(event: Event) => this.setScale((event.target as HTMLInputElement).value, item.max === undefined ? '' : String(item.max))}><input type=number .value=${item.max ?? ''} placeholder=${'max'} @change=${(event: Event) => this.setScale(item.min === undefined ? '' : String(item.min), (event.target as HTMLInputElement).value)}></div></div>
      <label class=field><span>Mode</span><select @change=${(event: Event) => this.setItem({ mode: (event.target as HTMLSelectElement).value })}>${PROBE_MODES.map(mode => html`<option value=${mode} ?selected=${(item.mode ?? 'line') === mode}>${mode === 'gauge' ? 'Gauge' : 'Ligne'}</option>`)}</select></label>
      <div class=field><span>Couleur</span><div class=swatches role=group aria-label=${`Couleur de ${label}`}>
        <button type=button class="swatch auto" data-selected=${selected ? 'false' : 'true'} title="Automatique" aria-label=${`Couleur automatique pour ${label}`} @click=${() => this.setItem({ color: '' })}>Auto</button>
        ${PALETTE.map(hex => html`<button type=button class=swatch style=${`--swatch:${hex}`} data-selected=${selected === hex ? 'true' : 'false'} title=${hex} aria-label=${`Couleur ${hex} pour ${label}`} @click=${() => this.setItem({ color: hex })}></button>`)}
      </div></div>
    </div>`;
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const labels: Record<string, string> = {
      entity_prefix: 'Préfixe firmware',
      name_prefix: 'Texte à retirer devant les noms (vide = automatique)',
      entity: 'Entité'
    };
    const schema = [
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'name_prefix', selector: { text: {} } },
      { name: 'entity', selector: { select: { mode: 'dropdown', options: this.options() } } }
    ];
    return html`<p>Choisir une entité puis personnaliser son nom, sa couleur, son échelle et son mode (barre ou jauge). « Auto » reprend la détection Flow.io.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>${this.config.entity ? this.item() : nothing}`;
  }

  static styles = css`
    :host{display:block}
    p{color:var(--secondary-text-color);line-height:1.5}
    p[role=alert]{color:var(--error-color)}
    .items{margin-top:16px}
    .field{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
    .field>span{font-size:calc(.75rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .field input,.field select{min-height:40px;width:100%;box-sizing:border-box;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:0 8px}
    .scales{display:flex;gap:8px}
    .scales input{min-width:0}
    .swatches{display:flex;flex-wrap:wrap;gap:6px}
    .swatch{width:26px;height:26px;padding:0;border-radius:50%;border:1px solid var(--divider-color);background:var(--swatch);cursor:pointer}
    .swatch.auto{width:auto;padding:0 10px;border-radius:999px;background:var(--secondary-background-color);font:inherit;font-size:calc(.72rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .swatch[data-selected=true]{outline:2px solid var(--primary-color);outline-offset:2px}
  `;
}

if (!customElements.get('flowio-probe-card')) customElements.define('flowio-probe-card', FlowioProbeCard);
if (!customElements.get('flowio-probe-card-editor')) customElements.define('flowio-probe-card-editor', FlowioProbeCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-probe-card')) {
  registry.customCards.push({ type: 'flowio-probe-card', name: 'Flow.io Sonde', description: 'Sonde unique avec barre ou jauge, nom, couleur et mode personnalisables.', preview: true });
}
