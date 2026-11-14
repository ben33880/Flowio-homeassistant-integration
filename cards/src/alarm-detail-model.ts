import { normalizePrefix } from './entities';
import { commonEntityPrefix, entityName } from './names';
import { available, type EntityState, type Hass } from './model';

export interface AlarmDetailConfig {
  type: string;
  title: string;
  entity_prefix: string;
  name_prefix: string;
  alarms: string[];
  grid_options?: Record<string, unknown>;
}

export interface AlarmDetail {
  id: string;
  entityId: string;
  resetEntity: string;
  name: string;
  active: boolean;
  condition: boolean;
  present: boolean;
  latched: boolean;
  canReset: boolean;
}

const LATCHED_VALUES = ['true', '1', 'libre', 'free', 'latched', 'enabled', 'on'];
const AUTO_VALUES = ['false', '0', 'non_utilise', 'non utilisé', 'auto', 'automatic', 'disabled', 'off'];

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuration objet attendue');
  return value as Record<string, unknown>;
}

export function normalizeAlarmDetailConfig(input: unknown): AlarmDetailConfig {
  const raw = objectValue(input);
  const title = raw.title ?? 'Gestion des alarmes';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const name_prefix = raw.name_prefix ?? '';
  if (typeof name_prefix !== 'string') throw new Error('name_prefix doit être un texte');
  const supplied = raw.alarms === undefined ? [] : raw.alarms;
  if (!Array.isArray(supplied) || supplied.some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('Liste d’alarmes invalide');
  }
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-alarm-detail-card',
    title,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    name_prefix,
    alarms: [...new Set(supplied)] as string[],
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function alarmStem(prefix: string): string {
  return prefix ? `${prefix}_` : '';
}

export function detectedAlarmIds(hass: Hass | undefined, prefix: string): string[] {
  const start = `binary_sensor.${alarmStem(prefix)}alm_`;
  return Object.keys(hass?.states ?? {})
    .filter(id => id.startsWith(start) && id.endsWith('_active') && /^[0-9]+$/.test(id.slice(start.length, -7)))
    .sort((a, b) => Number(alarmId(a)) - Number(alarmId(b)));
}

export function alarmId(entityId: string): string {
  const match = /_alm_([0-9]+)_active$/.exec(entityId);
  return match ? match[1] : entityId;
}

export function alarmResetEntity(prefix: string, entityId: string): string {
  return `button.${alarmStem(prefix)}alm_${alarmId(entityId)}_reset`;
}

function booleanAttr(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (['true', 'on', '1', 'yes'].includes(key)) return true;
    if (['false', 'off', '0', 'no'].includes(key)) return false;
  }
  return undefined;
}

export function alarmCondition(state: EntityState | undefined): boolean {
  const condition = booleanAttr(state?.attributes.condition);
  if (condition !== undefined) return condition;
  return state?.state === 'on';
}

export function alarmLatched(state: EntityState | undefined): boolean {
  const enabled = booleanAttr(state?.attributes.latch_enabled);
  if (enabled !== undefined) return enabled;
  const value = state?.attributes.latch;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (LATCHED_VALUES.includes(key)) return true;
    if (AUTO_VALUES.includes(key)) return false;
  }
  return true;
}

export function alarmResettable(state: EntityState | undefined): boolean | undefined {
  return booleanAttr(state?.attributes.resettable);
}

export function alarmDetailEntries(hass: Hass | undefined, config: AlarmDetailConfig): AlarmDetail[] {
  const prefix = config.entity_prefix;
  const ids = config.alarms.length ? config.alarms : detectedAlarmIds(hass, prefix);
  return ids.map(entityId => {
    const state = hass?.states[entityId];
    const resetEntity = alarmResetEntity(prefix, entityId);
    const resetState = hass?.states[resetEntity];
    const resettable = alarmResettable(state);
    const name = typeof state?.attributes.friendly_name === 'string' && state.attributes.friendly_name
      ? state.attributes.friendly_name
      : `Alarme ${alarmId(entityId)}`;
    return {
      id: alarmId(entityId),
      entityId,
      resetEntity,
      name,
      active: state?.state === 'on',
      condition: alarmCondition(state),
      present: !!state,
      latched: alarmLatched(state),
      canReset: resettable ?? (!!resetState && !['unavailable', ''].includes(resetState.state))
    };
  });
}

export function alarmPendingCount(entries: readonly AlarmDetail[]): number {
  return entries.filter(entry => entry.latched && entry.canReset).length;
}

export function alarmConditionLabel(state: EntityState | undefined): { label: string; tone: 'active' | 'latched' | 'inactive' | 'unknown' } {
  if (!state) return { label: 'Absente', tone: 'unknown' };
  if (!available(state)) return { label: 'Indisponible', tone: 'unknown' };
  const condition = alarmCondition(state);
  const active = state.state === 'on';
  return { label: condition ? 'Active' : 'Inactive', tone: condition ? 'active' : active ? 'latched' : 'inactive' };
}

export function alarmNamePrefix(config: AlarmDetailConfig, hass: Hass | undefined, ids: readonly string[]): string {
  if (config.name_prefix) return config.name_prefix;
  const list = [...ids];
  const detected = commonEntityPrefix(list, hass?.states);
  if (!detected) return '';
  const names = list.map(id => entityName(id, hass?.states[id])).filter((name): name is string => !!name);
  const matching = names.filter(name => name.startsWith(detected)).length;
  return names.length && matching > names.length / 2 ? detected : '';
}
