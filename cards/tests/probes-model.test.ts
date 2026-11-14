import { expect, it } from 'vitest';
import { normalizeProbesConfig, probeIds, probeLabel, probeMode, probeScale, probeValue, resolveProbeColor } from '../src/probes-model';
import type { EntityState } from '../src/model';
const state = (value: string, attributes: Record<string, unknown> = {}) => ({ state: value, attributes }) as unknown as EntityState;
it('applique les options de présentation sans préfixe local', () => {
  const config = normalizeProbesConfig({});
  expect(config).toEqual({ type: 'custom:flowio-probes-card', title: 'Sondes', entities: [], name_prefix: '', columns: 2, items: {} });
  expect(config).not.toHaveProperty('entity_prefix');
});
it('rejette les configurations invalides et les anciens préfixes', () => {
  for (const input of [{ title: 3 }, { name_prefix: 3 }, { columns: 0 }, { columns: 7 }, { entities: 'x' }, { entities: [''] }, { items: [] }, { grid_options: [] }, { entity_prefix: 'fio' }, { entity_prefix: '' }, { scales: [] }]) {
    expect(() => normalizeProbesConfig(input)).toThrow();
  }
});
it('lit les sondes et exclusivement leur échelle firmware', () => {
  const config = normalizeProbesConfig({ entities: ['sensor.fio_io_ph'], items: { 'sensor.fio_io_ph': { name: 'pH', color: 'ph', min: 6, max: 8, mode: 'gauge' } } });
  expect(probeIds(config)).toEqual(['sensor.fio_io_ph']);
  expect(config.items['sensor.fio_io_ph']).toEqual({ name: 'pH', color: 'ph', mode: 'gauge' });
  expect(probeLabel(config, 'sensor.fio_io_ph', state('7.2'), 'fio')).toBe('pH');
  expect(probeMode(config, 'sensor.fio_io_ph')).toBe('gauge');
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2', { min: 6.5, max: 8.2 }))).toEqual({ min: 6.5, max: 8.2 });
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2'))).toBeUndefined();
  expect(probeValue(state('7.2'))).toBe(7.2);
  expect(resolveProbeColor(config, 'sensor.fio_io_ph', state('7.2'))).toEqual({ tone: 'ph', custom: '' });
});
it('abandonne aussi les anciennes scales et ignore les overrides non normalisés', () => {
  const config = normalizeProbesConfig({ scales: { 'sensor.x': { min: 0, max: 50 } } });
  expect(config).not.toHaveProperty('scales');
  expect(config.items).toEqual({});
  config.items['sensor.x'] = { min: 0, max: 50 };
  expect(probeScale(config, 'sensor.x', state('12', { min: 5, max: 20 }))).toEqual({ min: 5, max: 20 });
  expect(probeScale(config, 'sensor.x', state('12'))).toBeUndefined();
});
it('détecte les tons Flow.io', () => {
  const config = normalizeProbesConfig({});
  expect(resolveProbeColor(config, 'sensor.fio_io_orp', state('700'))).toEqual({ tone: 'orp', custom: '' });
  expect(resolveProbeColor(config, 'sensor.fio_io_psi', state('1.2'))).toEqual({ tone: 'pressure', custom: '' });
  expect(resolveProbeColor(config, 'sensor.fio_io_wat_tmp', state('28'))).toEqual({ tone: 'water', custom: '' });
});
