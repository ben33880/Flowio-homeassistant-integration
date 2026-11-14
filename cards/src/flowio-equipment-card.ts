import { FlowioTileGridCard, FlowioTileGridEditor, normalizeTileGridConfig, type TileGridConfig } from './tile-grid';
import { equipmentForced, forcedLabel } from './override-model';

export function normalizeEquipmentConfig(input: unknown): TileGridConfig {
  return normalizeTileGridConfig(input, 'custom:flowio-equipment-card', 'Équipements');
}

class FlowioEquipmentCard extends FlowioTileGridCard {
  protected normalizeConfig(input: unknown): TileGridConfig { return normalizeEquipmentConfig(input); }
  protected tileForcedLabel(entity: string): string | undefined {
    return equipmentForced(this.hass, entity) ? forcedLabel(this.hass) : undefined;
  }
  static getConfigElement() { return document.createElement('flowio-equipment-card-editor'); }
  static getStubConfig(): TileGridConfig { return normalizeEquipmentConfig({}); }
}

class FlowioEquipmentCardEditor extends FlowioTileGridEditor {
  protected normalizeConfig(input: unknown): TileGridConfig { return normalizeEquipmentConfig(input); }
}

if (!customElements.get('flowio-equipment-card')) customElements.define('flowio-equipment-card', FlowioEquipmentCard);
if (!customElements.get('flowio-equipment-card-editor')) customElements.define('flowio-equipment-card-editor', FlowioEquipmentCardEditor);
const registry = window as Window & { customCards?: Array<Record<string, unknown>> };
registry.customCards ??= [];
if (!registry.customCards.some(card => card.type === 'flowio-equipment-card')) {
  registry.customCards.push({ type: 'flowio-equipment-card', name: 'Flow.io Équipements', description: 'Grille de tuiles pour les équipements.', preview: true });
}
