import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import './flowio-graph-chart';
import { available, type Hass } from './model';
import { numericValue } from './gauge-model';
import { consolidatePoints, consolidationMs, historyPoints, historySummary, onIntervals, statisticsPoints, type HistoryPoint } from './history-data';
import { commonEntityPrefix, probeDisplayName, rawProbeName } from './probes-model';
import { GRAPH_PALETTE, SHADE_PALETTE, defaultShadeColor, normalizeGraphConfig, seriesColor, shadeColor, type GraphConfig } from './graph-model';

type GraphHass = Hass & {
  callApi?: (method: string, path: string) => Promise<unknown>;
  callWS?: (message: Record<string, unknown>) => Promise<unknown>;
};
interface LoadedSeries { id: string; name: string; color: string; unit: string; points: HistoryPoint[]; }

class FlowioGraphCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, loaded: { state: true }, hours: { state: true }, loading: { state: true }, error: { state: true }, start: { state: true }, end: { state: true } };
  declare hass?: GraphHass;
  private config?: GraphConfig;
  private loaded: LoadedSeries[] = [];
  private chartSeries: { name: string; color: string; points: HistoryPoint[] }[] = [];
  private ranges: { from: number; to: number; color: string }[] = [];
  private hours = 12;
  private loading = false;
  private error = '';
  private start = 0;
  private end = 0;
  private generation = 0;
  private done = false;
  private timer?: number;

  static getConfigElement() { return document.createElement('flowio-graph-card-editor'); }
  static getStubConfig(): GraphConfig { return normalizeGraphConfig({}); }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 6, min_columns: 3 }; }

  setConfig(input: unknown) {
    this.config = normalizeGraphConfig(input);
    this.hours = this.config.hours_to_show;
    this.loaded = [];
    this.error = '';
    this.done = false;
    ++this.generation;
    if (this.isConnected && this.hass) void this.load();
  }

  connectedCallback() {
    super.connectedCallback();
    this.timer = window.setInterval(() => { if (!this.loading && this.config?.entities.length && this.hass) void this.load(); }, 60000);
    if (this.config && this.hass) void this.load();
  }

  disconnectedCallback() {
    ++this.generation;
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  protected updated(_changed: PropertyValues) {
    if (!this.done && !this.loading && !this.error && this.config && this.hass) void this.load();
  }

  private namePrefix(): string {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return '';
    return config.name_prefix || commonEntityPrefix(config.entities, hass.states);
  }

  private async loadPoints(id: string, start: number, end: number): Promise<HistoryPoint[]> {
    const hass = this.hass!, api = hass.callApi!.bind(hass);
    const bucket = consolidationMs(this.hours);
    if (hass.callWS && hass.states[id]?.attributes.state_class === 'measurement') {
      try {
        const statistics = await hass.callWS({
          type: 'recorder/statistics_during_period',
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
          statistic_ids: [id],
          period: this.hours > 24 ? 'hour' : '5minute',
          types: ['mean']
        });
        const points = statisticsPoints(statistics, start, end);
        if (points.length) return consolidatePoints(points, bucket);
      } catch {
        // retombe sur l’historique brut
      }
    }
    const query = new URLSearchParams({ filter_entity_id: id, end_time: new Date(end).toISOString(), minimal_response: '', no_attributes: '' });
    const response = await api('GET', `history/period/${new Date(start).toISOString()}?${query}`);
    return consolidatePoints(historyPoints(response, 'ph', hass.states[id]?.attributes.unit_of_measurement, start, end), bucket);
  }

  private async load() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return;
    const token = ++this.generation;
    this.error = '';
    this.loading = true;
    this.done = true;
    const ids = config.entities;
    if (!ids.length) { this.loaded = []; this.loading = false; return; }
    if (!hass.callApi) {
      this.loaded = [];
      this.error = 'Impossible de charger les historiques : API Home Assistant indisponible.';
      this.loading = false;
      return;
    }
    const api = hass.callApi.bind(hass);
    this.end = Date.now();
    this.start = this.end - this.hours * 3600000;
    const start = this.start, end = this.end, prefix = this.namePrefix();
    const results = await Promise.all(ids.map(async (id, index): Promise<LoadedSeries> => {
      const sourceUnit = hass.states[id]?.attributes.unit_of_measurement;
      const unit = typeof sourceUnit === 'string' ? sourceUnit : '';
      const name = probeDisplayName(rawProbeName(id, hass.states[id]), prefix);
      const color = seriesColor(config, id, index);
      try {
        return { id, name, color, unit, points: await this.loadPoints(id, start, end) };
      } catch {
        return { id, name, color, unit, points: [] };
      }
    }));
    const shadeIds = Object.keys(config.shades);
    const shadeResults = await Promise.all(shadeIds.map(async (id, index) => {
      const color = shadeColor(config, id, index);
      const currentOn = hass.states[id]?.state === 'on';
      try {
        const query = new URLSearchParams({ filter_entity_id: id, end_time: new Date(end).toISOString(), minimal_response: '' });
        const response = await api('GET', `history/period/${new Date(start).toISOString()}?${query}`);
        return { color, intervals: onIntervals(response, start, end, currentOn) };
      } catch {
        return { color, intervals: [] as [number, number][] };
      }
    }));
    if (token !== this.generation || !this.isConnected) return;
    this.loaded = results;
    this.chartSeries = results.map(item => ({ name: item.name, color: item.color, points: item.points }));
    this.ranges = shadeResults.flatMap(result => result.intervals.map(([from, to]) => ({ from, to, color: result.color })));
    this.loading = false;
  }

  private select(hours: number) {
    if (hours === this.hours) return;
    this.hours = hours;
    this.loaded = [];
    void this.load();
  }

  private format(value: number | undefined, unit: string): string {
    if (value === undefined) return '—';
    const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return nothing;
    const single = config.entities.length === 1 ? this.loaded[0] : undefined;
    const singleState = single ? hass.states[single.id] : undefined;
    const title = config.title !== 'Graphique' ? config.title : (single ? single.name : 'Graphique');
    const icon = typeof singleState?.attributes.icon === 'string' && singleState.attributes.icon ? singleState.attributes.icon : 'mdi:chart-line';
    const current = singleState && available(singleState) ? numericValue(singleState.state) : undefined;
    const summary = single ? historySummary(single.points) : undefined;
    return html`<ha-card><div class=body>
      <div class=head>
        <span class=icon-plate><ha-icon .icon=${icon} aria-hidden=true></ha-icon></span>
        <div class=head-copy>
          <span class=name>${title}</span>
          ${single ? html`<span class=unit>${single.unit || 'Sans unité'}</span>` : nothing}
        </div>
        <div class=head-side>
          ${single ? html`<button type=button class=current ?disabled=${!singleState} @click=${() => this.more(single.id)}><strong>${this.format(current, '')}</strong><small>${!singleState ? 'Entité absente' : !available(singleState) ? 'Indisponible' : 'Actuel'}</small></button>` : nothing}
          <div class=ranges role=group aria-label="Période du graphique">${[6, 12, 24, 168].map(hours => html`<button type=button class=range data-selected=${this.hours === hours ? 'true' : 'false'} aria-pressed=${this.hours === hours ? 'true' : 'false'} @click=${() => this.select(hours)}>${hours === 168 ? '7j' : `${hours}h`}</button>`)}</div>
        </div>
      </div>
      ${!config.entities.length ? html`<p class=message>Choisir les entités dans l’éditeur.</p>` : nothing}
      ${this.error ? html`<p class=warning role=alert>${this.error}</p>` : nothing}
      <flowio-graph-chart .series=${this.chartSeries} .ranges=${this.ranges} .chartType=${config.chart_type} .label=${title} .unit=${single?.unit ?? ''} .start=${this.start} .end=${this.end}></flowio-graph-chart>
      ${config.show_stats && single && summary ? html`<div class=stats aria-label="Statistiques des échantillons disponibles"><span><small>Minimum</small><strong>${this.format(summary.min, '')}</strong></span><span><small>Moy. échant.</small><strong>${this.format(summary.mean, '')}</strong></span><span><small>Maximum</small><strong>${this.format(summary.max, '')}</strong></span></div>` : nothing}
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit)}
    ha-card{overflow:hidden}
    .body{padding:0}
    .head{display:flex;align-items:center;gap:12px;padding:16px 16px 0;flex-wrap:wrap}
    .head-side{display:flex;align-items:center;gap:14px;margin-inline-start:auto}
    .icon-plate{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;border-radius:12px;color:var(--secondary-text-color);background:color-mix(in srgb,var(--secondary-text-color) 12%,transparent)}
    .icon-plate ha-icon{--mdc-icon-size:24px}
    .head-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 0}
    .name{font-size:calc(.95rem * var(--fio-font-scale, 1.32));font-weight:600;line-height:1.25;overflow-wrap:anywhere}
    .unit{font-size:calc(.78rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .current{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:0;max-width:45%;padding:0;border:0;background:none;font:inherit;color:inherit;cursor:pointer}
    .current:disabled{cursor:default}
    .current strong{font-size:calc(1.5rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums}
    .current small{font-size:calc(.68rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .warning{margin:8px 16px 0;font-size:calc(.78rem * var(--fio-font-scale, 1.32));color:var(--error-color)}
    .message{margin:8px 16px 0;font-size:calc(.82rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .ranges{display:flex;gap:6px}
    .range{min-width:38px;height:32px;padding:0 8px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--secondary-text-color);font:inherit;font-size:calc(.72rem * var(--fio-font-scale, 1.32));font-weight:600;cursor:pointer}
    .range[data-selected=true]{border-color:var(--primary-color);color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 12%,var(--secondary-background-color))}
    .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:14px 16px;border-top:1px solid var(--divider-color)}
    .stats span{display:flex;flex-direction:column;gap:5px;min-width:0}
    .stats small{font-size:calc(.62rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .stats strong{font-size:calc(1rem * var(--fio-font-scale, 1.32));font-variant-numeric:tabular-nums}
  `;
}

class FlowioGraphCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: GraphConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeGraphConfig(input); this.error = ''; }

  private commit(config: GraphConfig) {
    this.config = config;
    this.error = '';
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    if (!this.config) return;
    try {
      const value = (event.detail?.value ?? {}) as Record<string, unknown>;
      const shadeEntities = Array.isArray(value.shade_entities) ? value.shade_entities as string[] : Object.keys(this.config.shades);
      const shades: Record<string, string> = {};
      shadeEntities.forEach((id, index) => { shades[id] = this.config!.shades[id] ?? defaultShadeColor(index); });
      const next: Record<string, unknown> = { ...value, colors: this.config.colors, shades };
      delete next.shade_entities;
      this.commit(normalizeGraphConfig(next));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private setColor(id: string, value: string) {
    if (!this.config) return;
    const colors = { ...this.config.colors };
    if (value) colors[id] = value;
    else delete colors[id];
    this.commit(normalizeGraphConfig({ ...this.config, colors }));
  }

  private setShadeColor(id: string, value: string) {
    if (!this.config) return;
    this.commit(normalizeGraphConfig({ ...this.config, shades: { ...this.config.shades, [id]: value } }));
  }

  private shadeOptions(): { value: string; label: string }[] {
    if (!this.hass) return [];
    const stem = this.config?.entity_prefix ? `${this.config.entity_prefix}_` : '';
    const ids = Object.keys(this.hass.states).filter(id => id.startsWith(`switch.${stem}`) || id.startsWith(`binary_sensor.${stem}`)).sort();
    const prefix = this.config?.name_prefix || commonEntityPrefix(ids, this.hass.states);
    return ids.map(id => ({ value: id, label: `${probeDisplayName(rawProbeName(id, this.hass!.states[id]), prefix)} · ${id}` }));
  }

  private namePrefix(): string {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return '';
    return config.name_prefix || commonEntityPrefix(config.entities, hass.states);
  }

  private options(): { value: string; label: string }[] {
    if (!this.hass) return [];
    const stem = this.config?.entity_prefix ? `${this.config.entity_prefix}_` : '';
    const ids = Object.keys(this.hass.states).filter(id => id.startsWith(`sensor.${stem}`)).sort();
    const prefix = this.config?.name_prefix || commonEntityPrefix(ids, this.hass.states);
    return ids.map(id => ({ value: id, label: `${probeDisplayName(rawProbeName(id, this.hass!.states[id]), prefix)} · ${id}` }));
  }

  private colorRow(id: string) {
    const selected = this.config!.colors[id] ?? '';
    const name = probeDisplayName(rawProbeName(id, this.hass!.states[id]), this.namePrefix());
    return html`<div class=color-row>
      <span class=color-name>${name}</span>
      <div class=swatches role=group aria-label=${`Couleur de ${name}`}>
        <button type=button class="swatch auto" data-selected=${selected ? 'false' : 'true'} title="Automatique" aria-label=${`Couleur automatique pour ${name}`} @click=${() => this.setColor(id, '')}>Auto</button>
        ${GRAPH_PALETTE.map(hex => html`<button type=button class=swatch style=${`--swatch:${hex}`} data-selected=${selected === hex ? 'true' : 'false'} title=${hex} aria-label=${`Couleur ${hex} pour ${name}`} @click=${() => this.setColor(id, hex)}></button>`)}
      </div>
    </div>`;
  }

  private shadeRow(id: string) {
    const selected = this.config!.shades[id] ?? '';
    const name = probeDisplayName(rawProbeName(id, this.hass!.states[id]), this.namePrefix());
    return html`<div class=color-row>
      <span class=color-name>${name}</span>
      <div class=swatches role=group aria-label=${`Couleur de ${name}`}>
        <button type=button class="swatch auto" data-selected=${selected ? 'false' : 'true'} title="Automatique" aria-label=${`Couleur automatique pour ${name}`} @click=${() => this.setShadeColor(id, '')}>Auto</button>
        ${SHADE_PALETTE.map(hex => html`<button type=button class=swatch style=${`--swatch:${hex}`} data-selected=${selected === hex ? 'true' : 'false'} title=${hex} aria-label=${`Couleur ${hex} pour ${name}`} @click=${() => this.setShadeColor(id, hex)}></button>`)}
      </div>
    </div>`;
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const labels: Record<string, string> = {
      title: 'Titre',
      entity_prefix: 'Préfixe firmware',
      name_prefix: 'Texte à retirer devant les noms (vide = automatique)',
      hours_to_show: 'Période affichée (heures)',
      chart_type: 'Type de graphique',
      show_stats: 'Afficher le bandeau Min · Moy · Max',
      entities: 'Entités affichées',
      shade_entities: 'Plages d’équipement (pdN) à ombrer quand allumé'
    };
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'name_prefix', selector: { text: {} } },
      { name: 'hours_to_show', selector: { number: { min: 1, max: 168, step: 1, mode: 'box', unit_of_measurement: 'h' } } },
      { name: 'chart_type', selector: { select: { mode: 'dropdown', options: [{ value: 'line', label: 'Courbe' }, { value: 'bar', label: 'Barres' }] } } },
      { name: 'show_stats', selector: { boolean: {} } },
      { name: 'entities', selector: { select: { multiple: true, mode: 'list', options: this.options() } } },
      { name: 'shade_entities', selector: { select: { multiple: true, mode: 'list', options: this.shadeOptions() } } }
    ];
    const entities = this.config.entities;
    const shades = Object.keys(this.config.shades);
    const data = { ...this.config, shade_entities: shades };
    return html`<p>La couleur n’est portée que par le graphique. Choisir une pastille par entité ; « Auto » répartit une palette. Les « plages pdN » ombrent le graphique pendant les périodes où l’équipement est allumé.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${data} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>${entities.length ? html`<div class=colors><h4>Couleurs des entités</h4>${entities.map(id => this.colorRow(id))}</div>` : nothing}${shades.length ? html`<div class=colors><h4>Plages (pdN) — ombrées quand allumé</h4>${shades.map(id => this.shadeRow(id))}</div>` : nothing}`;
  }

  static styles = css`
    :host{display:block}
    p{color:var(--secondary-text-color);line-height:1.5}
    p[role=alert]{color:var(--error-color)}
    .colors{margin-top:16px}
    .colors h4{margin:0 0 10px;font-size:calc(.9rem * var(--fio-font-scale, 1.32))}
    .color-row{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
    .color-name{font-size:calc(.8rem * var(--fio-font-scale, 1.32));font-weight:600}
    .swatches{display:flex;flex-wrap:wrap;gap:6px}
    .swatch{width:26px;height:26px;padding:0;border-radius:50%;border:1px solid var(--divider-color);background:var(--swatch);cursor:pointer}
    .swatch.auto{width:auto;padding:0 10px;border-radius:999px;background:var(--secondary-background-color);font:inherit;font-size:calc(.72rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .swatch[data-selected=true]{outline:2px solid var(--primary-color);outline-offset:2px}
  `;
}

if (!customElements.get('flowio-graph-card')) customElements.define('flowio-graph-card', FlowioGraphCard);
if (!customElements.get('flowio-graph-card-editor')) customElements.define('flowio-graph-card-editor', FlowioGraphCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-graph-card')) {
  registry.customCards.push({ type: 'flowio-graph-card', name: 'Flow.io Graphique', description: 'Un graphique ApexCharts, courbe ou barres, entités et couleurs au choix.', preview: true });
}
