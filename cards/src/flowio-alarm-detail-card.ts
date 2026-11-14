import { LitElement, html, css, nothing } from 'lit';
import './order-list';
import { ensureHaElements } from './ha-controls';
import { type Hass } from './model';
import { displayName, entityName } from './names';
import { mergeOrder, orderItems } from './order-list';
import { stateIcon } from './state-history-model';
import {
  alarmConditionLabel,
  alarmDetailEntries,
  alarmNamePrefix,
  alarmPendingCount,
  detectedAlarmIds,
  normalizeAlarmDetailConfig,
  type AlarmDetail,
  type AlarmDetailConfig
} from './alarm-detail-model';

class FlowioAlarmDetailCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, busy: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: AlarmDetailConfig;
  private busy = '';
  private error = '';

  static getConfigElement() { return document.createElement('flowio-alarm-detail-card-editor'); }
  static getStubConfig(): AlarmDetailConfig { return normalizeAlarmDetailConfig({}); }
  getCardSize() { return 3 + Math.max(1, this.config?.alarms.length ?? 0); }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  setConfig(input: unknown) {
    this.config = normalizeAlarmDetailConfig(input);
    this.error = '';
  }

  connectedCallback() {
    super.connectedCallback();
    void ensureHaElements(['ha-button']).catch(error => {
      console.error('[flowio] Boutons Home Assistant indisponibles', error);
      this.error = 'Boutons natifs Home Assistant indisponibles. Recharger le tableau de bord.';
    });
  }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  private async press(entries: readonly AlarmDetail[], confirmMessage: string) {
    const hass = this.hass;
    if (!hass || this.busy || !entries.length) return;
    if (!window.confirm(confirmMessage)) return;
    this.busy = entries.length > 1 ? '__all__' : entries[0].resetEntity;
    this.error = '';
    try {
      for (const entry of entries) await hass.callService('button', 'press', { entity_id: entry.resetEntity });
    } catch {
      this.error = 'Commande refusée ou échouée. Vérifier les droits et la disponibilité.';
    } finally {
      this.busy = '';
    }
  }

  private row(entry: AlarmDetail, prefix: string) {
    const state = this.hass?.states[entry.entityId];
    const badge = alarmConditionLabel(state);
    const name = displayName(entry.name, prefix);
    const icon = stateIcon(entry.entityId, state);
    const canAck = entry.latched && entry.canReset;
    return html`<div class=row data-alarm=${entry.id} data-active=${entry.active ? 'true' : 'false'}>
      <div class=c-name>
        <span class=icon-plate data-tone=${entry.active ? 'active' : 'neutral'}><ha-icon .icon=${icon} aria-hidden=true></ha-icon></span>
        <button type=button class=name-button ?disabled=${!entry.present} @click=${() => this.more(entry.entityId)}>${name}</button>
      </div>
      <span class=c-condition><span class="pill" data-tone=${badge.tone}>${badge.label}</span></span>
      <span class=c-action>
        ${entry.latched
          ? html`<ha-button class=ack appearance=plain title=${`Acquitter ${name}`} .disabled=${!canAck || !!this.busy} .accessibleLabel=${`Acquitter ${name}`} @click=${() => this.press([entry], `Acquitter « ${name} » ? Le firmware vérifiera que la cause a disparu.`)}><ha-icon slot=start icon=mdi:refresh aria-hidden=true></ha-icon></ha-button>`
          : nothing}
      </span>
    </div>`;
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const entries = alarmDetailEntries(hass, config);
    const prefix = alarmNamePrefix(config, hass, entries.map(entry => entry.entityId));
    const pending = alarmPendingCount(entries);
    const ackable = entries.filter(entry => entry.active && entry.latched && entry.canReset);
    return html`<ha-card><div class=body>
      <header class=head>
        <div class=head-copy><h3 class=title>${config.title}</h3></div>
        <div class=head-side>
          ${entries.length ? html`<span class=count>${entries.length} alarme${entries.length > 1 ? 's' : ''} · ${pending} à acquitter</span>` : nothing}
          ${entries.length ? html`<ha-button class=ack-all appearance=outlined .disabled=${!ackable.length || !!this.busy} .accessibleLabel=${'Acquitter les alarmes disponibles'} @click=${() => this.press(ackable, `Acquitter ${ackable.length} alarme${ackable.length > 1 ? 's' : ''} disponible${ackable.length > 1 ? 's' : ''} ?`)}><ha-icon slot=start icon=mdi:check aria-hidden=true></ha-icon>Acquitter les disponibles</ha-button>` : nothing}
        </div>
      </header>
      ${this.error ? html`<p class=error role=alert>${this.error}</p>` : nothing}
      ${!entries.length ? html`<p class=empty>Choisir les alarmes dans l’éditeur.</p>` : html`<div class=table-scroll><div class=table>
        <div class="row head" aria-hidden=true>
          <span class=c-name>Alarme</span>
          <span class=c-condition>Condition</span>
          <span class=c-action>Action</span>
        </div>
        ${entries.map(entry => this.row(entry, prefix))}
      </div></div>`}
    </div></ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit);--fio-surface:var(--ha-card-background,var(--card-background-color));--fio-success:var(--success-color,#2e7d32);--fio-warning:var(--warning-color,#fb8c00)}
    ha-card{overflow:hidden}
    .body{padding:16px}
    .head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 14px}
    .head-copy{min-width:0}
    .title{margin:0;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .head-side{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-inline-start:auto}
    .count{padding:6px 12px;border-radius:999px;background:var(--secondary-background-color);color:var(--secondary-text-color);font-size:calc(.76rem * var(--fio-font-scale, 1.32));font-weight:600;white-space:nowrap}
    ha-button.ack-all{--ha-button-height:42px;--ha-button-border-radius:12px;--wa-color-on-normal:var(--fio-success);font-size:calc(.78rem * var(--fio-font-scale, 1.32))}
    .table-scroll{overflow-x:auto;margin:0 -4px}
    .table{display:flex;flex-direction:column;min-width:720px}
    .row{display:grid;grid-template-columns:minmax(200px,2fr) minmax(100px,1fr) 56px;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--divider-color)}
    .row.head{padding:8px 4px;border-bottom:2px solid var(--divider-color)}
    .row.head span{font-size:calc(.64rem * var(--fio-font-scale, 1.32));font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color)}
    .row:last-child{border-bottom:0}
    .c-name{display:flex;align-items:center;gap:12px;min-width:0}
    .icon-plate{display:inline-flex;align-items:center;justify-content:center;flex:0 0 40px;width:40px;height:40px;border-radius:50%;color:var(--secondary-text-color);background:color-mix(in srgb,var(--secondary-text-color) 12%,var(--fio-surface))}
    .icon-plate[data-tone=active]{color:#fff;background:var(--error-color)}
    .icon-plate ha-icon{--mdc-icon-size:24px}
    .name-button{min-width:0;padding:0;border:0;background:none;text-align:left;font-family:inherit;font-size:var(--ha-font-size-m, .92rem);font-weight:500;line-height:1.25;color:var(--primary-text-color);overflow-wrap:anywhere;cursor:pointer}
    .name-button:disabled{cursor:default;color:var(--secondary-text-color)}
    .pill{display:inline-flex;align-items:center;padding:4px 10px;border-radius:8px;font-size:var(--ha-font-size-s, .8rem);font-weight:600;white-space:nowrap;background:var(--secondary-background-color);color:var(--secondary-text-color)}
    .pill[data-tone=active]{background:color-mix(in srgb,var(--error-color) 14%,var(--fio-surface));color:var(--error-color)}
    .pill[data-tone=latched]{background:color-mix(in srgb,var(--fio-warning) 16%,var(--fio-surface));color:var(--fio-warning)}
    .pill[data-tone=inactive]{background:color-mix(in srgb,var(--fio-success) 14%,var(--fio-surface));color:var(--fio-success)}
    .c-action{display:flex;justify-content:flex-end}
    .auto{font-size:var(--ha-font-size-s, .8rem);color:var(--secondary-text-color)}
    ha-button.ack{--ha-button-height:40px;--ha-button-border-radius:11px;--wa-color-on-normal:var(--secondary-text-color);box-sizing:border-box;min-width:40px;border:1px solid var(--divider-color);border-radius:11px}
    ha-button.ack::part(base){width:40px;padding:0;border-radius:11px}
    ha-button.ack:not([disabled]):hover{--wa-color-on-normal:var(--primary-color);border-color:var(--primary-color)}
    ha-button.ack[disabled]{opacity:.55}
    ha-button.ack ha-icon{--mdc-icon-size:20px}
    .empty{margin:0;font-size:calc(.82rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .error{margin:0 0 10px;font-size:calc(.78rem * var(--fio-font-scale, 1.32));color:var(--error-color)}
    @container(max-width:560px){.table{min-width:420px}.row{grid-template-columns:minmax(150px,2fr) minmax(90px,1fr) 52px;gap:8px}.icon-plate{flex-basis:34px;width:34px;height:34px}}
    @media (prefers-reduced-motion: reduce){*{transition:none!important}}
  `;
}

class FlowioAlarmDetailCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: AlarmDetailConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeAlarmDetailConfig(input); this.error = ''; }

  private commit(config: AlarmDetailConfig) {
    this.config = config;
    this.error = '';
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    if (!this.config) return;
    try {
      const value = (event.detail?.value ?? {}) as Record<string, unknown>;
      const selected = Array.isArray(value.alarms) ? value.alarms as string[] : this.config.alarms;
      this.commit(normalizeAlarmDetailConfig({ ...value, alarms: mergeOrder(this.config.alarms, selected) }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private reorder(order: string[]) {
    if (!this.config) return;
    try {
      this.commit(normalizeAlarmDetailConfig({ ...this.config, alarms: order }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Configuration invalide';
    }
  }

  private options(): { value: string; label: string }[] {
    if (!this.hass || !this.config) return [];
    const ids = detectedAlarmIds(this.hass, this.config.entity_prefix);
    const prefix = alarmNamePrefix(this.config, this.hass, ids);
    return ids.map(id => ({ value: id, label: `${displayName(entityName(id, this.hass!.states[id]), prefix)} · ${id}` }));
  }

  render() {
    if (!this.config || !this.hass) return nothing;
    const schema = [
      { name: 'title', selector: { text: {} } },
      { name: 'entity_prefix', selector: { text: {} } },
      { name: 'name_prefix', selector: { text: {} } }
    ];
    const alarmSchema = [{ name: 'alarms', selector: { select: { multiple: true, mode: 'list', options: this.options() } } }];
    const labels: Record<string, string> = {
      title: 'Titre',
      entity_prefix: 'Préfixe firmware',
      name_prefix: 'Texte à retirer devant les noms (vide = automatique)',
      alarms: 'Alarmes affichées'
    };
    const computeLabel = (field: { name: string }) => labels[field.name] ?? field.name;
    const prefix = alarmNamePrefix(this.config, this.hass, this.config.alarms);
    const items = orderItems(this.config.alarms, this.hass.states, prefix);
    return html`<p>Les alarmes sont détectées depuis les entités <code>binary_sensor.&lt;préfixe&gt;_alm_*_active</code>. L’acquittement cible <code>button.&lt;préfixe&gt;_alm_*_reset</code> ; l’ordre se règle par glisser-déposer.</p>${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form><flowio-order-list .items=${items} @order-changed=${(event: CustomEvent) => this.reorder(event.detail.order)}></flowio-order-list><ha-form .hass=${this.hass} .data=${this.config} .schema=${alarmSchema} .computeLabel=${computeLabel} @value-changed=${this.changed}></ha-form>`;
  }

  static styles = css`:host{display:block}p{color:var(--secondary-text-color);line-height:1.5}p[role=alert]{color:var(--error-color)}code{font-size:calc(.85em * var(--fio-font-scale, 1.32))}`;
}

if (!customElements.get('flowio-alarm-detail-card')) customElements.define('flowio-alarm-detail-card', FlowioAlarmDetailCard);
if (!customElements.get('flowio-alarm-detail-card-editor')) customElements.define('flowio-alarm-detail-card-editor', FlowioAlarmDetailCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-alarm-detail-card')) {
  registry.customCards.push({ type: 'flowio-alarm-detail-card', name: 'Flow.io Gestion des alarmes', description: 'Détail des alarmes (déclenchement, condition, latch) et acquittement.', preview: true });
}
