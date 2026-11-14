import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import ApexCharts from 'apexcharts';
import type { HistoryPoint } from './history-data';

export interface GraphSeries {
  name: string;
  color: string;
  points: HistoryPoint[];
}

class FlowioGraphChart extends LitElement {
  static properties = { series: { attribute: false }, ranges: { attribute: false }, chartType: { type: String }, label: { type: String }, unit: { type: String }, start: { type: Number }, end: { type: Number }, error: { state: true } };
  series: GraphSeries[] = [];
  ranges: { from: number; to: number; color: string }[] = [];
  chartType = 'line';
  label = '';
  unit = '';
  start = 0;
  end = 0;
  private error = '';
  private chart?: ApexCharts;
  private resize?: ResizeObserver;
  private theme?: MutationObserver;
  private media?: MediaQueryList;
  private frame = 0;
  private generation = 0;
  private busy = false;
  private dirty = false;
  private view?: [number, number];
  private bounds = '';
  private request = () => { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => { void this.draw(); }); };

  connectedCallback() {
    super.connectedCallback();
    ++this.generation;
    this.media = matchMedia('(prefers-reduced-motion: reduce)');
    this.media.addEventListener('change', this.request);
    this.theme = new MutationObserver(this.request);
    this.theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    void this.updateComplete.then(() => {
      if (!this.isConnected) return;
      this.resize = new ResizeObserver(this.request);
      this.resize.observe(this);
      this.request();
    });
  }

  disconnectedCallback() {
    ++this.generation;
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.theme?.disconnect();
    this.media?.removeEventListener('change', this.request);
    this.chart?.destroy();
    this.chart = undefined;
    this.view = undefined;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('series') || changed.has('ranges') || changed.has('chartType') || changed.has('label') || changed.has('unit') || changed.has('start') || changed.has('end')) this.request();
  }

  private async draw() {
    const el = this.renderRoot.querySelector<HTMLElement>('.plot');
    if (!el || !this.isConnected || el.clientWidth === 0 || this.end <= this.start) return;
    if (this.busy) { this.dirty = true; return; }
    this.busy = true;
    const token = this.generation, key = `${this.start}:${this.end}`;
    if (key !== this.bounds) { this.bounds = key; this.view = undefined; }
    const style = getComputedStyle(this);
    const text = style.getPropertyValue('--secondary-text-color').trim() || '#64748b';
    const line = style.getPropertyValue('--divider-color').trim() || '#dbe3eb';
    const dark = style.colorScheme === 'dark';
    const bar = this.chartType === 'bar';
    const options: ApexCharts.ApexOptions = {
      chart: {
        type: bar ? 'bar' : 'area',
        height: 245,
        parentHeightOffset: 0,
        fontFamily: 'inherit',
        foreColor: text,
        background: 'transparent',
        animations: { enabled: !this.media?.matches, speed: 180, dynamicAnimation: { enabled: false } },
        toolbar: { show: false },
        zoom: { enabled: true, type: 'x', allowMouseWheelZoom: false },
        redrawOnParentResize: true,
        redrawOnWindowResize: true,
        events: { zoomed: (_chart: unknown, range?: { xaxis?: { min: number; max: number } }) => { if (range?.xaxis) this.view = [range.xaxis.min, range.xaxis.max]; } }
      },
      series: this.series.map(item => ({ name: item.name, data: item.points.map(([x, y]) => ({ x, y })) })),
      colors: this.series.map(item => item.color),
      stroke: bar ? { width: 0 } : { curve: 'smooth', width: 2.4, lineCap: 'round' },
      fill: bar ? { type: 'solid', opacity: 0.85 } : { type: 'gradient', gradient: { shadeIntensity: 0, inverseColors: false, opacityFrom: 0.25, opacityTo: 0, stops: [0, 100] } },
      plotOptions: bar ? { bar: { columnWidth: '68%', borderRadius: 4, borderRadiusApplication: 'end' } } : {},
      dataLabels: { enabled: false },
      markers: { size: this.series.some(item => item.points.length === 1) ? 3 : 0, showNullDataPoints: false, hover: { size: 4 } },
      legend: { show: this.series.length > 1, position: 'top', horizontalAlign: 'right', labels: { colors: text }, fontSize: '12px', markers: { size: 7 } },
      grid: { borderColor: line, strokeDashArray: 4, padding: { left: 6, right: 14, top: 6, bottom: 0 } },
      xaxis: {
        type: 'datetime',
        min: this.view?.[0] ?? this.start,
        max: this.view?.[1] ?? this.end,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { datetimeUTC: false, hideOverlappingLabels: true, style: { colors: text, fontSize: '10px' } },
        tooltip: { enabled: false }
      },
      yaxis: {
        forceNiceScale: true,
        labels: { style: { colors: text, fontSize: '10px' }, formatter: (value: number) => Number.isFinite(value) ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value) : '' }
      },
      tooltip: { theme: dark ? 'dark' : 'light', x: { format: 'dd MMM HH:mm' } },
      annotations: { xaxis: this.ranges.map(range => ({ x: range.from, x2: range.to, fillColor: range.color, opacity: 0.6, borderColor: 'transparent' })) },
      noData: { text: 'Aucune donnée conservée' }
    };
    try {
      if (!this.chart) {
        this.chart = new ApexCharts(el, options);
        await this.chart.render();
      } else {
        await this.chart.updateOptions(options, false, false, false);
      }
      this.error = '';
    } catch (error) {
      console.error('[flowio] Graphique ApexCharts indisponible', error);
      if (token === this.generation) this.error = 'Graphique indisponible. Recharger le tableau de bord.';
    } finally {
      this.busy = false;
      if (this.dirty) { this.dirty = false; this.request(); }
    }
  }

  render() {
    return html`${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<div class=plot data-chart=apexcharts role=img aria-label=${`${this.label}, graphique en ${this.unit || 'valeur sans unité'}.`}></div>`;
  }

  static styles = css`
    :host{display:block;min-width:0}
    .plot{width:100%;min-height:245px;min-width:0}
    [role=alert]{font-size:calc(.75rem * var(--fio-font-scale, 1.32));color:var(--error-color);padding:0 12px}
    .apexcharts-canvas{position:relative;user-select:none}
    .apexcharts-tooltip{position:absolute;display:flex;flex-direction:column;z-index:12;opacity:0;pointer-events:none;border:1px solid var(--divider-color);border-radius:10px;background:var(--ha-card-background,var(--card-background-color))!important;color:var(--primary-text-color)!important;box-shadow:0 4px 18px color-mix(in srgb,var(--primary-text-color) 12%,transparent);font:12px inherit}
    .apexcharts-tooltip.apexcharts-active{opacity:1}
    .apexcharts-tooltip-title{padding:8px 10px;border-bottom:1px solid var(--divider-color);background:var(--ha-card-background,var(--card-background-color))!important;color:var(--primary-text-color)!important}
    .apexcharts-tooltip-text,.apexcharts-tooltip-text-y-label,.apexcharts-tooltip-text-y-value{color:var(--primary-text-color)!important}
    .apexcharts-tooltip-series-group{display:flex;align-items:center;padding:8px 10px;gap:6px}
    .apexcharts-tooltip-marker{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
    .apexcharts-xaxistooltip,.apexcharts-yaxistooltip{display:none}
    @media(prefers-reduced-motion:reduce){*{transition:none!important}}
  `;
}

if (!customElements.get('flowio-graph-chart')) customElements.define('flowio-graph-chart', FlowioGraphChart);
