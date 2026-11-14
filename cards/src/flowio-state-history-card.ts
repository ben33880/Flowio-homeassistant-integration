import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import './order-list';
import type { EntityState, Hass } from './model';
import { baseStyles } from './card-styles';
import { onIntervals } from './history-data';
import { commonEntityPrefix } from './names';
import { mergeOrder, orderItems } from './order-list';
import {
  clockTime,
  formatDuration,
  isActive,
  normalizeStateHistoryConfig,
  STATE_PALETTE,
  stateActiveColor,
  stateHistoryIds,
  stateIcon,
  stateLabel,
  todayBounds,
  totalDuration,
  type StateHistoryConfig
} from './state-history-model';

type StateHass = Hass & {
  callApi?: (method: string, path: string) => Promise<unknown>;
  config?: { time_zone?: string };
};

interface Row {
  id: string;
  name: string;
  icon: string;
  intervals: [number, number][];
  total: number;
  on: boolean;
  state?: EntityState;
  error?: string;
}

const TICKS = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00'];
const DAY_MS = 86400000;

class FlowioStateHistoryCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { state: true },
    rows: { state: true },
    now: { state: true },
    loading: { state: true },
    error: { state: true },
    start: { state: true }
  };
  declare hass?: StateHass;
  private config?: StateHistoryConfig;
  private rows: Row[] = [];
  private now = Date.now();
  private loading = false;
  private error = '';
  private start = 0;
  private generation = 0;
  private loaded = false;
  private timer?: number;

  static getConfigElement() { return document.createElement('flowio-state-history-card-editor'); }
  static getStubConfig(): StateHistoryConfig { return normalizeStateHistoryConfig({}); }
  getCardSize() { return 3 + Math.max(1, this.config?.entities.length ?? 0); }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  setConfig(input: unknown) {
    this.config = normalizeStateHistoryConfig(input);
    this.rows = [];
    this.error = '';
    this.loaded = false;
    ++this.generation;
    if (this.isConnected && this.hass) void this.load();
  }

  connectedCallback() {
    super.connectedCallback();
    this.now = Date.now();
    this.timer = window.setInterval(() => {
      this.now = Date.now();
      if (!this.loading && this.config?.entities.length && this.hass) void this.load();
    }, 60000);
    if (this.config && this.hass) void this.load();
  }

  disconnectedCallback() {
    ++this.generation;
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected updated(_changed: PropertyValues) {
    if (!this.loaded && !this.loading && !this.error && this.config && this.hass) void this.load();
  }

  private namePrefix(): string {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return '';
    return config.name_prefix || commonEntityPrefix(config.entities, hass.states);
  }

  private more(id: string) {
    if (this.hass?.states[id]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true }));
    }
  }

  private pct(time: number) {
    return Math.min(100, Math.max(0, (time - this.start) / DAY_MS * 100));
  }

  private async load() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return;
    const token = ++this.generation;
    this.error = '';
    this.loading = true;
    this.loaded = true;
    const ids = config.entities;
    if (!ids.length) { this.rows = []; this.loading = false; return; }
    if (!hass.callApi) {
      this.rows = [];
      this.error = 'Impossible de charger les historiques : API Home Assistant indisponible.';
      this.loading = false;
      return;
    }
    const api = hass.callApi.bind(hass);
    const now = Date.now();
    this.now = now;
    const bounds = todayBounds(now);
    this.start = bounds.start;
    const prefix = this.namePrefix();
    const rows = await Promise.all(ids.map(async (id): Promise<Row> => {
      const state = hass.states[id];
      const name = stateLabel(config, id, state, prefix);
      const icon = stateIcon(id, state);
      if (!state) return { id, name, icon, intervals: [], total: 0, on: false };
      const active = isActive(state);
      try {
        const query = new URLSearchParams({ filter_entity_id: id, end_time: new Date(now).toISOString() });
        const response = await api('GET', `history/period/${new Date(bounds.start).toISOString()}?${query}`);
        const intervals = onIntervals(response, bounds.start, now, active);
        return { id, name, icon, intervals, total: totalDuration(intervals), on: active, state };
      } catch {
        return { id, name, icon, intervals: [], total: 0, on: active, state, error: 'Historique indisponible. Vérifier le Recorder et les droits.' };
      }
    }));
    if (token !== this.generation || !this.isConnected) return;
    this.rows = rows;
    this.loading = false;
  }

  private row(row: Row, index: number) {
    const line = index + 1;
    const color = this.config ? stateActiveColor(this.config, row.id) : '';
    const tint = color ? `--fio-state-active:${color}` : '';
    const label = row.error ? row.error : `${row.name} · ${row.on ? 'actif' : 'inactif'} · ${formatDuration(row.total)} sur la journée`;
    return html`
      <span class=row-icon style=${`grid-row:${line};grid-column:1;${tint}`} data-on=${row.on ? 'true' : 'false'}><ha-icon .icon=${row.icon} aria-hidden=true></ha-icon></span>
      <button type=button class=row-name style=${`grid-row:${line};grid-column:2`} ?disabled=${!row.state} @click=${() => this.more(row.id)} aria-label=${`Détail ${row.name}`}>${row.name}</button>
      <div class=track style=${`grid-row:${line};grid-column:3;${tint}`} role=img aria-label=${label}>
        ${row.intervals.map(([from, to]) => html`<span class=seg style=${`left:${this.pct(from)}%;width:${Math.max(0, this.pct(to) - this.pct(from))}%`}></span>`)}
      </div>
      <span class=row-total style=${`grid-row:${line};grid-column:4`}>${formatDuration(row.total)}</span>`;
  }

  render() {
    const config = this.config;
    if (!config) return nothing;
    const rows = this.rows;
    const nowPct = this.pct(this.now);
    const clock = clockTime(this.now, this.hass?.config?.time_zone);
    return html`
      <ha-card><div class=body>
        <h3 class=title>${config.title}</h3>
        ${!config.entities.length ? html`<p class=message>Choisir les entités dans l’éditeur.</p>` : nothing}
        ${this.error ? html`<p class=warning role=alert>${this.error}</p>` : nothing}
        ${rows.length ? html`<div class=board>
          ${rows.map((row, index) => this.row(row, index))}
          <span class=now-track style=${`grid-row:1 / span ${rows.length};grid-column:3`}>
            <span class=now-line style=${`left:${nowPct}%`} aria-hidden=true></span>
            <span class=now-label style=${`left:${nowPct}%`}>${clock}</span>
          </span>
          <div class=axis style=${`grid-row:${rows.length + 1};grid-column:3`}>
            ${TICKS.map((tick, index) => html`<span class=${`tick ${index === 0 ? 'start' : index === TICKS.length - 1 ? 'end' : 'center'}`} style=${`left:${index / (TICKS.length - 1) * 100}%`}>${tick}</span>`)}
          </div>
        </div>` : nothing}
        ${this.loading ? html`<p class=message role=status>Chargement des historiques…</p>` : nothing}
      </div></ha-card>`;
  }

  static styles = [baseStyles, css`
    :host{--fio-state-active:var(--fio-air,var(--accent-color,var(--primary-color)));--fio-now:var(--fio-water)}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .title{margin:0 0 14px;min-width:0;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25;letter-spacing:normal;color:var(--primary-text-color);overflow-wrap:anywhere}
    .board{display:grid;grid-template-columns:28px minmax(0,26%) minmax(0,1fr) auto;column-gap:12px;row-gap:12px;align-items:center;padding-top:24px}
    .row-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--secondary-text-color)}
    .row-icon[data-on=true]{color:var(--fio-state-active)}
    .row-icon ha-icon{--mdc-icon-size:22px}
    .row-name{min-width:0;padding:0;border:0;background:none;text-align:left;font-family:inherit;font-size:var(--ha-font-size-m, calc(.9rem * var(--fio-font-scale, 1.32)));font-weight:400;line-height:1.25;color:var(--primary-text-color);overflow-wrap:anywhere;cursor:pointer}
    .row-name:disabled{cursor:default;color:var(--secondary-text-color)}
    .track{position:relative;height:8px;border-radius:999px;background:var(--secondary-background-color);box-shadow:inset 0 0 0 1px var(--divider-color)}
    .seg{position:absolute;inset-block:0;border-radius:999px;background:var(--fio-state-active)}
    .row-total{justify-self:end;font-size:var(--ha-font-size-m, calc(.9rem * var(--fio-font-scale, 1.32)));font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}
    .now-track{position:relative;align-self:stretch;pointer-events:none}
    .now-line{position:absolute;top:0;bottom:-14px;width:2px;transform:translateX(-50%);border-radius:2px;background:var(--fio-now)}
    .axis{position:relative;height:22px;border-top:1px solid var(--divider-color);font-size:var(--ha-font-size-s, calc(.6rem * var(--fio-font-scale, 1.32)));font-weight:600;color:var(--secondary-text-color);font-variant-numeric:tabular-nums}
    .tick{position:absolute;top:7px;white-space:nowrap}
    .tick.start{transform:translateX(0)}
    .tick.center{transform:translateX(-50%)}
    .tick.end{transform:translateX(-100%)}
    .now-label{position:absolute;top:-24px;transform:translateX(-50%);padding:3px 8px;border-radius:999px;background:var(--fio-now);color:var(--text-primary-color,#fff);font-size:var(--ha-font-size-s, calc(.66rem * var(--fio-font-scale, 1.32)));font-weight:700;white-space:nowrap;box-shadow:0 2px 6px color-mix(in srgb,var(--fio-now) 30%,transparent)}
    .message{margin:8px 0;font-size:var(--ha-font-size-m, calc(.9rem * var(--fio-font-scale, 1.32)));color:var(--secondary-text-color)}
    .warning{margin:8px 0;font-size:var(--ha-font-size-m, calc(.9rem * var(--fio-font-scale, 1.32)));color:var(--error-color)}
    @container(max-width:640px){.tick:nth-child(even){display:none}}
    @container(max-width:600px){.tick:not(:nth-child(1)):not(:nth-child(5)):not(:nth-child(9)){display:none}}
    @media (prefers-reduced-motion: reduce){*{transition:none!important}}
  `];
}

class FlowioStateHistoryEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: StateHistoryConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeStateHistoryConfig(input); this.error = ''; }

  private commit(config: StateHistoryConfig) {
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
      this.commit(normalizeStateHistoryConfig({ ...value, entities: mergeOrder(this.config.entities, selected), items: this.config.items }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private reorder(order: string[]) {
    if (!this.config) return;
    try {
      this.commit(normalizeStateHistoryConfig({ ...this.config, entities: order }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private setItem(id: string, patch: { name?: string; color?: string }) {
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
      this.commit(normalizeStateHistoryConfig({ ...this.config, items }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private item(id: string, prefix: string) {
    const config = this.config!;
    const item = config.items[id] ?? {};
    const label = stateLabel(config, id, this.hass!.states[id], prefix);
    const selected = item.color ?? '';
    return html`<details class=item>
      <summary>${label}</summary>
      <label class=field><span>Nom affiché</span><input type=text .value=${item.name ?? ''} placeholder=${label} @change=${(event: Event) => this.setItem(id, { name: (event.target as HTMLInputElement).value })}></label>
      <div class=field><span>Couleur quand actif</span><div class=swatches role=group aria-label=${`Couleur de ${label}`}>
        <button type=button class="swatch auto" data-selected=${selected ? 'false' : 'true'} title="Automatique" aria-label=${`Couleur automatique pour ${label}`} @click=${() => this.setItem(id, { color: '' })}>Auto</button>
        ${STATE_PALETTE.map(hex => html`<button type=button class=swatch style=${`--swatch:${hex}`} data-selected=${selected === hex ? 'true' : 'false'} title=${hex} aria-label=${`Couleur ${hex} pour ${label}`} @click=${() => this.setItem(id, { color: hex })}></button>`)}
      </div></div>
    </details>`;
  }

  private options(): { value: string; label: string }[] {
    if (!this.hass || !this.config) return [];
    const ids = stateHistoryIds(this.hass, this.config.entity_prefix ?? 'fio');
    const prefix = this.config.name_prefix || commonEntityPrefix(ids, this.hass.states);
    return ids.map(id => ({ value: id, label: `${stateLabel(this.config!, id, this.hass!.states[id], prefix)} · ${id}` }));
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'name_prefix', selector: { text: {} } }
    ];
    const entitySchema = [{ name: 'entities', selector: { select: { multiple: true, mode: 'list', options: this.options() } } }];
    const labels: Record<string, string> = {
      title: 'Titre',
      entity_prefix: 'Préfixe firmware',
      name_prefix: 'Texte à retirer devant les noms (vide = automatique)',
      entities: 'Entités affichées (interrupteurs et binaires)'
    };
    const computeLabel = (field: { name: string }) => labels[field.name] ?? field.name;
    const prefix = this.config.name_prefix || commonEntityPrefix(this.config.entities, this.hass.states);
    const items = orderItems(this.config.entities, this.hass.states, prefix);
    return html`<p>Choisir les interrupteurs et capteurs binaires Flow.io à suivre. La carte couvre les 24 heures de la journée en cours. Chaque entité peut recevoir un nom affiché et une couleur d’activation personnalisés ; l’ordre et le texte à retirer devant les noms sont réglables.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form><flowio-order-list .items=${items} @order-changed=${(event: CustomEvent) => this.reorder(event.detail.order)}></flowio-order-list><ha-form .hass=${this.hass} .data=${this.config} .schema=${entitySchema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form>${this.config.entities.length ? html`<div class=items><h4>Entités</h4>${this.config.entities.map(id => this.item(id, prefix))}</div>` : nothing}`;
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
    .field input{min-height:40px;width:100%;box-sizing:border-box;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:0 8px}
    .swatches{display:flex;flex-wrap:wrap;gap:6px}
    .swatch{width:26px;height:26px;padding:0;border-radius:50%;border:1px solid var(--divider-color);background:var(--swatch);cursor:pointer}
    .swatch.auto{width:auto;padding:0 10px;border-radius:999px;background:var(--secondary-background-color);font:inherit;font-size:calc(.72rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .swatch[data-selected=true]{outline:2px solid var(--primary-color);outline-offset:2px}
  `;
}

if (!customElements.get('flowio-state-history-card')) customElements.define('flowio-state-history-card', FlowioStateHistoryCard);
if (!customElements.get('flowio-state-history-card-editor')) customElements.define('flowio-state-history-card-editor', FlowioStateHistoryEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-state-history-card')) {
  registry.customCards.push({ type: 'flowio-state-history-card', name: 'Flow.io Historique des états', description: 'Frise des états booléens (interrupteurs et binaires) sur les 24 h du jour.', preview: true });
}
