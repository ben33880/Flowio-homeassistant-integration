import { expect, it } from 'vitest';
import type { Hass } from '../src/model';
import { normalizeTileGridConfig } from '../src/tile-grid';
import { commonEntityPrefix, commonNamePrefix, displayName, entityName } from '../src/names';
import { normalizeProbesConfig, probeDisplayName, probeIds, probeLabel, probeMode, probeScale, probeTone, probeValue, resolveProbeColor } from '../src/probes-model';
import { formatUptime, normalizeStatusConfig, statusBindings, statusValue } from '../src/status-model';
import { normalizeOverrideConfig, overrideAvailable, overrideForced, overrideRemainingMinutes } from '../src/override-model';
import { alarmEntries, alarmSummary, normalizeAlarmsConfig } from '../src/alarms-model';

const state = (value: string, attributes: Record<string, unknown> = {}) => ({ state: value, attributes });
const hass = (states: Record<string, ReturnType<typeof state>>): Hass => ({ states, callService: async () => undefined });

it('configure une grille de tuiles (nom, colonnes, entités, préfixe)', () => {
  const config = normalizeTileGridConfig({}, 'custom:test', 'Équipements');
  expect(config.title).toBe('Équipements');
  expect(config.columns).toBe(2);
  expect(config.entities).toEqual([]);
  expect(config.name_prefix).toBe('');
  const custom = normalizeTileGridConfig({ title: 'Relais', columns: 3, name_prefix: 'Flow.io Waveshare ', entities: ['switch.a', 'switch.a', 'switch.b'] }, 'custom:test', 'X');
  expect(custom.title).toBe('Relais');
  expect(custom.columns).toBe(3);
  expect(custom.name_prefix).toBe('Flow.io Waveshare ');
  expect(custom.entities).toEqual(['switch.a', 'switch.b']);
  for (const input of [{ columns: 0 }, { columns: 7 }, { columns: 1.5 }, { entities: 'switch.a' }, { entities: [''] }, { title: '' }, { name_prefix: 3 }, { grid_options: [] }]) {
    expect(() => normalizeTileGridConfig(input, 'custom:test', 'X')).toThrow();
  }
});

it('détecte le préfixe majoritaire malgré des noms hétérogènes', () => {
  const states = {
    'sensor.a': state('1', { friendly_name: 'Flow.io Waveshare Eau' }),
    'sensor.b': state('1', { friendly_name: 'Flow.io Waveshare Air' }),
    'sensor.c': state('1', { friendly_name: 'Adresse IP' }),
    'sensor.d': state('1', {})
  };
  expect(commonEntityPrefix(Object.keys(states), states)).toBe('Flow.io Waveshare ');
  expect(commonEntityPrefix(['sensor.a'], states)).toBe('');
  expect(commonEntityPrefix(['sensor.c', 'sensor.d'], states)).toBe('');
});

it('retire le préfixe de nom partagé', () => {
  expect(entityName('sensor.x', state('1', { friendly_name: 'Flow.io Waveshare pH' }))).toBe('Flow.io Waveshare pH');
  expect(entityName('sensor.x', state('1', {}))).toBe('sensor.x');
  expect(commonNamePrefix(['Flow.io Waveshare pH', 'Flow.io Waveshare ORP'])).toBe('Flow.io Waveshare ');
  expect(commonNamePrefix(['pH', 'ORP'])).toBe('');
  expect(displayName('Flow.io Waveshare pH', 'Flow.io Waveshare ')).toBe('pH');
  expect(displayName('Bidon', 'Flow.io Waveshare ')).toBe('Bidon');
});

it('configure la carte sondes', () => {
  const config = normalizeProbesConfig({});
  expect(config.title).toBe('Sondes');
  expect(config.entities).toEqual([]);
  expect(normalizeProbesConfig({ title: '' }).title).toBe('');
  expect(normalizeProbesConfig({ title: undefined }).title).toBe('');
  expect(normalizeProbesConfig({}).title).toBe('Sondes');
  expect(() => normalizeProbesConfig({ title: 3 })).toThrow();
  expect(() => normalizeProbesConfig({ scales: { 'sensor.x': { min: 5, max: 5 } } })).toThrow();
});

