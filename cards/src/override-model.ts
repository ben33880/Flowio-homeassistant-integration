import { normalizePrefix } from './entities';
import { overrideEntityIds, overrideOptions } from './firmware-model';
import { available, type Hass } from './model';

export const DEFAULT_DURATIONS = [5, 15, 30, 60] as const;

export interface OverrideConfig {
  type: string;
  title: string;
  entity_prefix: string;
  device: string;
  durations: number[];
  grid_options?: Record<string, unknown>;
}

export function normalizeOverrideConfig(input: unknown): OverrideConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration objet attendue');
  const raw = input as Record<string, unknown>;
  const title = raw.title ?? 'Forçage temporaire';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const device = raw.device ?? '';
  if (typeof device !== 'string') throw new Error('Équipement invalide');
  const supplied = raw.durations === undefined ? [...DEFAULT_DURATIONS] : raw.durations;
  if (!Array.isArray(supplied) || supplied.some(value => typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 1440)) {
    throw new Error('Durées attendues en minutes entières entre 1 et 1440');
  }
  const durations = [...new Set(supplied as number[])].sort((a, b) => a - b);
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-override-card',
    title,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    device,
    durations,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function overrideDevices(hass: Hass | undefined, prefix: string): string[] {
  return overrideOptions(hass, prefix);
}

export function overrideAvailable(hass: Hass | undefined, prefix: string): boolean {
  return hass?.states[overrideEntityIds(prefix).state]?.attributes.override_available === true;
}

export function overrideForced(hass: Hass | undefined, prefix: string): boolean {
  const status = hass?.states[overrideEntityIds(prefix).state];
  return !!status && available(status) && status.attributes.control_mode !== 'guided';
}

export function overrideRemainingMinutes(hass: Hass | undefined, prefix: string): number | undefined {
  const seconds = Number(hass?.states[overrideEntityIds(prefix).state]?.attributes.override_remaining_s);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : undefined;
}

export function overrideTargetEntity(hass: Hass | undefined, prefix: string): string {
  return overrideEntityIds(prefix).target;
}

export function equipmentForced(hass: Hass | undefined, id: string): boolean {
  const value = hass?.states[id]?.attributes.forced;
  return value === true || value === 'true';
}

const FORCED_LABELS: Record<string, string> = {
  fr: 'Forcé',
  en: 'Forced',
  de: 'Erzwungen',
  es: 'Forzado',
  it: 'Forzato',
  nl: 'Geforceerd',
  pt: 'Forçado',
  pl: 'Wymuszone',
  ru: 'Принудительно',
  uk: 'Примусово'
};

export function forcedLabel(hass?: Hass): string {
  const source = hass as (Hass & { language?: string; locale?: { language?: string } }) | undefined;
  const language = source?.locale?.language ?? source?.language ?? 'en';
  const key = language.slice(0, 2).toLowerCase();
  return FORCED_LABELS[key] ?? FORCED_LABELS.en;
}
