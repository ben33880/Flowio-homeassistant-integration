import { expect, it } from 'vitest';
import { normalizeProbeConfig, probeLabel, probeMode, probeNamePrefix, probeScale, resolveProbeColor } from '../src/probe-model';
import type { EntityState } from '../src/model';
const state = (value: string, attributes: Record<string, unknown> = {}) => ({ state: value, attributes }) as unknown as EntityState;
it('normalise une sonde sans préfixe local', () => {
  const config = normalizeProbeConfig({ entity: 'sensor.fio_io_ph', item: { name: 'pH', color: 'ph', min: 6, max: 8, mode: 'gauge' } });
  expect(config).toEqual({ type: 'custom:flowio-probe-card', entity: 'sensor.fio_io_ph', name_prefix: '', item: { name: 'pH', color: 'ph', min: 6, max: 8, mode: 'gauge' } });
  expect(config).not.toHaveProperty('entity_prefix');
});
it('rejette les configurations invalides et les anciens préfixes', () => {
  for (const input of [{ name_prefix: 3 }, { entity: 3 }, { item: [] }, { grid_options: [] }, { entity_prefix: 'fio' }, { entity_prefix: '' }]) {
    expect(() => normalizeProbeConfig(input)).toThrow();
  }
});
it('lit une sonde avec le préfixe fourni', () => {
  const config = normalizeProbeConfig({ entity: 'sensor.fio_io_ph', item: { name: 'pH', color: 'ph', min: 6, max: 8, mode: 'gauge' } });
  expect(probeNamePrefix(config, {})).toBe('');
  expect(probeLabel(config, state('7.2'), 'fio')).toBe('pH');
  expect(probeMode(config)).toBe('gauge');
  expect(probeScale(config, state('7.2'))).toEqual({ min: 6, max: 8 });
  expect(resolveProbeColor(config, state('7.2'))).toEqual({ tone: 'ph', custom: '' });
});
