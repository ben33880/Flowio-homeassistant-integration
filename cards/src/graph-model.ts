import { normalizePrefix } from './entities';

export const GRAPH_TYPES = ['line', 'bar'] as const;
export type GraphType = typeof GRAPH_TYPES[number];

export const GRAPH_PALETTE = ['#0288d1', '#ffa000', '#8e24aa', '#00acc1', '#f4511e', '#43a047', '#d81b60', '#5e35b1', '#546e7a', '#7cb342', '#e53935', '#26a69a', '#9e9e9e', '#5c6bc0'];

export const SHADE_PALETTE = ['#dbeafe', '#dcfce7', '#fef9c3', '#fae8ff', '#cffafe', '#ffe4e6', '#ede9fe', '#e2e8f0'];

export interface GraphConfig {
  type: string;
  title: string;
  entity_prefix: string;
  name_prefix: string;
  entities: string[];
  colors: Record<string, string>;
  shades: Record<string, string>;
  hours_to_show: number;
  chart_type: GraphType;
  show_stats: boolean;
  grid_options?: Record<string, unknown>;
}

export function normalizeGraphConfig(input: unknown): GraphConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration objet attendue');
  const raw = input as Record<string, unknown>;
  const title = raw.title ?? 'Graphique';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const hours = raw.hours_to_show ?? 12;
  if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 168) {
    throw new Error('Durée entière attendue entre 1 et 168 heures');
  }
  const chart_type = raw.chart_type ?? 'line';
  if (chart_type !== 'line' && chart_type !== 'bar') throw new Error('Type de graphique attendu : line ou bar');
  const show_stats = raw.show_stats ?? true;
  if (typeof show_stats !== 'boolean') throw new Error('L’affichage des statistiques doit être un booléen');
  const name_prefix = raw.name_prefix ?? '';
  if (typeof name_prefix !== 'string') throw new Error('name_prefix doit être un texte');
  const supplied = raw.entities === undefined ? [] : raw.entities;
  if (!Array.isArray(supplied) || supplied.some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('Liste d’entités invalide');
  }
  const colors: Record<string, string> = {};
  if (raw.colors !== undefined) {
    if (!raw.colors || typeof raw.colors !== 'object' || Array.isArray(raw.colors)) throw new Error('colors doit être un objet');
    for (const [id, value] of Object.entries(raw.colors as Record<string, unknown>)) {
      if (typeof value !== 'string') throw new Error('colors : valeur texte attendue');
      colors[id] = value;
    }
  }
  const shades: Record<string, string> = {};
  if (raw.shades !== undefined) {
    if (!raw.shades || typeof raw.shades !== 'object' || Array.isArray(raw.shades)) throw new Error('shades doit être un objet');
    for (const [id, value] of Object.entries(raw.shades as Record<string, unknown>)) {
      if (typeof value !== 'string') throw new Error('shades : valeur texte attendue');
      shades[id] = value;
    }
  }
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-graph-card',
    title,
    entity_prefix: normalizePrefix(raw.entity_prefix),
    name_prefix,
    entities: [...new Set(supplied)] as string[],
    colors,
    shades,
    hours_to_show: hours,
    chart_type,
    show_stats,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function defaultSeriesColor(index: number): string {
  return GRAPH_PALETTE[index % GRAPH_PALETTE.length];
}

export function seriesColor(config: GraphConfig, id: string, index: number): string {
  return config.colors[id] || defaultSeriesColor(index);
}

export function defaultShadeColor(index: number): string {
  return SHADE_PALETTE[index % SHADE_PALETTE.length];
}

export function shadeColor(config: GraphConfig, id: string, index: number): string {
  return config.shades[id] || defaultShadeColor(index);
}
