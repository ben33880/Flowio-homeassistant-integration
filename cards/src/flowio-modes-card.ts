import { FlowioTileGridCard, FlowioTileGridEditor, normalizeTileGridConfig, type TileGridConfig } from './tile-grid';

export function normalizeModesConfig(input: unknown): TileGridConfig {
  return normalizeTileGridConfig(input, 'custom:flowio-modes-card', 'Modes');
}

class FlowioModesCard extends FlowioTileGridCard {
  protected normalizeConfig(input: unknown): TileGridConfig { return normalizeModesConfig(input); }
  static getConfigElement() { return document.createElement('flowio-modes-card-editor'); }
  static getStubConfig(): TileGridConfig { return normalizeModesConfig({}); }
}

class FlowioModesCardEditor extends FlowioTileGridEditor {
  protected normalizeConfig(input: unknown): TileGridConfig { return normalizeModesConfig(input); }
}

if (!customElements.get('flowio-modes-card')) customElements.define('flowio-modes-card', FlowioModesCard);
if (!customElements.get('flowio-modes-card-editor')) customElements.define('flowio-modes-card-editor', FlowioModesCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-modes-card')) {
  registry.customCards.push({ type: 'flowio-modes-card', name: 'Flow.io Modes', description: 'Grille de tuiles pour les modes.', preview: true });
}
