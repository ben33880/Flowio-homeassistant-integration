import { expect, it } from 'vitest';
import {
  alarmConditionLabel,
  alarmDetailEntries,
  alarmId,
  alarmLatched,
  alarmNamePrefix,
  alarmPendingCount,
  alarmResetEntity,
  detectedAlarmIds,
  normalizeAlarmDetailConfig
} from '../src/alarm-detail-model';
import type { Hass } from '../src/model';

const state = (s: string, attributes: Record<string, unknown> = {}) => ({ state: s, attributes });

const hass = (states: Record<string, { state: string; attributes: Record<string, unknown> }>) =>
  ({ states, callService: async () => undefined }) as unknown as Hass;

it('applique les valeurs par défaut', () => {
  const config = normalizeAlarmDetailConfig({});
  expect(config.title).toBe('Gestion des alarmes');
  expect(config.entity_prefix).toBe('fio');
  expect(config.alarms).toEqual([]);
});

it('rejette les configurations invalides', () => {
  for (const input of [undefined, [], 'x', { title: '  ' }, { name_prefix: 3 }, { alarms: 'x' }, { alarms: [''] }, { grid_options: [] }]) {
    expect(() => normalizeAlarmDetailConfig(input)).toThrow();
  }
});

it('détecte les alarmes du préfixe et construit les identifiants', () => {
  const h = hass({ 'binary_sensor.fio_alm_1_active': state('on'), 'binary_sensor.fio_alm_10_active': state('off'), 'binary_sensor.autre_alm_2_active': state('on'), 'binary_sensor.fio_alm_any_active': state('off') });
  expect(detectedAlarmIds(h, 'fio')).toEqual(['binary_sensor.fio_alm_1_active', 'binary_sensor.fio_alm_10_active']);
  expect(alarmId('binary_sensor.fio_alm_7_active')).toBe('7');
  expect(alarmResetEntity('fio', 'binary_sensor.fio_alm_7_active')).toBe('button.fio_alm_7_reset');
});

it('détermine le latch d’une alarme', () => {
  expect(alarmLatched(state('off', { latch_enabled: true }))).toBe(true);
  expect(alarmLatched(state('off', { latch_enabled: false }))).toBe(false);
  expect(alarmLatched(state('off', { latch: true }))).toBe(true);
  expect(alarmLatched(state('off', { latch: 'non_utilise' }))).toBe(false);
  expect(alarmLatched(state('off'))).toBe(true);
  expect(alarmLatched(undefined)).toBe(true);
});

it('construit le détail et compte les alarmes à acquitter', () => {
  const h = hass({
    'binary_sensor.fio_alm_1_active': state('off', { friendly_name: 'Pression basse', condition: 'true', latch_enabled: true, resettable: true }),
    'binary_sensor.fio_alm_2_active': state('off', { friendly_name: 'Niveau bas', condition: 'false', latch_enabled: false, resettable: false }),
    'button.fio_alm_1_reset': state('unknown'),
    'button.fio_alm_2_reset': state('unavailable')
  });
  const config = normalizeAlarmDetailConfig({ alarms: ['binary_sensor.fio_alm_1_active', 'binary_sensor.fio_alm_2_active'] });
  const entries = alarmDetailEntries(h, config);
  expect(entries.map(entry => entry.name)).toEqual(['Pression basse', 'Niveau bas']);
  expect(entries[0]).toMatchObject({ id: '1', active: false, condition: true, latched: true, canReset: true });
  expect(entries[1]).toMatchObject({ id: '2', active: false, condition: false, latched: false, canReset: false });
  expect(alarmPendingCount(entries)).toBe(1);
});

it('formate la condition', () => {
  expect(alarmConditionLabel(state('on')).tone).toBe('active');
  expect(alarmConditionLabel(state('off'))).toEqual({ label: 'Inactive', tone: 'inactive' });
  expect(alarmConditionLabel(state('off', { condition: 'true' })).tone).toBe('active');
  expect(alarmConditionLabel(state('off', { condition: 'false' })).tone).toBe('inactive');
  expect(alarmConditionLabel(state('on', { condition: 'false' }))).toEqual({ label: 'Inactive', tone: 'latched' });
  expect(alarmConditionLabel(state('unavailable')).tone).toBe('unknown');
  expect(alarmConditionLabel(undefined).tone).toBe('unknown');
});

it('retire le préfixe commun seulement s’il est majoritaire', () => {
  const device = hass({
    'binary_sensor.fio_alm_1_active': state('off', { friendly_name: 'Flow.io Waveshare Pression' }),
    'binary_sensor.fio_alm_2_active': state('off', { friendly_name: 'Flow.io Waveshare Niveau' }),
    'binary_sensor.fio_alm_3_active': state('off', { friendly_name: 'Flow.io Waveshare Débit' })
  });
  expect(alarmNamePrefix(normalizeAlarmDetailConfig({}), device, ['binary_sensor.fio_alm_1_active', 'binary_sensor.fio_alm_2_active', 'binary_sensor.fio_alm_3_active'])).toBe('Flow.io Waveshare ');

  const coincidental = hass({
    'binary_sensor.fio_alm_1_active': state('off', { friendly_name: 'Low pressure' }),
    'binary_sensor.fio_alm_2_active': state('off', { friendly_name: 'pH tank low' }),
    'binary_sensor.fio_alm_3_active': state('off', { friendly_name: 'Chlorine tank low' }),
    'binary_sensor.fio_alm_4_active': state('off', { friendly_name: 'Chlorine pump uptime' })
  });
  expect(alarmNamePrefix(normalizeAlarmDetailConfig({}), coincidental, ['binary_sensor.fio_alm_1_active', 'binary_sensor.fio_alm_2_active', 'binary_sensor.fio_alm_3_active', 'binary_sensor.fio_alm_4_active'])).toBe('');
  expect(alarmNamePrefix(normalizeAlarmDetailConfig({ name_prefix: 'Chlorine ' }), coincidental, ['binary_sensor.fio_alm_3_active'])).toBe('Chlorine ');
});
