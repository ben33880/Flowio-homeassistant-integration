import { expect, it } from 'vitest';
import { alarmDetailEntries, alarmPendingCount, alarmResetEntity, detectedAlarmIds, normalizeAlarmDetailConfig } from '../src/alarm-detail-model';
import type { Hass } from '../src/model';
const hass = (states: Record<string, any>) => ({ states }) as unknown as Hass;
it('applique les options de présentation sans préfixe local', () => {
  const config = normalizeAlarmDetailConfig({});
  expect(config).toEqual({ type: 'custom:flowio-alarm-detail-card', title: 'Gestion des alarmes', name_prefix: '', alarms: [] });
  expect(config).not.toHaveProperty('entity_prefix');
});
it('rejette les configurations invalides et les anciens préfixes', () => {
  for (const input of [undefined, [], 'x', { title: '' }, { name_prefix: 3 }, { alarms: 'x' }, { alarms: [''] }, { grid_options: [] }, { entity_prefix: 'fio' }, { entity_prefix: '' }]) {
    expect(() => normalizeAlarmDetailConfig(input)).toThrow();
  }
});
it('détecte les alarmes avec le préfixe fourni', () => {
  const states = {
    'binary_sensor.fio_alm_1_active': { state: 'on', attributes: {} },
    'binary_sensor.fio_alm_2_active': { state: 'off', attributes: {} },
    'binary_sensor.fio_alm_x_active': { state: 'on', attributes: {} }
  };
  expect(detectedAlarmIds(hass(states), 'fio')).toEqual(['binary_sensor.fio_alm_1_active', 'binary_sensor.fio_alm_2_active']);
  expect(alarmResetEntity('fio', 'binary_sensor.fio_alm_1_active')).toBe('button.fio_alm_1_reset');
});
it('prépare les entrées avec le préfixe fourni', () => {
  const states = {
    'binary_sensor.fio_alm_1_active': { state: 'on', attributes: { friendly_name: 'Alarme pH', condition: 'true', latch: 'true', resettable: 'true' } },
    'button.fio_alm_1_reset': { state: 'on', attributes: {} }
  };
  const config = normalizeAlarmDetailConfig({});
  const entries = alarmDetailEntries(hass(states), config, 'fio');
  expect(entries[0]).toEqual({
    id: '1', entityId: 'binary_sensor.fio_alm_1_active', resetEntity: 'button.fio_alm_1_reset', name: 'Alarme pH',
    active: true, condition: true, present: true, latched: true, canReset: true
  });
  expect(alarmPendingCount(entries)).toBe(1);
});
it('utilise les alarmes choisies', () => {
  const states = {
    'binary_sensor.fio_alm_2_active': { state: 'off', attributes: {} },
    'button.fio_alm_2_reset': { state: 'on', attributes: {} }
  };
  const config = normalizeAlarmDetailConfig({ alarms: ['binary_sensor.fio_alm_2_active'] });
  const entries = alarmDetailEntries(hass(states), config, 'fio');
  expect(entries[0].id).toBe('2');
  expect(entries[0].active).toBe(false);
  expect(alarmPendingCount(entries)).toBe(1);
});
