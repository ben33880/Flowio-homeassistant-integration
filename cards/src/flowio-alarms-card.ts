import { LitElement, html, css, nothing } from 'lit';
import { alarmEntries, alarmSummary, normalizeAlarmsConfig, type AlarmsConfig } from './alarms-model';
import { commonEntityPrefix, displayName } from './names';
import type { Hass } from './model';

class FlowioAlarmsCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  declare hass?: Hass;
  private config?: AlarmsConfig;

  static getConfigElement() { return document.createElement('flowio-alarms-card-editor'); }
  static getStubConfig(): AlarmsConfig { return normalizeAlarmsConfig({}); }
  setConfig(input: unknown) { this.config = normalizeAlarmsConfig(input); }
  getCardSize() { return 2; }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const summary = alarmSummary(hass, config.entity_prefix);
    const entries = alarmEntries(hass, config.entity_prefix);
    const prefix = config.name_prefix || commonEntityPrefix(entries.map(entry => entry.entityId), hass.states);
    const active = entries.filter(entry => entry.active);
    const icon = summary.tone === 'alert' ? 'mdi:alert-circle' : summary.tone === 'ok' ? 'mdi:check-circle' : 'mdi:help-circle';
    const count = summary.total > 0 ? `${summary.total} alarme${summary.total > 1 ? 's' : ''} surveillée${summary.total > 1 ? 's' : ''}` : 'Alarmes non détectées';
    return html`<ha-card><div class=body>
      <h3 class=title>${config.title}</h3>
      <div class=summary data-tone=${summary.tone}>
        <span class=summary-icon><ha-icon .icon=${icon} aria-hidden=true></ha-icon></span>
        <div class=summary-copy><strong>${count}</strong><span>${summary.label}</span></div>
      </div>
      ${active.length ? html`<ul class=list>${active.map(entry => html`<li><button type=button @click=${() => this.more(entry.entityId)}><ha-icon icon=mdi:alert-outline aria-hidden=true></ha-icon>${displayName(entry.title, prefix)}</button></li>`)}</ul>` : nothing}
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit)}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .title{margin:0 0 12px;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .summary{display:flex;align-items:center;gap:14px;padding:12px 14px;border:1px solid var(--divider-color);border-radius:14px;background:var(--secondary-background-color)}
    .summary[data-tone=ok]{border-color:color-mix(in srgb,var(--success-color,#2e7d32) 35%,var(--divider-color));background:color-mix(in srgb,var(--success-color,#2e7d32) 8%,var(--secondary-background-color))}
    .summary[data-tone=alert]{border-color:color-mix(in srgb,var(--error-color) 40%,var(--divider-color));background:color-mix(in srgb,var(--error-color) 8%,var(--secondary-background-color))}
    .summary-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 42px;width:42px;height:42px;border-radius:50%;color:#fff;background:var(--secondary-text-color)}
    .summary-icon ha-icon{--mdc-icon-size:24px}
    .summary[data-tone=ok] .summary-icon{background:var(--success-color,#2e7d32)}
    .summary[data-tone=alert] .summary-icon{background:var(--error-color)}
    .summary-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
    .summary-copy strong{font-size:calc(.98rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.3}
    .summary-copy span{font-size:calc(.82rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .summary[data-tone=ok] .summary-copy span{color:var(--success-color,#2e7d32);font-weight:600}
    .summary[data-tone=alert] .summary-copy span{color:var(--error-color);font-weight:600}
    .list{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
    .list button{display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:8px 10px;border:1px solid var(--divider-color);border-radius:11px;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;overflow-wrap:anywhere}
    .list ha-icon{--mdc-icon-size:18px;color:var(--error-color);flex-shrink:0}
  `;
}

class FlowioAlarmsCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: AlarmsConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeAlarmsConfig(input); this.error = ''; }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    try {
      this.config = normalizeAlarmsConfig(event.detail.value);
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
      { name: 'name_prefix', selector: { text: {} } }
    ];
    const labels: Record<string, string> = { title: 'Titre', entity_prefix: 'Préfixe firmware', name_prefix: 'Texte à retirer devant les noms (vide = automatique)' };
    return html`<p>Les alarmes sont détectées depuis les entités <code>binary_sensor.&lt;préfixe&gt;_alm_*_active</code> publiées par Flow.io.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>`;
  }

  static styles = css`:host{display:block}p{color:var(--secondary-text-color);line-height:1.5}p[role=alert]{color:var(--error-color)}code{font-size:calc(.85em * var(--fio-font-scale, 1.32))}`;
}

if (!customElements.get('flowio-alarms-card')) customElements.define('flowio-alarms-card', FlowioAlarmsCard);
if (!customElements.get('flowio-alarms-card-editor')) customElements.define('flowio-alarms-card-editor', FlowioAlarmsCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-alarms-card')) {
  registry.customCards.push({ type: 'flowio-alarms-card', name: 'Flow.io Alarmes', description: 'Synthèse des alarmes surveillées.', preview: true });
}
