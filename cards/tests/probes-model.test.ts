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
  for (const input of [{ title: 3 }, { name_prefix: 3 }, { columns: 0 }, { columns: 7 }, { entities: 'x' }, { entities: [''] }, { items: [] }, { grid_options: [] }, { entity_prefix: 'fio' }, { entity_prefix: '' }]) {
    expect(() => normalizeProbesConfig(input)).toThrow();
  }
});
it('lit les sondes avec le préfixe fourni', () => {
  const config = normalizeProbesConfig({ entities: ['sensor.fio_io_ph'], items: { 'sensor.fio_io_ph': { name: 'pH', color: 'ph', min: 6, max: 8, mode: 'gauge' } } });
  expect(probeIds(config)).toEqual(['sensor.fio_io_ph']);
  expect(probeLabel(config, 'sensor.fio_io_ph', state('7.2'), 'fio')).toBe('pH');
  expect(probeMode(config, 'sensor.fio_io_ph')).toBe('gauge');
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2'))).toEqual({ min: 6, max: 8 });
  expect(probeValue(state('7.2'))).toBe(7.2);
  expect(resolveProbeColor(config, 'sensor.fio_io_ph', state('7.2'))).toEqual({ tone: 'ph', custom: '' });
});
it('détecte les tons Flow.io', () => {
  const config = normalizeProbesConfig({});
  expect(resolveProbeColor(config, 'sensor.fio_io_orp', state('700'))).toEqual({ tone: 'orp', custom: '' });
  expect(resolveProbeColor(config, 'sensor.fio_io_psi', state('1.2'))).toEqual({ tone: 'pressure', custom: '' });
  expect(resolveProbeColor(config, 'sensor.fio_io_wat_tmp', state('28'))).toEqual({ tone: 'water', custom: '' });
});
