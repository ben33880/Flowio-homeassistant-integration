import { LitElement, html, css, nothing } from 'lit';
import './order-list';
import { ensureHaElements } from './ha-controls';
import { available, type Hass } from './model';
import { commonEntityPrefix, displayName, entityName } from './names';
import { mergeOrder, orderItems } from './order-list';
import { stateIcon } from './state-history-model';
import { toneFor } from './visual';
import {
  actuatorActiveCount,
  actuatorGlobalReset,
  actuatorResetEntity,
  actuatorRole,
  formatRuntime,
  normalizeActuatorConfig,
  RUNTIME_LABELS,
  RUNTIME_PERIODS,
  runtimeSecondsFor,
  type ActuatorConfig
} from './actuator-model';

class FlowioActuatorCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, busy: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: ActuatorConfig;
  private busy = '';
  private error = '';

  static getConfigElement() { return document.createElement('flowio-actuator-card-editor'); }
  static getStubConfig(): ActuatorConfig { return normalizeActuatorConfig({}); }
  getCardSize() { return 3 + Math.max(1, this.config?.entities.length ?? 0); }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  setConfig(input: unknown) {
    this.config = normalizeActuatorConfig(input);
    this.error = '';
  }

  connectedCallback() {
    super.connectedCallback();
    void ensureHaElements(['ha-button']).catch(error => {
      console.error('[flowio] Boutons Home Assistant indisponibles', error);
      this.error = 'Boutons natifs Home Assistant indisponibles. Recharger le tableau de bord.';
    });
  }

  private namePrefix(): string {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return '';
    return config.name_prefix || commonEntityPrefix(config.entities, hass.states);
  }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  private async press(entityId: string, message: string) {
    const hass = this.hass;
    if (!hass || this.busy) return;
    if (!window.confirm(message)) return;
    this.busy = entityId;
    this.error = '';
    try {
      await hass.callService('button', 'press', { entity_id: entityId });
    } catch {
      this.error = 'Commande refusée ou échouée. Vérifier les droits et la disponibilité.';
    } finally {
      this.busy = '';
    }
  }

  private row(id: string, prefix: string) {
    const config = this.config!, hass = this.hass!, state = hass.states[id];
    const name = displayName(entityName(id, state), prefix);
    const role = actuatorRole(config.entity_prefix, id);
    const icon = stateIcon(id, state);
    const tone = role ? toneFor(role) : 'water';
    const reset = actuatorResetEntity(config, id);
    const canReset = !!reset && !!hass.states[reset] && !['unavailable', ''].includes(hass.states[reset].state);
    const active = state?.state === 'on';
    return html`<div class=row data-entity=${id} data-available=${state ? 'true' : 'false'}>
      <div class=c-name>
        <span class=icon-plate data-tone=${tone} data-on=${active ? 'true' : 'false'}><ha-icon .icon=${icon} aria-hidden=true></ha-icon></span>
        <button type=button class=name-button ?disabled=${!state} @click=${() => this.more(id)}>${name}</button>
      </div>
      ${RUNTIME_PERIODS.map(period => {
        const seconds = runtimeSecondsFor(state, config, period);
        const empty = seconds === undefined || seconds === 0;
        return html`<span class=c-time data-empty=${empty ? 'true' : 'false'} data-period=${period}>${formatRuntime(seconds)}</span>`;
      })}
      <span class=c-actions>
        ${canReset ? html`<ha-button class=reset appearance=plain title=${`Remettre à zéro les durées de ${name}`} .disabled=${this.busy === reset} .accessibleLabel=${`Remettre à zéro les durées de ${name}`} @click=${() => this.press(reset!, `Remettre à zéro les durées de ${name} ?`)}><ha-icon slot=start icon=mdi:refresh aria-hidden=true></ha-icon></ha-button>` : nothing}
      </span>
    </div>`;
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const prefix = this.namePrefix();
    const active = actuatorActiveCount(hass, config.entities);
    const total = config.entities.length;
    const globalReset = actuatorGlobalReset(config);
    const canResetAll = !!hass.states[globalReset] && !['unavailable', ''].includes(hass.states[globalReset].state);
    return html`<ha-card><div class=body>
      <header class=head>
        <div class=head-copy>
          <h3 class=title>${config.title}</h3>
          ${config.subtitle ? html`<p class=subtitle>${config.subtitle}</p>` : nothing}
        </div>
        <div class=head-side>
          ${total ? html`<span class=count><span class=count-dot data-on=${active > 0 ? 'true' : 'false'} aria-hidden=true></span>${active} actif(s) / ${total}</span>` : nothing}
          ${canResetAll ? html`<ha-button class=reset-all appearance=outlined .disabled=${!!this.busy} .accessibleLabel=${'Remettre à zéro toutes les durées'} @click=${() => this.press(globalReset, 'Remettre à zéro les compteurs de tous les équipements ?')}><ha-icon slot=start icon=mdi:refresh aria-hidden=true></ha-icon>Tout remettre à zéro</ha-button>` : nothing}
        </div>
      </header>
      ${this.error ? html`<p class=error role=alert>${this.error}</p>` : nothing}
      ${!total ? html`<p class=empty>Choisir les équipements dans l’éditeur.</p>` : html`<div class=table-scroll><div class=table>
        <div class="row head" aria-hidden=true>
          <span class=c-name>Équipement</span>
          ${RUNTIME_PERIODS.map(period => html`<span class=c-time>${RUNTIME_LABELS[period]}</span>`)}
          <span class=c-actions>Actions</span>
        </div>
        ${config.entities.map(id => this.row(id, prefix))}
      </div></div>`}
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit);--fio-surface:var(--ha-card-background,var(--card-background-color));--fio-panel:var(--fio-surface);--fio-water:var(--flowio-water-color,var(--blue-color,var(--primary-color)));--fio-air:var(--flowio-air-color,var(--amber-color,var(--accent-color,var(--primary-color))));--fio-ph:var(--flowio-ph-color,var(--purple-color,var(--accent-color,var(--primary-color))));--fio-orp:var(--flowio-orp-color,var(--cyan-color,var(--info-color,var(--primary-color))));--fio-pressure:var(--flowio-pressure-color,var(--orange-color,var(--accent-color,var(--primary-color))))}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 14px}
    .head-copy{min-width:0}
    .title{margin:0;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .subtitle{margin:4px 0 0;font-size:calc(.78rem * var(--fio-font-scale, 1.32));line-height:1.35;color:var(--secondary-text-color)}
    .head-side{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-inline-start:auto}
    .count{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;background:var(--secondary-background-color);color:var(--secondary-text-color);font-size:calc(.76rem * var(--fio-font-scale, 1.32));font-weight:600;white-space:nowrap}
    .count-dot{width:9px;height:9px;border-radius:50%;background:var(--secondary-text-color)}
    .count-dot[data-on=true]{background:var(--success-color,var(--fio-water))}
    ha-button.reset-all{--ha-button-height:42px;--ha-button-border-radius:12px;--wa-color-on-normal:var(--fio-water);font-size:calc(.78rem * var(--fio-font-scale, 1.32))}
    .table-scroll{overflow-x:auto;margin:0 -4px}
    .table{display:flex;flex-direction:column;min-width:640px}
    .row{display:grid;grid-template-columns:minmax(150px,1.4fr) repeat(4,minmax(78px,1fr)) 48px;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--divider-color)}
    .row.head{padding:8px 4px;border-bottom:2px solid var(--divider-color)}
    .row.head .c-name,.row.head .c-time,.row.head .c-actions{font-size:calc(.64rem * var(--fio-font-scale, 1.32));font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color)}
    .row:last-child{border-bottom:0}
    .c-name{display:flex;align-items:center;gap:12px;min-width:0}
    .icon-plate{display:inline-flex;align-items:center;justify-content:center;flex:0 0 40px;width:40px;height:40px;border-radius:50%;color:var(--secondary-text-color);background:color-mix(in srgb,var(--secondary-text-color) 12%,var(--fio-surface))}
    .icon-plate[data-on=true]{color:var(--fio-accent);background:color-mix(in srgb,var(--fio-accent) 18%,var(--fio-surface))}
    .icon-plate[data-tone=water]{--fio-accent:var(--fio-water)}
    .icon-plate[data-tone=air]{--fio-accent:var(--fio-air)}
    .icon-plate[data-tone=ph]{--fio-accent:var(--fio-ph)}
    .icon-plate[data-tone=orp]{--fio-accent:var(--fio-orp)}
    .icon-plate[data-tone=pressure]{--fio-accent:var(--fio-pressure)}
    .icon-plate ha-icon{--mdc-icon-size:24px}
    .name-button{min-width:0;padding:0;border:0;background:none;text-align:left;font-family:inherit;font-size:var(--ha-font-size-m, .92rem);font-weight:500;line-height:1.25;color:var(--primary-text-color);overflow-wrap:anywhere;cursor:pointer}
    .name-button:disabled{cursor:default;color:var(--secondary-text-color)}
    .c-time{font-size:var(--ha-font-size-m, .92rem);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap;color:var(--primary-text-color)}
    .c-time[data-empty=true]{color:color-mix(in srgb,var(--secondary-text-color) 55%,var(--fio-surface));font-weight:400}
    .c-actions{display:flex;justify-content:flex-end}
    ha-button.reset{--ha-button-height:40px;--ha-button-border-radius:11px;--wa-color-on-normal:var(--secondary-text-color);box-sizing:border-box;min-width:40px;border:1px solid var(--divider-color);border-radius:11px}
    ha-button.reset::part(base){width:40px;padding:0;border-radius:11px}
    ha-button.reset:not([disabled]):hover{--wa-color-on-normal:var(--fio-water);border-color:var(--fio-water)}
    ha-button.reset ha-icon{--mdc-icon-size:20px}
    .empty{margin:0;font-size:calc(.82rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .error{margin:0 0 10px;font-size:calc(.78rem * var(--fio-font-scale, 1.32));color:var(--error-color)}
    @container(max-width:520px){.table{min-width:520px}.row{grid-template-columns:minmax(120px,1.4fr) repeat(4,minmax(66px,1fr)) 44px;gap:8px}.icon-plate{flex-basis:34px;width:34px;height:34px}}
    @media (prefers-reduced-motion: reduce){*{transition:none!important}}
  `;
}

class FlowioActuatorCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: ActuatorConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeActuatorConfig(input); this.error = ''; }

  private commit(config: ActuatorConfig) {
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
      this.commit(normalizeActuatorConfig({ ...value, entities: mergeOrder(this.config.entities, selected) }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private reorder(order: string[]) {
    if (!this.config) return;
    try {
      this.commit(normalizeActuatorConfig({ ...this.config, entities: order }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private options(): { value: string; label: string }[] {
    if (!this.hass || !this.config) return [];
    const stem = this.config.entity_prefix ? `${this.config.entity_prefix}_` : '';
    const ids = Object.keys(this.hass.states).filter(id => id.startsWith(`switch.${stem}`)).sort();
    const prefix = this.config.name_prefix || commonEntityPrefix(ids, this.hass.states);
    return ids.map(id => ({ value: id, label: `${displayName(entityName(id, this.hass!.states[id]), prefix)} · ${id}` }));
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'subtitle', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'name_prefix', selector: { text: {} } }
    ];
    const entitySchema = [{ name: 'entities', selector: { select: { multiple: true, mode: 'list', options: this.options() } } }];
    const labels: Record<string, string> = {
      title: 'Titre',
      subtitle: 'Sous-titre',
      entity_prefix: 'Préfixe firmware',
      name_prefix: 'Texte à retirer devant les noms (vide = automatique)',
      entities: 'Actionneurs affichés'
    };
    const computeLabel = (field: { name: string }) => labels[field.name] ?? field.name;
    const prefix = this.config.name_prefix || commonEntityPrefix(this.config.entities, this.hass.states);
    const items = orderItems(this.config.entities, this.hass.states, prefix);
    return html`<p>Durées de fonctionnement lues dans les attributs de chaque entité (<code>${Object.values(this.config.runtime_keys).join(', ')}</code>). Le bouton de remise à zéro cible <code>button.&lt;préfixe&gt;_pd_reset_upt_*</code> ; l’ordre se règle par glisser-déposer.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form><flowio-order-list .items=${items} @order-changed=${(event: CustomEvent) => this.reorder(event.detail.order)}></flowio-order-list><ha-form .hass=${this.hass} .data=${this.config} .schema=${entitySchema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form>`;
  }

  static styles = css`:host{display:block}p{color:var(--secondary-text-color);line-height:1.5}p[role=alert]{color:var(--error-color)}code{font-size:calc(.85em * var(--fio-font-scale, 1.32))}`;
}

if (!customElements.get('flowio-actuator-card')) customElements.define('flowio-actuator-card', FlowioActuatorCard);
if (!customElements.get('flowio-actuator-card-editor')) customElements.define('flowio-actuator-card-editor', FlowioActuatorCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-actuator-card')) {
  registry.customCards.push({ type: 'flowio-actuator-card', name: 'Flow.io Équipements du bassin', description: 'Durées de fonctionnement (jour/semaine/mois/total) et remise à zéro par actionneur.', preview: true });
}
