import { normalizePrefix } from './entities';
import type { EntityState } from './model';
import { commonEntityPrefix, displayName, entityName } from './names';
import {
  PROBE_MODES,
  probeLabel as multiLabel,
  probeMode as multiMode,
  probeOverride,
  probeScale as multiScale,
  probeTone,
  probeValue,
  resolveProbeColor as multiColor,
  type ProbeMode,
  type ProbeOverride,
  type ProbeScale,
  type ProbeTone,
  type ProbesConfig
} from './probes-model';

export { PROBE_MODES, commonEntityPrefix, probeTone, probeValue, displayName as probeDisplayName, entityName as rawProbeName };
export type { ProbeMode, ProbeOverride, ProbeScale, ProbeTone };

export interface ProbeConfig {
  type: string;
  entity_prefix: string;
  entity: string;
  name_prefix: string;
  item: ProbeOverride;
  grid_options?: Record<string, unknown>;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuration objet attendue');
  return value as Record<string, unknown>;
}

export function normalizeProbeConfig(input: unknown): ProbeConfig {
  const raw = objectValue(input);
  const name_prefix = raw.name_prefix ?? '';
  if (typeof name_prefix !== 'string') throw new Error('name_prefix doit être un texte');
  const entity = raw.entity ?? '';
  if (typeof entity !== 'string') throw new Error('Entité invalide');
  const item = raw.item === undefined ? {} : probeOverride(raw.item);
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-probe-card',
    entity_prefix: normalizePrefix(raw.entity_prefix),
    entity,
    name_prefix,
    item,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function probeNamePrefix(config: ProbeConfig, states: Record<string, EntityState>): string {
  if (config.name_prefix) return config.name_prefix;
  const stem = config.entity_prefix ? `${config.entity_prefix}_` : '';
  const ids = Object.keys(states).filter(id => id.startsWith(`sensor.${stem}`));
  return commonEntityPrefix(ids, states);
}

function asProbes(config: ProbeConfig): ProbesConfig {
  return {
    type: config.type,
    title: '',
    entity_prefix: config.entity_prefix,
    entities: config.entity ? [config.entity] : [],
    name_prefix: config.name_prefix,
    columns: 1,
    items: config.entity ? { [config.entity]: config.item } : {}
  };
}

export function probeLabel(config: ProbeConfig, state: EntityState | undefined, prefix: string): string {
  if (config.item.name !== undefined) return config.item.name;
  return multiLabel(asProbes(config), config.entity, state, prefix);
}

export function probeMode(config: ProbeConfig): ProbeMode {
  return multiMode(asProbes(config), config.entity);
}

export function probeScale(config: ProbeConfig, state?: EntityState): ProbeScale | undefined {
  return multiScale(asProbes(config), config.entity, state);
}

export function resolveProbeColor(config: ProbeConfig, state?: EntityState): { tone: ProbeTone; custom: string } {
  return multiColor(asProbes(config), config.entity, state);
}