it('liste les sondes sélectionnées', () => {
  const config = normalizeProbesConfig({ entity_prefix: 'fio', entities: ['sensor.fio_io_ph', 'sensor.fio_io_ph', 'sensor.fio_data_112'] });
  expect(probeIds(config)).toEqual(['sensor.fio_io_ph', 'sensor.fio_data_112']);
});

it('configure colonnes et personnalisations par sonde', () => {
  const config = normalizeProbesConfig({ columns: 3, items: { 'sensor.a': { name: 'Eau', min: 0, max: 40, mode: 'gauge', color: '#123456' } } });
  expect(config.columns).toBe(3);
  expect(config.items['sensor.a']).toEqual({ name: 'Eau', min: 0, max: 40, mode: 'gauge', color: '#123456' });
  expect(probeLabel(config, 'sensor.a', undefined, '')).toBe('Eau');
  expect(probeMode(config, 'sensor.a')).toBe('gauge');
  expect(probeMode(config, 'sensor.b')).toBe('line');
  expect(probeScale(config, 'sensor.a')).toEqual({ min: 0, max: 40 });
  expect(normalizeProbesConfig({}).columns).toBe(2);
  for (const input of [{ columns: 0 }, { columns: 7 }, { items: { 'sensor.a': { mode: 'pie' } } }, { items: { 'sensor.a': { min: 10, max: 5 } } }, { items: { 'sensor.a': { name: 3 } } }]) {
    expect(() => normalizeProbesConfig(input)).toThrow();
  }
});

it('retire le préfixe d’équipement et choisit une couleur par sonde', () => {
  expect(commonNamePrefix(['Flow.io Waveshare pH', 'Flow.io Waveshare ORP'])).toBe('Flow.io Waveshare ');
  expect(commonNamePrefix(['pH', 'ORP'])).toBe('');
  expect(commonNamePrefix(['Eau'])).toBe('');
  expect(probeDisplayName('Flow.io Waveshare pH', 'Flow.io Waveshare ')).toBe('pH');
  expect(probeDisplayName('Bidon chlore', 'Flow.io Waveshare ')).toBe('Bidon chlore');
  expect(probeTone('sensor.fio_io_ph')).toBe('ph');
  expect(probeTone('sensor.fio_io_orp')).toBe('orp');
  expect(probeTone('sensor.fio_io_psi')).toBe('pressure');
  expect(probeTone('sensor.fio_io_air_tmp')).toBe('air');
  expect(probeTone('sensor.fio_io_wat_tmp')).toBe('water');
  expect(probeTone('sensor.fio_data_112', state('12', { unit_of_measurement: 'L' }))).toBe('water');
  const config = normalizeProbesConfig({ colors: { 'sensor.fio_io_ph': 'pressure', 'sensor.fio_io_orp': '#ff00aa' } });
  expect(resolveProbeColor(config, 'sensor.fio_io_ph')).toEqual({ tone: 'pressure', custom: '' });
  expect(resolveProbeColor(config, 'sensor.fio_io_orp')).toEqual({ tone: 'orp', custom: '#ff00aa' });
  expect(resolveProbeColor(config, 'sensor.fio_io_psi')).toEqual({ tone: 'pressure', custom: '' });
  expect(() => normalizeProbesConfig({ colors: { 'sensor.x': 3 } })).toThrow();
});

