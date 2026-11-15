import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { available, type Hass } from './model';
import { InstallationController, type InstallationHass } from './installation-controller';
import type { Installation } from './integration-config';
import {
  DEFAULT_DURATIONS, normalizeOverrideConfig, overrideAvailable, overrideDevices, overrideForced,
  overrideRemainingMinutes, overrideTargetEntity, type OverrideConfig
} from './override-model';
import { overrideEntityIds } from './firmware-model';

class FlowioOverrideCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, busy: { state: true }, error: { state: true }, confirmation: { state: true }, duration: { state: true }, target: { state: true } };
  declare hass?: Hass & InstallationHass;
  private config?: OverrideConfig;
  private installation = new InstallationController(this, () => this.hass);
  private busy = '';
  private error = '';
  private confirmation?: 'on' | 'off' | 'release';
  private duration?: number;
  private target = '';
  private lastInstallation?: Installation;
  static getConfigElement() { return document.createElement('flowio-override-card-editor'); }
  static getStubConfig(): OverrideConfig { return normalizeOverrideConfig({}); }
  setConfig(input: unknown) { this.config = normalizeOverrideConfig(input); }
  getCardSize() { return 3; }
  connectedCallback() { super.connectedCallback(); this.refresh(); }
  protected updated(changed: PropertyValues) {
    super.updated(changed);
    const installation = this.installation.value;
    if (installation && installation !== this.lastInstallation) {
      this.lastInstallation = installation;
      this.refresh();
    }
  }
  private refresh() {
    const installation = this.installation.value;
    if (!installation) return;
    const ids = overrideEntityIds(installation.prefix);
    const target = this.hass?.states[ids.target]?.state ?? '';
    const duration = Number(this.hass?.states[ids.duration]?.state);
    this.target = overrideDevices(this.hass, installation.prefix).includes(target) ? target : overrideDevices(this.hass, installation.prefix)[0] ?? '';
    this.duration = Number.isInteger(duration) && duration >= 1 && duration <= 1440 ? duration : undefined;
  }
  private async invoke(domain: string, service: string, entityId: string, data: Record<string, unknown> = {}) {
    const hass = this.hass;
    if (!hass || !this.hass?.states[entityId] || this.busy) return false;
    this.busy = entityId;
    this.error = '';
    try { await hass.callService(domain, service, { ...data, entity_id: entityId }); return true; }
    catch (error) {
      console.error('[flowio] Action de forçage impossible', error);
      this.error = `Action refusée ou échouée pour ${entityId}. Vérifier les droits et la disponibilité du contrôleur.`;
      return false;
    } finally { this.busy = ''; }
  }
  private request(action: 'on' | 'off' | 'release') {
    if (this.busy) return;
    this.error = '';
    this.confirmation = action;
  }
  private cancel() { this.confirmation = undefined; }
  private async confirm() {
    const action = this.confirmation;
    if (!action || this.busy) return;
    this.confirmation = undefined;
    await this.execute(action);
  }
  private async execute(action: 'on' | 'off' | 'release') {
    if (this.busy) return;
    const installation = this.installation.value;
    if (!installation) return;
    const ids = overrideEntityIds(installation.prefix);
    const target = this.target || this.hass?.states[ids.target]?.state;
    const status = this.hass?.states[ids.state];
    const entityId = ids[action];
    if (!target || !overrideDevices(this.hass, installation.prefix).includes(target) || !this.hass?.states[entityId]) return;
    if (action !== 'release' && status?.attributes.override_available !== true) return;
    if (action === 'release' && status?.attributes.control_mode === 'guided') return;
    const duration = this.duration ?? Number(this.hass?.states[ids.duration]?.state);
    if (action !== 'release' && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) {
      this.error = 'Définir une durée valide entre 1 et 1 440 minutes.';
      return;
    }
    this.error = '';
    if (action !== 'release' && Number(this.hass?.states[ids.duration]?.state) !== duration) {
      if (!await this.invoke('number', 'set_value', ids.duration, { value: duration })) return;
    }
    if (await this.invoke('button', 'press', entityId)) this.refresh();
  }
  private async setTarget(event: Event) {
    const installation = this.installation.value;
    if (!installation) return;
    const value = (event.target as HTMLSelectElement).value;
    const previous = this.target;
    this.target = value;
    this.confirmation = undefined;
    const changed = await this.invoke('select', 'select_option', overrideTargetEntity(this.hass, installation.prefix), { option: value });
    if (!changed) this.target = previous;
  }
  private setDuration(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isInteger(value) && value >= 1 && value <= 1440) { this.duration = value; this.error = ''; }
    else this.error = 'La durée du forçage doit être comprise entre 1 et 1 440 minutes.';
  }
  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    if (this.installation.error) return html`<ha-card><div class=body><p class=error role=alert>${this.installation.error}</p></div></ha-card>`;
    const installation = this.installation.value;
    if (!installation) return html`<ha-card><div class=body>Chargement des réglages de l’intégration Flow.io…</div></ha-card>`;
    const ids = overrideEntityIds(installation.prefix);
    const status = hass.states[ids.state];
    const devices = overrideDevices(hass, installation.prefix);
    const duration = this.duration ?? Number(hass.states[ids.duration]?.state);
    const forced = overrideForced(hass, installation.prefix);
    const remaining = overrideRemainingMinutes(hass, installation.prefix);
    return html`<ha-card><div class=body>
      ${config.title ? html`<h3 class=title>${config.title}</h3>` : nothing}
      <p class=intro>Choisir un équipement et la durée du forçage. Flow.io conserve la responsabilité des sécurités.</p>
      <label class=field><span>Équipement</span><select ?disabled=${!devices.length || !!this.busy} .value=${this.target} @change=${(event: Event) => this.setTarget(event)}>${devices.map(device => html`<option value=${device} ?selected=${device === this.target}>${device}</option>`)}</select></label>
      <label class=field><span>Durée (minutes)</span><input type=number min=1 max=1440 step=1 .value=${Number.isInteger(duration) ? String(duration) : ''} ?disabled=${!!this.busy} @change=${(event: Event) => this.setDuration(event)}></label>
      <p class=state data-state=${status?.state ?? 'missing'}>
        ${!status ? 'État du forçage absent' : !available(status) ? 'État du forçage indisponible' : forced
          ? `Forçage actif · ${String(status.attributes.control_mode ?? status.state)}`
          : 'Pilotage guidé'}
        ${remaining ? html` · ${remaining} min restantes` : nothing}
      </p>
      <div class=actions>
        ${(['on', 'off', 'release'] as const).map(action => {
          const entityId = ids[action];
          const enabled = !!this.hass?.states[entityId] && !!this.target && devices.includes(this.target) &&
            (action === 'release' ? forced : status?.attributes.override_available === true);
          const label = action === 'on' ? 'Forcer en marche' : action === 'off' ? 'Forcer à l’arrêt' : 'Terminer le forçage';
          return html`<ha-button class=action data-override=${action} appearance=${action === 'on' ? 'accent' : action === 'off' ? 'outlined' : 'plain'}
            .disabled=${!enabled || !!this.busy} .accessibleLabel=${label} @click=${() => this.request(action)}>${label}</ha-button>`;
        })}
      </div>
      ${this.confirmation ? html`
        <ha-alert class=confirm-prompt alert-type=warning>
          Confirmer « ${this.confirmation === 'on' ? 'Forcer en marche' : this.confirmation === 'off' ? 'Forcer à l’arrêt' : 'Terminer le forçage'} »
          pour ${this.target}${this.confirmation === 'release' ? '' : ` pendant ${duration} min`} ?
          Flow.io conserve la responsabilité des sécurités.
        </ha-alert>
        <div class=confirmation>
          <ha-button class=action data-cancel-override appearance=plain .accessibleLabel=${'Annuler le forçage'} @click=${() => this.cancel()}>Annuler</ha-button>
          <ha-button class=action data-confirm-override appearance=accent .disabled=${!!this.busy} .accessibleLabel=${'Confirmer le forçage'} @click=${() => this.confirm()}>Confirmer</ha-button>
        </div>` : nothing}
      ${this.error ? html`<ha-alert class=error alert-type=error>${this.error}</ha-alert>` : nothing}
      <p class=note>La sélection est commune à Home Assistant. L’acceptation d’une commande ne confirme pas la marche réelle. Utiliser uniquement avec un contrôleur Flow.io compatible.</p>
    </div></ha-card>`;
  }
  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit)}
    ha-card{overflow:hidden}
    .body{padding:16px;display:grid;gap:10px}
    .title{margin:0;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .intro,.state,.note{margin:0;font-size:calc(.76rem * var(--fio-font-scale, 1.32));line-height:1.45}
    .state{padding:10px 12px;border:1px solid var(--divider-color);border-radius:11px;background:var(--secondary-background-color);font-weight:600}
    .field{display:flex;flex-direction:column;gap:6px}
    .field span{font-size:calc(.75rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .field select,.field input{min-height:40px;width:100%;box-sizing:border-box;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:0 8px}
    .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
    .action{--ha-button-height:40px}
    .action::part(base){min-width:112px;border-radius:11px}
    .action[appearance=accent]::part(base){font-weight:650}
    .confirmation{display:flex;justify-content:flex-end;gap:8px}
    .confirm-prompt,.error{font-size:calc(.76rem * var(--fio-font-scale, 1.32));line-height:1.45}
    .note{color:var(--secondary-text-color)}
  `;
}
class FlowioOverrideCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: OverrideConfig;
  private error = '';
  setConfig(input: unknown) { this.config = normalizeOverrideConfig(input); this.error = ''; }
  private commit(config: OverrideConfig) {
    this.config = config;
    this.error = '';
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }
  private changed(event: CustomEvent) {
    event.stopPropagation();
    if (!this.config) return;
    try {
      const value = (event.detail?.value ?? {}) as Record<string, unknown>;
      this.commit(normalizeOverrideConfig({ ...value, durations: Array.isArray(value.durations) ? value.durations : this.config.durations }));
    } catch (error) { this.error = error instanceof Error ? error.message : 'Configuration invalide'; }
  }
  render() {
    if (!this.config || !this.hass) return nothing;
    const labels: Record<string, string> = { title: 'Titre', device: 'Équipement', durations: 'Durées (minutes)' };
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'device', selector: { text: {} } },
      { name: 'durations', selector: { number: { multiple: true, min: 1, max: 1440, step: 1, mode: 'box' } } }
    ];
    return html`<p>Le préfixe est fourni par l’intégration Flow.io.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>`;
  }
  static styles = css`
    :host{display:block}
    p{color:var(--secondary-text-color);line-height:1.5}
    p[role=alert]{color:var(--error-color)}
  `;
}
if (!customElements.get('flowio-override-card')) customElements.define('flowio-override-card', FlowioOverrideCard);
if (!customElements.get('flowio-override-card-editor')) customElements.define('flowio-override-card-editor', FlowioOverrideCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-override-card')) {
  registry.customCards.push({ type: 'flowio-override-card', name: 'Flow.io Forçage', description: 'Forçage temporaire d’un équipement Flow.io avec confirmation et durée.', preview: true });
}
