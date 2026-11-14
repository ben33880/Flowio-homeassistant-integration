// Demo-only Material icon glyphs so previews show recognisable symbols.
const FLOWIO_ICONS = {
  'pump': '⛲',
  'water-pump': '🚰',
  'flask-outline': '🧪',
  'flask': '🧪',
  'flask-plus-outline': '🧪',
  'water': '💧',
  'water-outline': '💧',
  'water-plus-outline': '💧',
  'water-check-outline': '💧',
  'robot-vacuum': '🤖',
  'robot': '🤖',
  'lightning-bolt': '⚡',
  'lightning-bolt-outline': '⚡',
  'heat-pump-outline': '♨️',
  'radiator': '♨️',
  'lightbulb-outline': '💡',
  'restart': '↺',
  'refresh': '↻',
  'check': '✓',
  'bell-outline': '🔔',
  'bell-alert': '🔔',
  'alarm-light': '🚨',
  'pool': '🏊',
  'shield-alert-outline': '🛡️',
  'alert-outline': '⚠️',
  'checkbox-marked-circle-outline': '☑️',
  'toggle-switch': '🔘',
  'calendar-clock': '🗓️',
  'calendar-range': '🗓️',
  'snowflake': '❄️',
  'thermometer': '🌡️',
  'pool-thermometer': '🌡️',
  'gauge': '⏲️',
  'target': '🎯',
  'waveform': '〰️',
  'chart-line': '📈',
  'clock-outline': '🕒',
  'tune': '🎛️',
  'timer-cog-outline': '⏱️',
  'bell-alert': '🔔',
  'water-check': '✅'
};
if (!customElements.get('ha-icon')) {
  customElements.define('ha-icon', class extends HTMLElement {
    static get observedAttributes() { return ['icon']; }
    constructor() {
      super();
      this._icon = '';
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{display:inline-flex;align-items:center;justify-content:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);font-size:calc(var(--mdc-icon-size,24px) * .82);line-height:1}span{font-size:1em}</style><span></span>';
    }
    get icon() { return this._icon; }
    set icon(value) { this._icon = value || ''; this.sync(); }
    connectedCallback() { this.sync(); }
    attributeChangedCallback() { this.sync(); }
    sync() {
      const raw = this._icon || this.getAttribute('icon') || '';
      const name = raw.replace(/^mdi:/, '');
      const glyph = FLOWIO_ICONS[name] ?? '●';
      this.shadowRoot.querySelector('span').textContent = glyph;
    }
  });
}
