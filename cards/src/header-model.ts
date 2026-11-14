import { MEASUREMENTS, normalizePrefix, type Measurement } from './entities';
import { available, type Hass } from './model';
import { modeId } from './modes-model';

export type HeaderDesign = 'standard' | 'flowio';

export interface HeaderConfig {
  type: string;
  title: string;
  entity_prefix: string;
  measurements: Measurement[];
  status: boolean;
  design: HeaderDesign;
  grid_options?: Record<string, unknown>;
}

const DEFAULT_MEASUREMENTS: readonly Measurement[] = ['water_temperature', 'orp', 'air_temperature'];

const GAUGE_LABELS: Record<Measurement, string> = {
  water_temperature: 'Eau',
  air_temperature: 'Air',
  orp: 'ORP',
  ph: 'pH',
  pressure: 'Pression'
};

const GAUGE_UNITS: Record<Measurement, string> = {
  water_temperature: '°C',
  air_temperature: '°C',
  orp: 'mV',
  ph: '',
  pressure: ''
};

const TREATMENT_LABELS: Record<string, string> = {
  'Désactivé': 'Désactivé',
  'Chlore/Brome': 'Chlore / Brome',
  'Electrolyse': 'Électrolyse',
  'Oxygène actif': 'Oxygène actif'
};

export type StatusTone = 'ok' | 'alert' | 'unknown';

export interface PoolStatus {
  tone: StatusTone;
  label: string;
}

export function normalizeHeaderConfig(input: unknown): HeaderConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Configuration objet attendue');
  }
  const raw = input as Record<string, unknown>;
  const title = raw.title ?? 'État du bassin';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const status = raw.status ?? true;
  if (typeof status !== 'boolean') throw new Error('L’état doit être un booléen');
  const supplied = raw.measurements === undefined ? [...DEFAULT_MEASUREMENTS] : raw.measurements;
  if (!Array.isArray(supplied) ||
      supplied.some(value => typeof value !== 'string' || !(MEASUREMENTS as readonly string[]).includes(value))) {
    throw new Error('Choisir les mesures métier proposées');
  }
  const design = raw.design ?? 'standard';
  if (design !== 'standard' && design !== 'flowio') throw new Error('Design attendu : standard ou flowio');
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-header-card',
    title,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    measurements: [...new Set(supplied)] as Measurement[],
    status,
    design,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function gaugeLabel(role: Measurement): string {
  return GAUGE_LABELS[role];
}

export function gaugeUnit(role: Measurement, entityUnit: unknown): string {
  return typeof entityUnit === 'string' && entityUnit ? entityUnit : GAUGE_UNITS[role];
}

export function poolStatus(hass: Hass | undefined, prefix: string): PoolStatus {
  const stem = prefix ? `${prefix}_` : '';
  const count = hass?.states[`sensor.${stem}alm_active_count`];
  const global = hass?.states[`binary_sensor.${stem}alm_any_active`];
  const active = (available(count) && Number(count.state) > 0) || global?.state === 'on';
  if (active) return { tone: 'alert', label: 'Alarme en cours' };
  if (available(count) && Number(count.state) === 0 && global?.state !== 'on') {
    return { tone: 'ok', label: 'État normal' };
  }
  return { tone: 'unknown', label: 'État indisponible' };
}

export function statusDescription(hass: Hass | undefined, prefix: string): string {
  const parts: string[] = [];
  const filtration = hass?.states[modeId(prefix, 'filtration_auto')];
  if (filtration?.state === 'off') parts.push('Mode manuel : les automatismes sont suspendus.');
  else if (filtration?.state === 'on') parts.push('Filtration automatique active.');
  const treatment = hass?.states[modeId(prefix, 'disinfection_type')]?.state;
  if (treatment && TREATMENT_LABELS[treatment]) {
    parts.push(`Traitement configuré : ${TREATMENT_LABELS[treatment]}.`);
  }
  return parts.join(' ');
}
