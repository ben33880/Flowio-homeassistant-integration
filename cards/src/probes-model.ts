import { normalizePrefix } from './entities';
import { attributeScale, numericValue } from './gauge-model';
import { available, type EntityState } from './model';
import { commonEntityPrefix, commonNamePrefix, displayName, entityName } from './names';

export { commonEntityPrefix, commonNamePrefix, displayName as probeDisplayName, entityName as rawProbeName };

export interface ProbeScale {
  min: number;
  max: number;
}

export const PROBE_TONES = ['water', 'air', 'ph', 'orp', 'pressure'] as const;
export type ProbeTone = typeof PROBE_TONES[number];

export const PROBE_MODES = ['line', 'gauge'] as const;
export type ProbeMode = typeof PROBE_MODES[number];

export interface ProbeOverride {
  name?: string;
  color?: string;
  min?: number;
  max?: number;
  mode?: ProbeMode;
}

export interface ProbesConfig {
  type: string;
  title: string;
  entity_prefix: string;
  entities: string[];
  name_prefix: string;
  columns: number;
  items: Record<string, ProbeOverride>;
  grid_options?: Record<string, unknown>;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuration objet attendue');
  return value as Record<string, unknown>;
}

function scaleValue(value: unknown): ProbeScale {
  const raw = objectValue(value);
  const { min, max } = raw;
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new Error('Échelle attendue avec max supérieur à min');
  }
  return { min, max };
}

export function probeOverride(value: unknown): ProbeOverride {
  const raw = objectValue(value);
  const result: ProbeOverride = {};
  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string') throw new Error('Le nom doit être un texte');
    result.name = raw.name;
  }
  if (raw.color !== undefined) {
    if (typeof raw.color !== 'string') throw new Error('La couleur doit être un texte');
    if (raw.color) result.color = raw.color;
  }
  if (raw.mode !== undefined) {
    if (raw.mode !== 'line' && raw.mode !== 'gauge') throw new Error('Mode attendu : line ou gauge');
    result.mode = raw.mode;
  }
  if (raw.min !== undefined) {
    if (typeof raw.min !== 'number' || !Number.isFinite(raw.min)) throw new Error('Minimum invalide');
    result.min = raw.min;
  }
  if (raw.max !== undefined) {
    if (typeof raw.max !== 'number' || !Number.isFinite(raw.max)) throw new Error('Maximum invalide');
    result.max = raw.max;
  }
  if (result.min !== undefined && result.max !== undefined && result.max <= result.min) {
    throw new Error('Le maximum doit être supérieur au minimum');
  }
  return result;
}

export function normalizeProbesConfig(input: unknown): ProbesConfig {
  const raw = objectValue(input);
  let title: string;
  if (!('title' in raw)) title = 'Sondes';
  else if (raw.title === undefined) title = '';
  else if (typeof raw.title === 'string') title = raw.title;
  else throw new Error('Titre invalide');
  const name_prefix = raw.name_prefix ?? '';
  if (typeof name_prefix !== 'string') throw new Error('name_prefix doit être un texte');
  const columns = raw.columns ?? 2;
  if (typeof columns !== 'number' || !Number.isInteger(columns) || columns < 1 || columns > 6) {
    throw new Error('Nombre de colonnes attendu entre 1 et 6');
  }
  const supplied = raw.entities === undefined ? [] : raw.entities;
  if (!Array.isArray(supplied) || supplied.some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('Liste d’entités invalide');
  }
  const items: Record<string, ProbeOverride> = {};
  if (raw.items !== undefined) {
    for (const [id, value] of Object.entries(objectValue(raw.items))) items[id] = probeOverride(value);
  }
  if (raw.colors !== undefined) {
    for (const [id, value] of Object.entries(objectValue(raw.colors))) {
      if (typeof value !== 'string') throw new Error('colors : valeur texte attendue');
      if (value) items[id] = { ...items[id], color: value };
    }
  }
  if (raw.scales !== undefined) {
    for (const [id, value] of Object.entries(objectValue(raw.scales))) {
      const scale = scaleValue(value);
      items[id] = { ...items[id], min: scale.min, max: scale.max };
    }
  }
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-probes-card',
    title,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    entities: [...new Set(supplied)] as string[],
    name_prefix,
    columns,
    items,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function probeIds(config: ProbesConfig): string[] {
  return config.entities;
}

export function probeScale(config: ProbesConfig, id: string, state?: EntityState): ProbeScale | undefined {
  const item = config.items[id];
  if (item?.min !== undefined && item?.max !== undefined) return { min: item.min, max: item.max };
  return attributeScale(state?.attributes);
}

export function probeValue(state?: EntityState): number | undefined {
  return numericValue(available(state) ? state.state : undefined);
}

export function probeMode(config: ProbesConfig, id: string): ProbeMode {
  return config.items[id]?.mode ?? 'line';
}

export function probeLabel(config: ProbesConfig, id: string, state: EntityState | undefined, prefix: string): string {
  const name = config.items[id]?.name;
  if (name) return name;
  return displayName(entityName(id, state), prefix);
}

export function probeTone(id: string, state?: EntityState): ProbeTone {
  if (id.endsWith('_io_ph')) return 'ph';
  if (id.endsWith('_io_orp') || id.endsWith('_pl_dis_setpoint')) return 'orp';
  if (id.endsWith('_io_psi')) return 'pressure';
  if (id.endsWith('_io_air_tmp') || id.endsWith('_io_wat_htr')) return 'air';
  if (id.endsWith('_io_wat_tmp')) return 'water';
  const unit = typeof state?.attributes.unit_of_measurement === 'string' ? state.attributes.unit_of_measurement : '';
  if (unit === 'mV') return 'orp';
  if (unit === 'bar' || unit === 'psi') return 'pressure';
  return 'water';
}

export function resolveProbeColor(config: ProbesConfig, id: string, state?: EntityState): { tone: ProbeTone; custom: string } {
  const override = config.items[id]?.color;
  if (override && (PROBE_TONES as readonly string[]).includes(override)) return { tone: override as ProbeTone, custom: '' };
  if (override) return { tone: probeTone(id, state), custom: override };
  return { tone: probeTone(id, state), custom: '' };
}
