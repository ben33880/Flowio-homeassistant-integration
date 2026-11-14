import { normalizePrefix } from './entities';
import { available, type Hass } from './model';

export interface AlarmsConfig {
  type: string;
  title: string;
  entity_prefix: string;
  name_prefix: string;
  grid_options?: Record<string, unknown>;
}

export interface AlarmEntry {
  id: string;
  entityId: string;
  title: string;
  resetEntity: string;
  active: boolean;
}

export interface AlarmSummary {
  total: number;
  active: number;
  tone: 'ok' | 'alert' | 'unknown';
  label: string;
}

export function normalizeAlarmsConfig(input: unknown): AlarmsConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration objet attendue');
  const raw = input as Record<string, unknown>;
  const title = raw.title ?? 'Alarmes';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const name_prefix = raw.name_prefix ?? '';
  if (typeof name_prefix !== 'string') throw new Error('name_prefix doit être un texte');
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-alarms-card',
    title,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    name_prefix,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function alarmEntries(hass: Hass | undefined, prefix: string): AlarmEntry[] {
  const stem = prefix ? `${prefix}_` : '';
  const start = `binary_sensor.${stem}alm_`;
  return Object.entries(hass?.states ?? {}).flatMap(([entityId, state]) => {
    if (!entityId.startsWith(start) || !entityId.endsWith('_active')) return [];
    const id = entityId.slice(start.length, -7);
    if (!/^[0-9]+$/.test(id)) return [];
    const title = typeof state.attributes.friendly_name === 'string' ? state.attributes.friendly_name : `Alarme #${id}`;
    return [{ id, entityId, title, resetEntity: `button.${stem}alm_${id}_reset`, active: state.state === 'on' }];
  }).sort((a, b) => Number(a.id) - Number(b.id));
}

export function alarmSummary(hass: Hass | undefined, prefix: string): AlarmSummary {
  const entries = alarmEntries(hass, prefix);
  const active = entries.filter(entry => entry.active).length;
  const countState = hass?.states[`sensor.${prefix ? `${prefix}_` : ''}alm_active_count`];
  if (!entries.length && !countState) return { total: 0, active: 0, tone: 'unknown', label: 'Surveillance indisponible' };
  const total = entries.length || (available(countState) ? Number(countState.state) || 0 : 0);
  if (active > 0) return { total, active, tone: 'alert', label: `${active} alarme${active > 1 ? 's' : ''} active${active > 1 ? 's' : ''}` };
  return { total, active: 0, tone: 'ok', label: 'Tout est normal' };
}
