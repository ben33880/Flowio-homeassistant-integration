import { css, html, nothing } from 'lit';
import { FlowioPoolCard, FlowioPoolCardEditor } from './flowio-pool-card';
import { baseStyles } from './card-styles';
import { treatmentFromFirmware, visibleModes } from './modes-model';
import { TIMING_ITEMS } from './timing-model';
import {
  CALCULATED_VALUES,
  DEVICE_METRICS,
  type CalculatedValue,
  type DeviceMetric,
  type Operation
} from './firmware-model';
import {
  available,
  configuredOperations,
  editablePoolConfig,
  entityStatus,
  expectedBindings,
  firmwareOperation,
  inlineOperations,
  type Hass,
  type PoolConfig,
  type Role
} from './model';

const CARD_TYPE = 'custom:flowio-pool-dashboard-card';

class FlowioPoolDashboardCard extends FlowioPoolCard {
  static getConfigElement() {
    const editor = document.createElement('flowio-pool-card-editor') as FlowioPoolCardEditor;
    editor.cardType = CARD_TYPE;
    return editor;
  }

  static getStubConfig(): Record<string, unknown> {
    return { ...super.getStubConfig(), type: CARD_TYPE };
  }

  setConfig(input: unknown) {
    super.setConfig(input);
    if (this.config) this.config.type = CARD_TYPE;
  }

  protected renderCard(c: PoolConfig, h: Hass, prefix: string, filtrationSlot: number) {
    const installation = this.installation.value;
    if (!installation) return nothing;
    const deviceSlot = c.device_slot ?? filtrationSlot;
    const display = c.display;
    const treatment = treatmentFromFirmware(h, prefix);
    const modes = visibleModes(display.modes, display.equipment, treatment);
    const effectiveOperations = configuredOperations(c, treatment);
    const inline = inlineOperations(c, treatment);
    const timingOperations = display.operations.filter(operation =>
      operation !== 'reset_disinfection' || treatment !== undefined && treatment !== 'disabled');
    const bindings = expectedBindings(c, h, prefix, deviceSlot)
      .filter(binding => !binding.id.endsWith('wifi_rssi') || available(h.states[binding.id]));
    const missing = bindings.filter(binding => !h.states[binding.id]).length;
    const pumpTimes = [...new Set([
      ...display.timing,
      ...display.operations.flatMap(operation =>
        operation === 'reset_filtration' ? ['filtration_runtime'] :
        operation === 'reset_ph' ? ['ph_runtime'] :
        operation === 'reset_disinfection' ? ['disinfection_runtime'] : []),
      ...(display.operations.includes('timed_override') ? ['filtration_schedule'] : [])
    ])] as typeof TIMING_ITEMS[number][];
    const tanks: Role[] = [];
    if (display.tanks.some(role => role === 'ph_tank' || role === 'ph_tank_percent')) tanks.push('ph_tank_percent');
    if (display.tanks.some(role => role === 'disinfection_tank' || role === 'disinfection_tank_percent')) tanks.push('disinfection_tank_percent');
    const quality = display.measurements.filter(role => role === 'ph' || role === 'orp');
    const measures = display.measurements.filter(role => !['ph', 'orp'].includes(role));
    const valuesTelemetry = display.values_telemetry &&
      (display.calculated_values.length > 0 || display.device_metrics.length > 0);
    const hasDashboard = quality.length || measures.length || display.injections.length ||
      display.equipment.length || modes.length || tanks.length || pumpTimes.length || valuesTelemetry;

    return html`
      <header class="dashboard-hero">
        <flowio-header-status
          .hass=${h}
          .prefix=${prefix}
          .deviceSlot=${String(deviceSlot)}
          .heading=${c.title}
          .information=${display.information}>
        </flowio-header-status>
      </header>
      ${this.error ? html`<p class="warning dashboard-error" role="alert">${this.error}</p>` : nothing}
      ${hasDashboard ? html`
        <main class="dashboard-shell">
          <div class="dashboard-columns">
            ${quality.length || measures.length || display.injections.length ? html`
              <section class="dashboard-panel quality-panel">
                ${this.heading('mdi:water-check-outline', 'Qualité de l’eau')}
                ${quality.length ? this.qualityMeasurements(quality, prefix) : nothing}
                ${measures.length ? html`<div class="secondary-measures">${this.measuresGroup(measures, prefix)}</div>` : nothing}
              </section>
            ` : nothing}
            ${display.equipment.length ? html`
              <section class="dashboard-panel equipment-panel">
                ${this.heading('mdi:tune-variant', 'Équipements')}
                <div class="dashboard-equipment">${display.equipment.map(role => this.control(role, prefix))}</div>
              </section>
            ` : nothing}
            ${tanks.length ? html`
              <section class="dashboard-panel treatment-panel">
                ${this.heading('mdi:beaker-outline', 'Traitement')}
                <div class="dashboard-tanks" data-group="tanks">
                  ${tanks.map(role => this.tankMeasure(role, prefix))}
                </div>
              </section>
            ` : nothing}
          </div>
          ${modes.length ? html`
            <section class="modes-strip">
              <flowio-modes .hass=${h} .prefix=${prefix} .items=${modes} .first=${true} .compact=${true}></flowio-modes>
            </section>
          ` : nothing}
          ${effectiveOperations.length ? html`
            <flowio-firmware-panel
              .hass=${h}
              .prefix=${prefix}
              .deviceSlot=${String(deviceSlot)}
              .operations=${effectiveOperations}
              .inlineOperations=${inline}>
            </flowio-firmware-panel>
          ` : nothing}
          ${pumpTimes.length ? html`
            <section class="timing-panel" data-group="overview">
              <flowio-timing
                .hass=${h}
                .items=${pumpTimes}
                .prefix=${prefix}
                .slots=${{
                  filtration: installation.filtration_slot,
                  ph: installation.ph_slot,
                  disinfection: installation.disinfection_slot
                }}
                .operations=${timingOperations}
                .showOverride=${display.operations.includes('timed_override')}
                .operationTargets=${{
                  reset_disinfection: treatment && treatment !== 'disabled'
                    ? firmwareOperation(c, 'reset_disinfection', treatment)
                    : undefined
                }}
                @flowio-operation=${(event: Event) => this.runScheduledOperation(event)}
                @flowio-open-override=${() => this.openTimedOverride()}>
              </flowio-timing>
            </section>
          ` : nothing}
          ${valuesTelemetry ? html`
            <flowio-firmware-panel
              class="values-telemetry-panel"
              .hass=${h}
              .prefix=${prefix}
              .calculatedValues=${display.calculated_values as CalculatedValue[]}
              .deviceMetrics=${display.device_metrics as DeviceMetric[]}
              .deviceSlot=${String(deviceSlot)}>
            </flowio-firmware-panel>
          ` : nothing}
        </main>
      ` : nothing}
      ${display.information.includes('diagnostics') && missing ? html`
        <details class="dashboard-diagnostics">
          <summary>Configuration · ${missing} entité(s) absente(s)</summary>
          ${bindings.map(binding => html`
            <div class="diagnostic">
              <span>${binding.label} · ${entityStatus(h.states[binding.id])} · ${h.states[binding.id]?.state ?? '—'}</span>
              <code>${binding.id}</code>
            </div>
          `)}
        </details>
      ` : nothing}
    `;
  }