it('calcule les échelles et valeurs des sondes', () => {
  const config = normalizeProbesConfig({ scales: { 'sensor.fio_data_112': { min: 0, max: 50 } } });
  expect(probeScale(config, 'sensor.fio_data_112', state('12', {}))).toEqual({ min: 0, max: 50 });
  expect(probeScale(config, 'sensor.fio_data_130', state('82', { unit_of_measurement: '%' }))).toBeUndefined();
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2', {}))).toBeUndefined();
  expect(probeScale(config, 'sensor.fio_io_psi', state('0.9', { unit_of_measurement: 'bar' }))).toBeUndefined();
  expect(probeScale(config, 'sensor.fio_unknown', state('1', {}))).toBeUndefined();
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2', { min: '6.5', max: '8.2' }))).toEqual({ min: 6.5, max: 8.2 });
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2', { min: 6.5, max: 8.2 }))).toEqual({ min: 6.5, max: 8.2 });
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2', { min: 'abc', max: '8.2' }))).toBeUndefined();
  expect(probeScale(config, 'sensor.fio_io_ph', state('7.2', { min: 8, max: 6 }))).toBeUndefined();
  expect(probeValue(state('12.6', {}))).toBe(12.6);
  expect(probeValue(state('unavailable', {}))).toBeUndefined();
});

it('configure et formate la carte état système', () => {
  const config = normalizeStatusConfig({});
  expect(config.items).toEqual(['wifi_ip', 'sys_hp_free', 'sys_upt_mn']);
  expect(() => normalizeStatusConfig({ items: ['inconnu'] })).toThrow();
  expect(formatUptime(30)).toBe('30 min');
  expect(formatUptime(120)).toBe('2.0 h');
  expect(formatUptime(2880)).toBe('2.0 j');
  expect(statusValue('sys_upt_mn', state('90', {}))).toBe('1.5 h');
  const bindings = statusBindings('fio', ['wifi_ip', 'voltage']);
  expect(bindings[0].id).toBe('sensor.fio_wifi_ip');
  expect(bindings[1].id).toBe('sensor.fio_io_voltage');
});

it('configure la carte forçage et lit l’état', () => {
  const config = normalizeOverrideConfig({ device: 'Pompe pH', durations: [15, 5, 5] });
  expect(config.durations).toEqual([5, 15]);
  expect(() => normalizeOverrideConfig({ durations: [0] })).toThrow();
  const status = (attributes: Record<string, unknown>) => ({ 'sensor.fio_pdm_ovr_state': state('idle', attributes) });
  expect(overrideAvailable(hass(status({ override_available: true })), 'fio')).toBe(true);
  expect(overrideForced(hass(status({ control_mode: 'forced' })), 'fio')).toBe(true);
  expect(overrideForced(hass(status({ control_mode: 'guided' })), 'fio')).toBe(false);
  expect(overrideRemainingMinutes(hass(status({ override_remaining_s: 90 })), 'fio')).toBe(2);
});

it('résume les alarmes', () => {
  expect(normalizeAlarmsConfig({}).title).toBe('Alarmes');
  expect(normalizeAlarmsConfig({ name_prefix: 'Flow.io Waveshare ' }).name_prefix).toBe('Flow.io Waveshare ');
  const entries = alarmEntries(hass({
    'binary_sensor.fio_alm_3_active': state('off', { friendly_name: 'Pression haute' }),
    'binary_sensor.fio_alm_1_active': state('on', { friendly_name: 'Débit faible' }),
    'binary_sensor.fio_alm_any_active': state('on')
  }), 'fio');
  expect(entries.map(entry => entry.id)).toEqual(['1', '3']);
  expect(entries[0].resetEntity).toBe('button.fio_alm_1_reset');
  const summary = alarmSummary(hass({ 'binary_sensor.fio_alm_1_active': state('on') }), 'fio');
  expect(summary.tone).toBe('alert');
  expect(summary.active).toBe(1);
  expect(alarmSummary(hass({ 'binary_sensor.fio_alm_1_active': state('off') }), 'fio').tone).toBe('ok');
  expect(alarmSummary(hass({}), 'fio').tone).toBe('unknown');
});
