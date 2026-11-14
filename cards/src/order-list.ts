import { LitElement, html, css, nothing } from 'lit';
import type { EntityState } from './model';
import { displayName, entityName } from './names';

export interface OrderItem {
  value: string;
  label: string;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function mergeOrder(previous: readonly string[], selected: readonly string[]): string[] {
  const chosen = new Set(selected);
  const kept = previous.filter(value => chosen.has(value));
  const added = selected.filter(value => !previous.includes(value));
  return [...kept, ...added];
}

export function orderItems(ids: readonly string[], states: Record<string, EntityState> | undefined, prefix: string): OrderItem[] {
  return ids.map(id => ({ value: id, label: displayName(entityName(id, states?.[id]), prefix) }));
}

const GRIP = html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 8h5M13 8h5M6 12h5M13 12h5M6 16h5M13 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"></path></svg>`;

class FlowioOrderList extends LitElement {
  static properties = { items: { attribute: false }, heading: { type: String } };
  declare items: OrderItem[];
  heading = 'Ordre d’affichage';
  private dragIndex = -1;
  private overIndex = -1;

  constructor() {
    super();
    this.items = [];
  }

  private dragStart(event: DragEvent, index: number) {
    this.dragIndex = index;
    this.overIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
    this.requestUpdate();
  }

  private dragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.overIndex !== index) {
      this.overIndex = index;
      this.requestUpdate();
    }
  }

  private drop(event: DragEvent, index: number) {
    event.preventDefault();
    const from = this.dragIndex;
    this.dragIndex = -1;
    this.overIndex = -1;
    if (from < 0 || from === index) {
      this.requestUpdate();
      return;
    }
    const order = moveItem(this.items.map(item => item.value), from, index);
    this.dispatchEvent(new CustomEvent('order-changed', { detail: { order }, bubbles: true, composed: true }));
    this.requestUpdate();
  }

  private dragEnd() {
    this.dragIndex = -1;
    this.overIndex = -1;
    this.requestUpdate();
  }

  render() {
    if (this.items.length < 2) return nothing;
    return html`<div class=order>
      <div class=order-heading>${this.heading}</div>
      ${this.items.map((item, index) => html`<div class="order-row ${this.dragIndex === index ? 'dragging' : ''} ${this.overIndex === index && this.dragIndex !== index ? 'over' : ''}" @dragover=${(event: DragEvent) => this.dragOver(event, index)} @drop=${(event: DragEvent) => this.drop(event, index)}>
        <span class=order-handle draggable="true" role="button" tabindex="0" title="Glisser pour réordonner" aria-label=${`Réordonner ${item.label}`} @dragstart=${(event: DragEvent) => this.dragStart(event, index)} @dragend=${() => this.dragEnd()}>${GRIP}</span>
        <span class=order-label>${item.label}</span>
      </div>`)}
    </div>`;
  }

  static styles = css`
    :host{display:block}
    .order{margin:12px 0}
    .order-heading{font-size:calc(.8rem * var(--fio-font-scale, 1.32));font-weight:600;color:var(--secondary-text-color);margin:0 0 6px}
    .order-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--divider-color);border-radius:8px;margin-bottom:6px;background:var(--card-background-color);transition:border-color .15s ease,opacity .15s ease}
    .order-row.dragging{opacity:.5}
    .order-row.over{border-color:var(--primary-color)}
    .order-handle{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:2px;border-radius:6px;color:var(--secondary-text-color);cursor:grab;-webkit-user-select:none;user-select:none}
    .order-handle:hover{color:var(--primary-color);background:var(--secondary-background-color)}
    .order-handle:active{cursor:grabbing}
    .order-handle:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
    .order-label{flex:1;min-width:0;overflow-wrap:anywhere;font-size:calc(.82rem * var(--fio-font-scale, 1.32))}
  `;
}

if (!customElements.get('flowio-order-list')) customElements.define('flowio-order-list', FlowioOrderList);