  static styles = [
    baseStyles,
    css`
      :host{display:block;container-type:inline-size;--dashboard-gap:18px}
      .dashboard-hero{padding:0 0 10px}
      flowio-header-status{display:block;width:100%}
      .dashboard-shell{display:grid;gap:var(--dashboard-gap);padding-top:2px}
      .dashboard-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--dashboard-gap);align-items:stretch}
      .dashboard-panel,.modes-strip,.timing-panel{box-sizing:border-box;min-width:0;border:1px solid color-mix(in srgb,var(--divider-color) 82%,var(--primary-color));border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 4%,var(--card-background-color)),var(--card-background-color));box-shadow:0 3px 16px color-mix(in srgb,var(--primary-text-color) 7%,transparent)}
      .dashboard-panel{padding:16px;overflow:hidden}
      .dashboard-panel>.section-heading{margin:0 0 14px}
      .section-heading{display:flex;align-items:center;margin:0 0 14px}
      .section-heading h3{display:flex;align-items:center;gap:8px;margin:0;font-size:calc(1rem * var(--fio-font-scale,1.32));font-weight:650}
      .section-heading h3 ha-icon{color:var(--primary-color)}
      button{font:inherit;color:inherit}
      .metric-foot{display:none!important}
      .quality-panel{display:grid;align-content:start;gap:12px}
      .quality-panel .quality-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;gap:12px;align-items:start}
      .quality-panel .quality-stack{display:flex;flex-direction:column;min-width:0;gap:8px}
      .quality-panel .quality-stack .measure{box-sizing:border-box;width:100%;max-width:none;min-height:250px;padding:12px;border:0;border-radius:14px;background:color-mix(in srgb,var(--fio-accent) 4%,var(--card-background-color));box-shadow:none}
      .quality-panel .quality-stack .measure::before{display:none}
      .quality-panel .quality-stack .metric-head{justify-content:center}
      .quality-panel .quality-stack .measure{display:flex;flex-direction:column;align-items:stretch}
      .quality-panel .quality-stack flowio-gauge{width:100%;max-width:210px;margin:auto}
      .quality-panel .secondary-measures{border-top:1px solid var(--divider-color);padding-top:12px}
      .quality-panel .measures-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .quality-panel .measures-primary,.quality-panel .measures-temps{display:flex;flex-direction:column;gap:8px}
      .quality-panel .measures-primary>.section-heading,.quality-panel .measures-temps>.section-heading{margin:0}
      .quality-panel .measures-primary,.quality-panel .measures-temps{min-width:0}
      .quality-panel .section-heading h3{font-size:calc(.78rem * var(--fio-font-scale,1.32))}
      .quality-panel .measurement-group{box-sizing:border-box;width:100%;padding:0;border:0;background:transparent;box-shadow:none}
      .quality-panel .measures-temps-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .quality-panel .measures-temps .measure{box-sizing:border-box;width:100%;min-width:0;min-height:72px;padding:8px;border:1px solid var(--divider-color);border-radius:12px;background:var(--card-background-color)}
      .quality-panel .injection-block{display:grid;gap:3px}
      .quality-panel .injection-heading{margin:0;text-align:center;color:var(--secondary-text-color);font-size:.68rem}
      .quality-panel .injection-stat{box-sizing:border-box;width:100%;min-height:0;padding:2px 0 6px;border:0;border-bottom:1px solid var(--divider-color);background:transparent;text-align:center;align-items:center}
      .equipment-panel{display:flex;flex-direction:column}
      .dashboard-equipment{display:grid;gap:0}
      .dashboard-equipment .control{box-sizing:border-box;display:flex;align-items:center;width:100%;max-width:none;min-height:56px;border:0;border-bottom:1px solid var(--divider-color);border-radius:0;background:transparent;padding:7px 2px;gap:10px}
      .dashboard-equipment .control:last-child{border-bottom:0}
      .dashboard-equipment .control:hover{background:color-mix(in srgb,var(--primary-color) 5%,transparent)}
      .dashboard-equipment .details{flex:1;display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:0;text-align:left;min-height:44px}
      .dashboard-equipment .control-copy{display:grid;gap:2px}
      .dashboard-equipment .control-state{display:flex;align-items:center;color:var(--secondary-text-color);font-size:.72rem}
      .dashboard-equipment .icon-plate{width:22px;height:22px;background:transparent}
      .dashboard-equipment .control-label{font-size:.85rem;font-weight:500}
      .dashboard-equipment .state-dot{display:none}
      .dashboard-tanks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
      .dashboard-tanks .tank-action-tile{width:100%}
      .dashboard-tanks .measure{box-sizing:border-box;width:100%;max-width:none;min-height:260px;padding:12px;border:1px solid color-mix(in srgb,var(--success-color,#4caf50) 22%,var(--divider-color));border-radius:15px;background:transparent;box-shadow:none}
      .dashboard-tanks .measure::before,.dashboard-tanks .metric-foot{display:none}
      .dashboard-tanks .metric-head{justify-content:center}
      .dashboard-tanks .tank-action-footer{display:flex;align-items:center;justify-content:center;gap:4px}
      .dashboard-tanks .tank-action-footer{position:static;margin-top:4px;min-height:44px}
      .dashboard-tanks .tank-volume{text-align:center}
      .modes-strip{padding:10px 14px}
      .modes-strip flowio-modes{display:block}
      .timing-panel{padding:12px 16px 16px}
      .values-telemetry-panel{border-radius:18px}
      .dashboard-error{margin:0 0 12px}
      .dashboard-diagnostics{margin-top:12px}
      @container(max-width:1100px){
        .dashboard-columns{grid-template-columns:repeat(2,minmax(0,1fr))}
        .treatment-panel{grid-column:1/-1}
        .dashboard-tanks{max-width:620px;margin:auto}
      }
      @container(max-width:700px){
        .dashboard-columns{grid-template-columns:minmax(0,1fr)}
        .treatment-panel{grid-column:auto}
        .quality-panel .measures-grid{grid-template-columns:1fr}
        .quality-panel .quality-stack .measure{min-height:230px}
        .dashboard-panel,.modes-strip,.timing-panel{border-radius:14px}
        .dashboard-tanks{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      }
      @container(max-width:430px){
        .dashboard-columns{gap:12px}
        .dashboard-panel{padding:12px 10px}
        .quality-panel .quality-grid{gap:8px}
        .quality-panel .quality-stack .measure{min-height:220px}
        .dashboard-tanks{grid-template-columns:minmax(0,1fr)}
      }
    `
  ];
}

if (!customElements.get('flowio-pool-dashboard-card')) {
  customElements.define('flowio-pool-dashboard-card', FlowioPoolDashboardCard);
}

const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-pool-dashboard-card')) {
  registry.customCards.push({
    type: 'flowio-pool-dashboard-card',
    name: 'Flow.io Piscine · Tableau de bord',
    description: 'Vue moderne en trois colonnes avec les mêmes fonctionnalités que la carte Piscine.',
    preview: true
  });
}
