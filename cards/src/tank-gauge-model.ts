import { currentThresholds, type Installation, type SharedState } from './integration-config';

export function tankGaugeTone(
  value: number | undefined,
  installation: Installation | undefined,
  states: Record<string, SharedState>
): 'good' | 'bad' | undefined {
  if (!installation || value === undefined || !Number.isFinite(value) || value < 0 || value > 100) return undefined;
  const threshold = currentThresholds(installation, states).tank_min;
  if (threshold === undefined || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) return undefined;
  return value < threshold ? 'bad' : 'good';
}
