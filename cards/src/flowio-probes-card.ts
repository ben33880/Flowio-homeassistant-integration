import { LitElement, html, css, nothing } from 'lit';
import './flowio-gauge';
import './order-list';
import { mergeOrder, orderItems } from './order-list';
import { available, type Hass } from './model';
import {
  PROBE_MODES,
  commonEntityPrefix,
  normalizeProbesConfig,
  probeIds,
  probeLabel,
  probeDisplayName,
  probeMode,
  probeScale,
  probeValue,
  rawProbeName,
  resolveProbeColor,
  type ProbesConfig
} from './probes-model';

const PALETTE = ['#0288d1', '#00acc1', '#26a69a', '#43a047', '#7cb342', '#fbc02d', '#ffa000', '#f4511e', '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#546e7a', '#9e9e9e'];

class FlowioProbesCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  declare hass?: Hass;
  private config?: ProbesConfig;

  static getConfigElement() { return document.createElement('flowio-probes-card-editor'); }
  static getStubConfig(): ProbesConfig { return normalizeProbesConfig({}); }
  setConfig(input: unknown) { this.config = normalizeProbesConfig(input); }
  getCardSize() { return 4; }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  private probe(id: string, prefix: string) {
    const config = this.config!, state = this.hass!.states[id];
    const label = probeLabel(config, id, state, prefix);
    const unit = typeof state?.attributes.unit_of_measurement === 'string' ? state.attributes.unit_of_measurement : '';
    const value = probeValue(state);
    const scale = probeScale(config, id, state);
    const text = !state ? 'Entité absente' : !available(state) ? 'Indisponible' : value === undefined ? state.state : `${state.state}${unit ? ` ${unit}` : ''}`;
    const { tone, custom } = resolveProbeColor(config, id, state);
    const availability = available(state) ? 'true' : 'false';
    if (probeMode(config, id) === 'gauge') {
      return html`<div class="probe gauge" data-entity=${id} data-tone=${tone} data-available=${availability} style=${custom ? `--fio-accent:${custom}` : ''}>
        <button type=button class=probe-head ?disabled=${!state} @click=${() => this.more(id)}>
          <span class=probe-name>${label}</span>
          <strong class=probe-value>${!state ? 'Entité absente' : !available(state) ? 'Indisponible' : ''}</strong>
        </button>
        <flowio-gauge .value=${value} .valueText=${state?.state} .min=${scale?.min} .max=${scale?.max} .variant=${'arc'} .label=${label} .unit=${unit}></flowio-gauge>
      </div>`;
    }
    const ratio = value !== undefined && scale ? Math.min(100, Math.max(0, (value - scale.min) / (scale.max - scale.min) * 100)) : 0;
    return html`<div class=probe data-entity=${id} data-tone=${tone} data-available=${availability} style=${custom ? `--fio-accent:${custom}` : ''}>
      <button type=button class=probe-head ?disabled=${!state} @click=${() => this.more(id)}>
        <span class=probe-name>${label}</span>
        <strong class=probe-value>${text}</strong>
      </button>
      <div class=bar aria-hidden=true><span class=fill style=${`width:${ratio}%`}></span></div>
      ${scale ? html`<div class=limits aria-hidden=true><span>${scale.min}</span><span>${scale.max}</span></div>` : nothing}
    </div>`;
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const ids = probeIds(config);
    const prefix = config.name_prefix || commonEntityPrefix(ids, hass.states);
    return html`<ha-card><div class=body>
      ${config.title ? html`<h3 class=title>${config.title}</h3>` : nothing}
      ${ids.length ? html`<div class=probes style=${`--columns:${config.columns}`}>${ids.map(id => this.probe(id, prefix))}</div>`
        : html`<p class=empty>Aucune entité sélectionnée.</p>`}
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit);--fio-accent:var(--primary-color);--fio-water:var(--flowio-water-color,var(--blue-color,var(--primary-color)));--fio-air:var(--flowio-air-color,var(--amber-color,var(--accent-color,var(--primary-color))));--fio-ph:var(--flowio-ph-color,var(--purple-color,var(--accent-color,var(--primary-color))));--fio-orp:var(--flowio-orp-color,var(--cyan-color,var(--info-color,var(--primary-color))));--fio-pressure:var(--flowio-pressure-color,var(--orange-color,var(--accent-color,var(--primary-color))))}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .title{margin:0 0 8px;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .empty{margin:0;font-size:calc(.82rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .probes{display:grid;grid-template-columns:repeat(var(--columns,2),minmax(0,1fr));gap:16px;align-items:start}
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
    @container(max-width:420px){.probes{grid-template-columns:minmax(0,1fr)}}
    @media (prefers-reduced-motion: reduce){.fill{transition:none}}
  `;
}

class FlowioProbesCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: ProbesConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeProbesConfig(input); this.error = ''; }

  private commit(config: ProbesConfig) {
    this.config = config;
    this.error = '';
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    if (!this.config) return;
    try {
      const value = (event.detail?.value ?? {}) as Record<string, unknown>;
      const selected = Array.isArray(value.entities) ? value.entities as string[] : this.config.entities;
      this.commit(normalizeProbesConfig({ ...value, entities: mergeOrder(this.config.entities, selected), items: this.config.items }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private reorder(order: string[]) {
    if (!this.config) return;
    try {
      this.commit(normalizeProbesConfig({ ...this.config, entities: order }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private setItem(id: string, patch: { name?: string; color?: string; min?: number; max?: number; mode?: string }) {
    if (!this.config) return;
    try {
      const items = { ...this.config.items };
      const next: Record<string, unknown> = { ...items[id] };
      for (const [key, value] of Object.entries(patch)) {
        if (value === '' || value === undefined) delete next[key];
        else next[key] = value;
      }
      if (Object.keys(next).length) items[id] = next as never;
      else delete items[id];
      this.commit(normalizeProbesConfig({ ...this.config, items }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private setScale(id: string, minRaw: string, maxRaw: string) {
    const min = minRaw === '' ? undefined : Number(minRaw);
    const max = maxRaw === '' ? undefined : Number(maxRaw);
    this.setItem(id, { min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined });
  }

  private ids(): string[] {
    return this.config ? probeIds(this.config) : [];
  }

  private options(): { value: string; label: string }[] {
    if (!this.hass) return [];
    const stem = this.config?.entity_prefix ? `${this.config.entity_prefix}_` : '';
    const ids = Object.keys(this.hass.states).filter(id => id.startsWith(`sensor.${stem}`)).sort();
    const prefix = this.config?.name_prefix || commonEntityPrefix(ids, this.hass.states);
    return ids.map(id => ({ value: id, label: `${probeDisplayName(rawProbeName(id, this.hass!.states[id]), prefix)} · ${id}` }));
  }

  private item(id: string, prefix: string) {
    const item = this.config!.items[id] ?? {};
    const label = probeLabel(this.config!, id, this.hass!.states[id], prefix);
    const selected = item.color ?? '';
    return html`<details class=item>
      <summary>${label}</summary>
      <label class=field><span>Nom convivial</span><input type=text .value=${item.name ?? ''} placeholder=${label} @change=${(event: Event) => this.setItem(id, { name: (event.target as HTMLInputElement).value })}></label>
      <div class=field><span>Min / Max</span><div class=scales><input type=number .value=${item.min ?? ''} placeholder=${'min'} @change=${(event: Event) => this.setScale(id, (event.target as HTMLInputElement).value, item.max === undefined ? '' : String(item.max))}><input type=number .value=${item.max ?? ''} placeholder=${'max'} @change=${(event: Event) => this.setScale(id, item.min === undefined ? '' : String(item.min), (event.target as HTMLInputElement).value)}></div></div>
      <label class=field><span>Mode</span><select @change=${(event: Event) => this.setItem(id, { mode: (event.target as HTMLSelectElement).value })}>${PROBE_MODES.map(mode => html`<option value=${mode} ?selected=${(item.mode ?? 'line') === mode}>${mode === 'gauge' ? 'Gauge' : 'Ligne'}</option>`)}</select></label>
      <div class=field><span>Couleur</span><div class=swatches role=group aria-label=${`Couleur de ${label}`}>
        <button type=button class="swatch auto" data-selected=${selected ? 'false' : 'true'} title="Automatique" aria-label=${`Couleur automatique pour ${label}`} @click=${() => this.setItem(id, { color: '' })}>Auto</button>
        ${PALETTE.map(hex => html`<button type=button class=swatch style=${`--swatch:${hex}`} data-selected=${selected === hex ? 'true' : 'false'} title=${hex} aria-label=${`Couleur ${hex} pour ${label}`} @click=${() => this.setItem(id, { color: hex })}></button>`)}
      </div></div>
    </details>`;
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const ids = this.ids();
    const prefix = this.config.name_prefix || commonEntityPrefix(ids, this.hass.states);
    const labels: Record<string, string> = {
      title: 'Titre',
      entity_prefix: 'Préfixe firmware',
      name_prefix: 'Texte à retirer devant les noms (vide = automatique)',
      columns: 'Colonnes',
      entities: 'Entités'
    };
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'name_prefix', selector: { text: {} } },
      { name: 'columns', selector: { number: { min: 1, max: 6, step: 1, mode: 'box' } } }
    ];
    const entitySchema = [{ name: 'entities', selector: { select: { multiple: true, mode: 'list', options: this.options() } } }];
    const computeLabel = (field: { name: string }) => labels[field.name] ?? field.name;
    const items = orderItems(ids, this.hass.states, prefix);
    return html`<p>Chaque sonde peut être personnalisée (nom, couleur, min/max, mode). « Auto » reprend la détection Flow.io.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form><flowio-order-list .items=${items} @order-changed=${(event: CustomEvent) => this.reorder(event.detail.order)}></flowio-order-list><ha-form .hass=${this.hass} .data=${this.config} .schema=${entitySchema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form>${ids.length ? html`<div class=items><h4>Sondes</h4>${ids.map(id => this.item(id, prefix))}</div>` : nothing}`;
  }

  static styles = css`
    :host{display:block}
    p{color:var(--secondary-text-color);line-height:1.5}
    p[role=alert]{color:var(--error-color)}
    .items{margin-top:16px}
    .items h4{margin:0 0 10px;font-size:calc(.9rem * var(--fio-font-scale, 1.32))}
    .item{border:1px solid var(--divider-color);border-radius:10px;margin-bottom:8px;padding:0 12px}
    .item summary{cursor:pointer;padding:10px 0;font-size:calc(.85rem * var(--fio-font-scale, 1.32));font-weight:600}
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

if (!customElements.get('flowio-probes-card')) customElements.define('flowio-probes-card', FlowioProbesCard);
if (!customElements.get('flowio-probes-card-editor')) customElements.define('flowio-probes-card-editor', FlowioProbesCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-probes-card')) {
  registry.customCards.push({ type: 'flowio-probes-card', name: 'Flow.io Sondes', description: 'Sondes dynamiques avec barres ou jauges et couleurs personnalisables.', preview: true });
}
