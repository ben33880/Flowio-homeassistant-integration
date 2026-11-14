import { attributeScale } from './gauge-model';
import { currentThresholds, type Installation, type SharedState } from './integration-config';

export type GaugeTone = 'good' | 'medium' | 'bad';
export interface GaugeZone { from: number; to: number; tone: GaugeTone; }
export interface GaugeSettings {
  scale?: { min: number; max: number };
  zones: GaugeZone[];
  tone?: GaugeTone;
}

export function gaugeSettings(
  attributes: Record<string, unknown> | undefined,
  role: string,
  value: number | undefined,
  installation: Installation | undefined,
  states: Record<string, SharedState>
): GaugeSettings {
  const scale = attributeScale(attributes);
  const result: GaugeSettings = { scale, zones: [] };
  if (!scale || !installation || !['ph', 'orp'].includes(role)) return result;
  const thresholds = currentThresholds(installation, states);
  const goodMin = thresholds[`${role}_good_min`];
  const goodMax = thresholds[`${role}_good_max`];
  const midMin = thresholds[`${role}_mid_min`];
  const midMax = thresholds[`${role}_mid_max`];
  if ([goodMin, goodMax, midMin, midMax].some(n => typeof n !== 'number' || !Number.isFinite(n))) return result;
  const lo = midMin!, hi = midMax!, goodLo = goodMin!, goodHi = goodMax!;
  if (!(lo <= goodLo && goodLo < goodHi && goodHi <= hi)) return result;
  const toneAt = (n: number): GaugeTone => n >= goodLo && n <= goodHi
    ? 'good' : n >= lo && n <= hi ? 'medium' : 'bad';
  const points = [...new Set([scale.min, scale.max, lo, goodLo, goodHi, hi]
    .filter(n => n >= scale.min && n <= scale.max))].sort((a, b) => a - b);
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i], to = points[i + 1];
    result.zones.push({ from, to, tone: toneAt(from + (to - from) / 2) });
  }
  if (value !== undefined && Number.isFinite(value)) result.tone = toneAt(value);
  return result;
}
