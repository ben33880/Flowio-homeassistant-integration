import { LitElement, html, css, nothing } from 'lit';
import { ensureHaElements } from './ha-controls';
import { overrideEntityIds } from './firmware-model';
import { available, type Hass } from './model';
import {
  normalizeOverrideConfig,
  overrideAvailable,
  overrideDevices,
  overrideForced,
  overrideRemainingMinutes,
  type OverrideConfig
} from './override-model';

class FlowioOverrideCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, duration: { state: true }, busy: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: OverrideConfig;
  private duration?: number;
  private busy = false;
  private error = '';

  static getConfigElement() { return document.createElement('flowio-override-card-editor'); }
  static getStubConfig(): OverrideConfig { return normalizeOverrideConfig({}); }
  setConfig(input: unknown) { this.config = normalizeOverrideConfig(input); this.duration = undefined; this.error = ''; }
  getCardSize() { return 3; }

  connectedCallback() {
    super.connectedCallback();
    void ensureHaElements(['ha-button']).catch(error => {
      console.error('[flowio] Boutons Home Assistant indisponibles', error);
      this.error = 'Boutons natifs Home Assistant indisponibles. Recharger le tableau de bord.';
    });
  }

  private async force(action: 'on' | 'off' | 'release') {
    const config = this.config, hass = this.hass;
    if (!config || !hass || this.busy) return;
    const ids = overrideEntityIds(config.entity_prefix);
    const device = config.device;
    const minutes = this.duration ?? Number(hass.states[ids.duration]?.state);
    if (action === 'release') {
      if (!window.confirm('Terminer le forçage temporaire ? Flow.io reprend son pilotage guidé.')) return;
    } else {
      if (!device || !overrideDevices(hass, config.entity_prefix).includes(device)) {
        this.error = 'Équipement non disponible dans Flow.io.';
        return;
      }
      if (!Number.isInteger(minutes) || minutes < 1) {
        this.error = 'Choisir une durée de forçage.';
        return;
      }
      if (!window.confirm(`Forcer ${device} en ${action === 'on' ? 'marche' : 'arrêt'} pendant ${minutes} min ? Flow.io conserve la responsabilité des sécurités.`)) return;
    }
    this.busy = true;
    this.error = '';
    try {
      if (action === 'release') {
        await hass.callService('button', 'press', { entity_id: ids.release });
      } else {
        if (hass.states[ids.target]?.state !== device) {
          await hass.callService('select', 'select_option', { entity_id: ids.target, option: device });
        }
        if (Number(hass.states[ids.duration]?.state) !== minutes) {
          await hass.callService('number', 'set_value', { entity_id: ids.duration, value: minutes });
        }
        await hass.callService('button', 'press', { entity_id: ids[action] });
      }
    } catch {
      this.error = 'Commande refusée ou échouée. Vérifier les droits et la disponibilité.';
    } finally {
      this.busy = false;
    }
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const ids = overrideEntityIds(config.entity_prefix);
    const devices = overrideDevices(hass, config.entity_prefix);
    const device = config.device;
    const known = !!device && devices.includes(device);
    const forced = overrideForced(hass, config.entity_prefix);
    const remaining = overrideRemainingMinutes(hass, config.entity_prefix);
    const canForce = overrideAvailable(hass, config.entity_prefix);
    const entityDuration = Number(hass.states[ids.duration]?.state);
    const selected = this.duration ?? (Number.isInteger(entityDuration) ? entityDuration : undefined);
    const stateText = !hass.states[ids.state] ? 'État du forçage absent' : !available(hass.states[ids.state]) ? 'État du forçage indisponible' : forced && remaining ? `${remaining} min restantes` : '';
    return html`<ha-card><div class=body>
      <div class=head>
        <h3 class=title>${config.title}</h3>
        <span class=badge data-forced=${forced ? 'true' : 'false'}>${forced ? 'Forcé' : 'Guidé'}</span>
      </div>
      <div class=durations role=group aria-label="Durée du forçage">${config.durations.map(minutes => html`<button type=button class=chip data-duration=${minutes} data-selected=${selected === minutes ? 'true' : 'false'} aria-pressed=${selected === minutes ? 'true' : 'false'} ?disabled=${!hass.states[ids.duration]} @click=${() => { this.duration = minutes; }}>${minutes} min</button>`)}</div>
      <div class=actions>
        <ha-button appearance=accent .disabled=${!known || !canForce || !selected || this.busy || !hass.states[ids.on]} .accessibleLabel=${'Forcer en marche'} @click=${() => this.force('on')}>Marche</ha-button>
        <ha-button appearance=outlined .disabled=${!known || !canForce || !selected || this.busy || !hass.states[ids.off]} .accessibleLabel=${'Forcer à l’arrêt'} @click=${() => this.force('off')}>Arrêt</ha-button>
        <ha-button appearance=plain .disabled=${!forced || this.busy || !hass.states[ids.release]} .accessibleLabel=${'Effacer le forçage'} @click=${() => this.force('release')}>Effacer</ha-button>
      </div>
      ${stateText ? html`<p class=state data-forced=${forced ? 'true' : 'false'}>${stateText}</p>` : nothing}
      ${this.error ? html`<p class=error role=alert>${this.error}</p>` : nothing}
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit)}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}
    .title{margin:0;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .badge{flex:none;padding:4px 12px;border:1px solid var(--divider-color);border-radius:999px;background:var(--secondary-background-color);color:var(--secondary-text-color);font-size:calc(.72rem * var(--fio-font-scale, 1.32));font-weight:600;line-height:1.4}
    .badge[data-forced=true]{border-color:var(--error-color);background:transparent;color:var(--error-color)}
    .durations{display:flex;flex-wrap:wrap;gap:8px}
    .chip{min-height:40px;padding:6px 14px;border:1px solid var(--divider-color);border-radius:999px;background:var(--secondary-background-color);font:inherit;font-size:calc(.82rem * var(--fio-font-scale, 1.32));font-weight:600;color:inherit;cursor:pointer}
    .chip[data-selected=true]{border-color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 14%,var(--secondary-background-color));color:var(--primary-color)}
    .chip:disabled{opacity:.55;cursor:default}
    .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .state{margin:14px 0 0;font-size:calc(.78rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .state[data-forced=true]{color:var(--primary-color);font-weight:600}
    .error{margin:10px 0 0;font-size:calc(.78rem * var(--fio-font-scale, 1.32));color:var(--error-color)}
  `;
}

class FlowioOverrideCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: OverrideConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeOverrideConfig(input); this.error = ''; }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    try {
      this.config = normalizeOverrideConfig(event.detail.value);
      this.error = '';
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this.config }, bubbles: true, composed: true }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private options(): { value: string; label: string }[] {
    if (!this.hass || !this.config) return [];
    return overrideDevices(this.hass, this.config.entity_prefix).map(device => ({ value: device, label: device }));
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'device', selector: { select: { mode: 'dropdown', options: this.options() } } }
    ];
    const labels: Record<string, string> = { title: 'Titre', entity_prefix: 'Préfixe firmware', device: 'Équipement à forcer' };
    return html`<p>L’équipement est choisi dans la liste publiée par Flow.io (<code>select.&lt;préfixe&gt;_pdm_ovr_target</code>). La carte ne permet pas de le modifier en usage courant.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>`;
  }

  static styles = css`:host{display:block}p{color:var(--secondary-text-color);line-height:1.5}p[role=alert]{color:var(--error-color)}code{font-size:calc(.85em * var(--fio-font-scale, 1.32))}`;
}

if (!customElements.get('flowio-override-card')) customElements.define('flowio-override-card', FlowioOverrideCard);
if (!customElements.get('flowio-override-card-editor')) customElements.define('flowio-override-card-editor', FlowioOverrideCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-override-card')) {
  registry.customCards.push({ type: 'flowio-override-card', name: 'Flow.io Forçage', description: 'Forcer un équipement pendant une durée choisie.', preview: true });
}
