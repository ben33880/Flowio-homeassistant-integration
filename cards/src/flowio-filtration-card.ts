import { LitElement, html, css, nothing } from 'lit';
import { available, type Hass } from './model';
import { formatHour, timingBindings, type RuntimeSlots } from './timing-model';
import { scheduleWindow, plannedDuration } from './filtration-schedule';
import { normalizeFiltrationConfig, type FiltrationConfig } from './filtration-model';

const SLOTS: RuntimeSlots = { filtration: 0, ph: 1, disinfection: 2 };
const TICKS = ['00:00', '06:00', '12:00', '18:00', '24:00'];

class FlowioFiltrationCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, now: { state: true } };
  declare hass?: Hass;
  private config?: FiltrationConfig;
  private now = Date.now();
  private timer?: ReturnType<typeof setInterval>;

  static getConfigElement() { return document.createElement('flowio-filtration-card-editor'); }
  static getStubConfig(): FiltrationConfig { return normalizeFiltrationConfig({}); }
  setConfig(input: unknown) { this.config = normalizeFiltrationConfig(input); }
  getCardSize() { return 3; }

  connectedCallback() {
    super.connectedCallback();
    this.now = Date.now();
    this.timer = setInterval(() => { this.now = Date.now(); }, 60000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private more(entityId: string) {
    if (this.hass?.states[entityId]) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
    }
  }

  private value(id: string): string {
    const state = this.hass?.states[id];
    if (!state) return 'Entité absente';
    if (!available(state)) return 'Indisponible';
    return formatHour(state.state) ?? 'Valeur invalide';
  }

  private clock() {
    const zone = (this.hass as (Hass & { config?: { time_zone?: string } }) | undefined)?.config?.time_zone;
    try {
      const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(this.now);
      const hour = parts.find(part => part.type === 'hour')!.value;
      const minute = parts.find(part => part.type === 'minute')!.value;
      return { left: (Number(hour) * 60 + Number(minute)) / 1440 * 100, label: `Heure actuelle : ${hour}:${minute} · ${zone || 'heure locale de cet appareil'}` };
    } catch {
      return undefined;
    }
  }

  render() {
    const config = this.config, hass = this.hass;
    if (!config || !hass) return html`<ha-card><div class=body>En attente de Home Assistant…</div></ha-card>`;
    const [startBinding, stopBinding] = timingBindings(config.entity_prefix, SLOTS, 'filtration_schedule');
    const start = hass.states[startBinding.id], stop = hass.states[stopBinding.id];
    const window = scheduleWindow(available(start) ? start.state : undefined, available(stop) ? stop.state : undefined);
    const clock = this.clock();
    return html`<ha-card>
      <div class=body>
        <div class=heading>
          <h3>${config.title}</h3>
          ${config.description ? html`<p>${config.description}</p>` : nothing}
        </div>
        <div class=timeline>
          <div class=rail role=img aria-label=${window ? `Filtration prévue de ${window.startText} à ${window.endText}, durée ${plannedDuration(window.durationMinutes)}${window.overnight ? ', passage à minuit' : ''}` : 'Plage de filtration indisponible'}>
            ${window?.segments.map(segment => html`<span class=band aria-hidden=true style=${`left:${segment.left}%;width:${segment.width}%`}></span>`)}
            ${clock ? html`<span class=now aria-hidden=true title=${clock.label} style=${`left:${clock.left}%`}></span>` : nothing}
          </div>
          <div class=ticks aria-hidden=true>${TICKS.map(tick => html`<span>${tick}</span>`)}</div>
        </div>
        ${!window ? html`<p class=unavailable role=status>Plage indisponible : vérifier les horaires Flow.io.</p>` : nothing}
        <div class=summary>
          <button type=button class=stat ?disabled=${!start} @click=${() => this.more(startBinding.id)} aria-label="Début calculé de filtration"><strong>${this.value(startBinding.id)}</strong><span>Début</span></button>
          <button type=button class=stat ?disabled=${!stop} @click=${() => this.more(stopBinding.id)} aria-label="Fin calculée de filtration"><strong>${this.value(stopBinding.id)}</strong><span>Fin</span></button>
          <div class=stat data-stat=duration><strong>${window ? plannedDuration(window.durationMinutes) : 'Indisponible'}</strong><span>Durée prévue</span></div>
        </div>
      </div>
    </ha-card>`;
  }

  static styles = css`
    :host{display:block;container-type:inline-size;color:var(--primary-text-color);font-family:var(--ha-font-family-body,inherit);--fio-water:var(--flowio-water-color,var(--blue-color,var(--primary-color)));--fio-orp:var(--flowio-orp-color,var(--cyan-color,var(--info-color,var(--primary-color))))}
    ha-card{overflow:hidden}
    .body{display:flex;flex-direction:column;gap:14px;padding:16px}
    .heading h3{margin:0;font-size:calc(1.05rem * var(--fio-font-scale, 1.32));font-weight:650;line-height:1.25}
    .heading p{margin:4px 0 0;font-size:calc(.8rem * var(--fio-font-scale, 1.32));line-height:1.45;color:var(--secondary-text-color)}
    .timeline{margin-top:6px}
    .rail{position:relative;height:8px;border-radius:999px;background:var(--secondary-background-color);box-shadow:inset 0 0 0 1px var(--divider-color)}
    .band{position:absolute;inset-block:0;border-radius:999px;background:linear-gradient(90deg,var(--fio-water),var(--fio-orp))}
    .now{position:absolute;top:-8px;height:24px;width:1px;background:var(--primary-text-color);z-index:1}
    .ticks{display:flex;justify-content:space-between;gap:4px;margin-top:10px;font-size:calc(.58rem * var(--fio-font-scale, 1.32));font-weight:600;color:var(--secondary-text-color);font-variant-numeric:tabular-nums}
    .unavailable{margin:0;font-size:calc(.75rem * var(--fio-font-scale, 1.32));color:var(--secondary-text-color)}
    .summary{display:flex;align-items:flex-start;flex-wrap:wrap;gap:12px 24px}
    .stat{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0;max-width:100%;padding:0;border:0;background:none;text-align:left;font:inherit;color:inherit;overflow-wrap:anywhere}
    .stat:disabled{cursor:default}
    .stat strong{font-size:calc(1.15rem * var(--fio-font-scale, 1.32));line-height:1.25;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.025em}
    .stat span{font-size:calc(.66rem * var(--fio-font-scale, 1.32));line-height:1.3;color:var(--secondary-text-color)}
    @media (prefers-reduced-motion: reduce){.band{transition:none}}
  `;
}

class FlowioFiltrationCardEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, error: { state: true } };
  declare hass?: Hass;
  private config?: FiltrationConfig;
  private error = '';

  setConfig(input: unknown) { this.config = normalizeFiltrationConfig(input); this.error = ''; }

  private changed(event: CustomEvent) {
    event.stopPropagation();
    try {
      this.config = normalizeFiltrationConfig(event.detail.value);
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
      { name: 'description', selector: { text: { multiline: true } } },
      { name: 'entity_prefix', selector: { text: {} } }
    ];
    const labels: Record<string, string> = { title: 'Titre', description: 'Description', entity_prefix: 'Préfixe firmware' };
    return html`${this.error ? html`<p role=alert>${this.error}</p>` : nothing}<ha-form .hass=${this.hass} .data=${this.config} .schema=${schema} .computeLabel=${(field: { name: string }) => labels[field.name] ?? field.name} @value-changed=${this.changed}></ha-form>`;
  }

  static styles = css`:host{display:block}p[role=alert]{color:var(--error-color)}`;
}

if (!customElements.get('flowio-filtration-card')) customElements.define('flowio-filtration-card', FlowioFiltrationCard);
if (!customElements.get('flowio-filtration-card-editor')) customElements.define('flowio-filtration-card-editor', FlowioFiltrationCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-filtration-card')) {
  registry.customCards.push({ type: 'flowio-filtration-card', name: 'Flow.io Filtration', description: 'Plage de filtration calculée, début, fin et durée prévue.', preview: true });
}
