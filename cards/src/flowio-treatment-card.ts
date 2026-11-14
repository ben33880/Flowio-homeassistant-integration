import { LitElement, html, css, nothing } from 'lit';
import { treatmentFromFirmware } from './modes-model';
import type { Hass } from './model';
import { InstallationController, type InstallationHass } from './installation-controller';
import { normalizeTreatmentConfig, treatmentPresentation, treatmentTileValue, treatmentTiles, type TreatmentConfig, type TreatmentTile } from './treatment-model';

class FlowioTreatmentCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  declare hass?: Hass & InstallationHass;
  private config?: TreatmentConfig;
  private installation = new InstallationController(this, () => this.hass);
  static getConfigElement() { return document.createElement('flowio-treatment-card-editor'); }
  static getStubConfig(): TreatmentConfig { return normalizeTreatmentConfig({}); }
  setConfig(input: unknown) { this.config = normalizeTreatmentConfig(input); }
  getCardSize() { return 3; }
  private more(entityId: string) {
    if (this.hass?.states[entityId]) this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }
  private tile(tile: TreatmentTile) {
    const state = this.hass!.states[tile.entityId];
    return html`<button type=button class=tile data-tile=${tile.entityId} ?disabled=${!state} @click=${() => this.more(tile.entityId)}><span class=tile-label>${tile.label}</span><strong class=tile-value>${treatmentTileValue(state, tile)}</strong></button>`;
  }
  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    if (this.installation.error) return html`<ha-card><div class=body><p role=alert>${this.installation.error}</p></div></ha-card>`;
    const installation = this.installation.value;
    if (!installation) return html`<ha-card><div class=body>Chargement des réglages de l’intégration Flow.io…</div></ha-card>`;
    const treatment = treatmentFromFirmware(hass, installation.prefix);
    const presentation = treatmentPresentation(treatment);
    const tiles = treatmentTiles(installation.prefix, treatment);
    return html`<ha-card><div class=body><div class=heading><span class=icon-plate><ha-icon .icon=${presentation.icon} aria-hidden=true></ha-icon></span><div class=heading-copy><h3>${presentation.title}</h3><p>${presentation.description}</p></div></div>${tiles.length ? html`<div class=tiles>${tiles.map(tile => this.tile(tile))}</div>` : nothing}</div></ha-card>`;
  }
  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit);--fio-water:var(--flowio-water-color,var(--blue-color,var(--primary-color)))}
    ha-card{overflow:hidden}
    .body{display:flex;flex-direction:column;gap:16px;padding:16px}
    .heading{display:flex;align-items:flex-start;gap:12px;min-width:0}
    .icon-plate{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;border-radius:50%;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 12%,var(--ha-card-background,var(--card-background-color)))}
    .icon-plate ha-icon{--mdc-icon-size:24px}
    .heading-copy{min-width:0}
    .heading-copy h3{margin:0;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25;overflow-wrap:anywhere}
    .heading-copy p{margin:4px 0 0;font-size:calc(.8rem * var(--fio-font-scale, 1.32));line-height:1.45;color:var(--secondary-text-color)}
    .tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .tile{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0;padding:12px;border:1px solid var(--divider-color);border-radius:12px;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;overflow-wrap:anywhere}
    .tile:disabled{cursor:default;opacity:.7}
    .tile:not(:disabled):hover{border-color:var(--primary-color)}
    .tile-label{font-size:calc(.72rem * var(--fio-font-scale, 1.32));line-height:1.3;color:var(--secondary-text-color)}
    .tile-value{font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25;font-variant-numeric:tabular-nums}
    @container(max-width:360px){.tiles{grid-template-columns:minmax(0,1fr)}}
    @media (prefers-reduced-motion: reduce){.tile{transition:none}}
  `;
}
class FlowioTreatmentCardEditor extends LitElement {
  setConfig(input: unknown) { normalizeTreatmentConfig(input); }
  render() {
    return html`<p>Le préfixe est fourni par l’intégration Flow.io. Le type de traitement et ses paramètres sont lus dans les entités MQTT du firmware. Cette carte ne possède aucun réglage métier local.</p>`;
  }
  static styles = css`:host{display:block}p{color:var(--secondary-text-color);line-height:1.5}`;
}
if (!customElements.get('flowio-treatment-card')) customElements.define('flowio-treatment-card', FlowioTreatmentCard);
if (!customElements.get('flowio-treatment-card-editor')) customElements.define('flowio-treatment-card-editor', FlowioTreatmentCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-treatment-card')) {
  registry.customCards.push({ type: 'flowio-treatment-card', name: 'Flow.io Traitement', description: 'Informations du traitement actif selon le type configuré.', preview: true });
}
