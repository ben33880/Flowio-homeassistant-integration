import { normalizePrefix } from './entities';
import { powerBindings, systemBindings } from './firmware-model';
import { numericValue } from './gauge-model';
import { available, type EntityState } from './model';

export const STATUS_ITEMS = ['wifi_ip', 'wifi_mac', 'wifi_rssi', 'sys_upt_mn', 'sys_hp_free', 'sys_hp_min_free', 'sys_hp_frag', 'voltage', 'current'] as const;
export type StatusItem = typeof STATUS_ITEMS[number];

export interface StatusConfig {
  type: string;
  title: string;
  entity_prefix: string;
  items: StatusItem[];
  grid_options?: Record<string, unknown>;
}

const LABELS: Record<StatusItem, string> = {
  wifi_ip: 'Adresse IP',
  wifi_mac: 'Adresse MAC',
  wifi_rssi: 'Signal Wi-Fi',
  sys_upt_mn: 'Temps de fonctionnement',
  sys_hp_free: 'Mémoire libre',
  sys_hp_min_free: 'Mémoire minimale libre',
  sys_hp_frag: 'Fragmentation mémoire',
  voltage: 'Tension',
  current: 'Courant'
};

export function normalizeStatusConfig(input: unknown): StatusConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration objet attendue');
  const raw = input as Record<string, unknown>;
  const title = raw.title ?? 'État système';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const supplied = raw.items === undefined ? ['wifi_ip', 'sys_hp_free', 'sys_upt_mn'] : raw.items;
  if (!Array.isArray(supplied) || supplied.some(value => typeof value !== 'string' || !(STATUS_ITEMS as readonly string[]).includes(value))) {
    throw new Error('Choisir les informations proposées');
  }
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-status-card',
    title,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    items: [...new Set(supplied)] as StatusItem[],
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function statusLabel(item: StatusItem): string {
  return LABELS[item];
}

export function statusBindings(prefix: string, items: readonly StatusItem[]): { item: StatusItem; id: string; label: string }[] {
  const system = systemBindings(prefix, ['network', 'system']);
  const power = powerBindings(prefix);
  return items.map(item => {
    const source = item === 'voltage' || item === 'current' ? power : system;
    const found = source.find(binding => binding.id.endsWith(item));
    return { item, id: found ? found.id : `sensor.${prefix ? `${prefix}_` : ''}${item}`, label: LABELS[item] };
  });
}

export function formatUptime(minutes: number): string {
  if (minutes >= 1440) return `${(minutes / 1440).toFixed(1)} j`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} h`;
  return `${Math.round(minutes)} min`;
}

export function statusValue(item: StatusItem, state?: EntityState): string {
  if (!state) return 'Entité absente';
  if (!available(state)) return 'Indisponible';
  if (item === 'sys_upt_mn') {
    const minutes = numericValue(state.state);
    return minutes === undefined ? state.state : formatUptime(minutes);
  }
  const unit = typeof state.attributes.unit_of_measurement === 'string' ? state.attributes.unit_of_measurement : '';
  return unit ? `${state.state} ${unit}` : state.state;
}
