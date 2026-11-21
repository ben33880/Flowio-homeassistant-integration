import { attributeScale, numericValue } from './gauge-model';
import { available, type EntityState } from './model';
import { commonEntityPrefix, commonNamePrefix, displayName, entityName } from './names';

export { commonEntityPrefix, commonNamePrefix, displayName as probeDisplayName, entityName as rawProbeName };

export interface ProbeScale { min: number; max: number; }
export const PROBE_TONES = ['water', 'air', 'ph', 'orp', 'pressure'] as const;
export type ProbeTone = typeof PROBE_TONES[number];
export const PROBE_MODES = ['line', 'gauge'] as const;
export type ProbeMode = typeof PROBE_MODES[number];
export interface ProbeOverride {
  name?: string;
  color?: string;
  mode?: ProbeMode;
  /** @deprecated Migration uniquement : jamais conservé par la normalisation. */
  min?: number;
  /** @deprecated Migration uniquement : jamais conservé par la normalisation. */
  max?: number;
}
export interface ProbesConfig {
  type: string;
  title: string;
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
  return result;
}
export function normalizeProbesConfig(input: unknown): ProbesConfig {
  const raw = objectValue(input);
  if ('entity_prefix' in raw) throw new Error('entity_prefix supprimé : le préfixe vient de l’intégration Flow.io. Retirer ce champ.');
  let title: string;
  if (!('title' in raw)) title = 'Sondes';
  else if (raw.title === undefined) title = '';
  else if (typeof raw.title === 'string') title = raw.title;
  else throw new Error('Titre invalide');
  const name_prefix = raw.name_prefix ?? '';
  if (typeof name_prefix !== 'string') throw new Error('name_prefix doit être un texte');
  const columns = raw.columns ?? 2;
  if (typeof columns !== 'number' || !Number.isInteger(columns) || columns < 1 || columns > 6) throw new Error('Nombre de colonnes attendu entre 1 et 6');
  const supplied = raw.entities === undefined ? [] : raw.entities;
  if (!Array.isArray(supplied) || supplied.some(value => typeof value !== 'string' || !value.trim())) throw new Error('Liste d’entités invalide');
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
  // Anciennes échelles locales abandonnées : les attributs firmware font autorité.
  if (raw.scales !== undefined) objectValue(raw.scales);
  const grid_options = raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) throw new Error('grid_options doit être un objet');
  return {
    type: 'custom:flowio-probes-card', title, entities: [...new Set(supplied)] as string[],
    name_prefix, columns, items, ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}
export function probeIds(config: ProbesConfig): string[] { return config.entities; }
export function probeScale(_config: ProbesConfig, _id: string, state?: EntityState): ProbeScale | undefined {
  return attributeScale(state?.attributes);
}
export function probeValue(state?: EntityState): number | undefined {
  return numericValue(available(state) ? state.state : undefined);
}
export function probeMode(config: ProbesConfig, id: string): ProbeMode { return config.items[id]?.mode ?? 'line'; }
export function probeLabel(config: ProbesConfig, id: string, state: EntityState | undefined, prefix: string, source?: { language?: string; locale?: { language?: string } }): string {
  const name = config.items[id]?.name;
  if (name) return name;
  return displayName(entityName(id, state, source), prefix);
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
