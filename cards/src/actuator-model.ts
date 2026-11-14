import { DEFINITIONS, entityId, normalizePrefix, type Role } from './entities';
import { operationEntityId, type Operation } from './firmware-model';
import type { EntityState, Hass } from './model';

export interface ActuatorRuntimeKeys {
  day: string;
  week: string;
  month: string;
  total: string;
}

export interface ActuatorConfig {
  type: string;
  title: string;
  subtitle: string;
  entity_prefix: string;
  name_prefix: string;
  entities: string[];
  runtime_keys: ActuatorRuntimeKeys;
  resets: Record<string, string>;
  grid_options?: Record<string, unknown>;
}

export const RUNTIME_PERIODS = ['day', 'week', 'month', 'total'] as const;
export type RuntimePeriod = typeof RUNTIME_PERIODS[number];

export const RUNTIME_LABELS: Record<RuntimePeriod, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  total: 'Total'
};

const DEFAULT_RUNTIME_KEYS: ActuatorRuntimeKeys = {
  day: 'uptime_day_s',
  week: 'uptime_week_s',
  month: 'uptime_month_s',
  total: 'uptime_total_s'
};

const RUNTIME_FALLBACKS: Record<RuntimePeriod, string[]> = {
  day: ['uptime_day_s', 'runtime_day', 'upt_day', 'day'],
  week: ['uptime_week_s', 'runtime_week', 'upt_week', 'week'],
  month: ['uptime_month_s', 'runtime_month', 'upt_month', 'month'],
  total: ['uptime_total_s', 'runtime_total', 'upt_total', 'total']
};

const RESET_OPERATIONS: Partial<Record<Role, Operation>> = {
  filtration: 'reset_filtration',
  ph_pump: 'reset_ph',
  disinfection_pump: 'reset_disinfection',
  electrolyzer: 'reset_electrolyzer',
  filling: 'reset_filling'
};

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuration objet attendue');
  return value as Record<string, unknown>;
}

export function normalizeActuatorConfig(input: unknown): ActuatorConfig {
  const raw = objectValue(input);
  const title = raw.title ?? 'Équipements du bassin';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const subtitle = raw.subtitle ?? 'Contrôle et suivi de consommation';
  if (typeof subtitle !== 'string') throw new Error('Sous-titre invalide');
  const name_prefix = raw.name_prefix ?? '';
  if (typeof name_prefix !== 'string') throw new Error('name_prefix doit être un texte');
  const supplied = raw.entities === undefined ? [] : raw.entities;
  if (!Array.isArray(supplied) || supplied.some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('Liste d’entités invalide');
  }
  const keysRaw = raw.runtime_keys === undefined ? {} : objectValue(raw.runtime_keys);
  const runtime_keys = { ...DEFAULT_RUNTIME_KEYS };
  for (const period of RUNTIME_PERIODS) {
    const value = keysRaw[period];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim()) throw new Error('Clé d’attribut de durée invalide');
    runtime_keys[period] = value.trim();
  }
  const resets: Record<string, string> = {};
  if (raw.resets !== undefined) {
    for (const [id, value] of Object.entries(objectValue(raw.resets))) {
      if (typeof value !== 'string' || !value.trim()) throw new Error('resets : entité attendue');
      resets[id] = value;
    }
  }
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-actuator-card',
    title,
    subtitle,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    name_prefix,
    entities: [...new Set(supplied)] as string[],
    runtime_keys,
    resets,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function actuatorRole(prefix: string, id: string): Role | undefined {
  for (const role of Object.keys(DEFINITIONS) as Array<keyof typeof DEFINITIONS>) {
    if (DEFINITIONS[role][0] !== 'switch') continue;
    if (entityId(prefix, role) === id) return role;
  }
  return undefined;
}

export function actuatorResetEntity(config: ActuatorConfig, id: string): string | undefined {
  if (config.resets[id]) return config.resets[id];
  const role = actuatorRole(config.entity_prefix, id);
  const operation = role ? RESET_OPERATIONS[role] : undefined;
  return operation ? operationEntityId(config.entity_prefix, operation) : undefined;
}

export function actuatorGlobalReset(config: ActuatorConfig): string {
  return operationEntityId(config.entity_prefix, 'reset_all');
}

export function runtimeSeconds(state: EntityState | undefined, key: string): number | undefined {
  const value = state?.attributes[key];
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  return undefined;
}

export function runtimeSecondsFor(state: EntityState | undefined, config: ActuatorConfig, period: RuntimePeriod): number | undefined {
  const keys = [...new Set([config.runtime_keys[period], ...RUNTIME_FALLBACKS[period]])];
  for (const key of keys) {
    const value = runtimeSeconds(state, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function formatRuntime(seconds: number | undefined): string {
  if (seconds === undefined) return '—';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function actuatorActiveCount(hass: Hass | undefined, entities: readonly string[]): number {
  return entities.filter(id => hass?.states[id]?.state === 'on').length;
}
