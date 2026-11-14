import { expect, it } from 'vitest';
import { alarmEntries, alarmSummary, normalizeAlarmsConfig } from '../src/alarms-model';
import type { Hass } from '../src/model';
const hass = (states: Record<string, any>) => ({ states }) as unknown as Hass;
it('applique les options de présentation sans préfixe local', () => {
  const config = normalizeAlarmsConfig({});
  expect(config).toEqual({ type: 'custom:flowio-alarms-card', title: 'Alarmes', name_prefix: '' });
  expect(config).not.toHaveProperty('entity_prefix');
});
it('rejette les configurations invalides et les anciens préfixes', () => {
  for (const input of [undefined, [], 'x', { title: '' }, { name_prefix: 3 }, { grid_options: [] }, { entity_prefix: 'fio' }, { entity_prefix: '' }]) {
    expect(() => normalizeAlarmsConfig(input)).toThrow();
  }
});
it('détecte les alarmes avec le préfixe fourni', () => {
  const states = {
    'binary_sensor.fio_alm_1_active': { state: 'on', attributes: { friendly_name: 'Alarme pH' } },
    'binary_sensor.fio_alm_2_active': { state: 'off', attributes: {} },
    'binary_sensor.fio_alm_x_active': { state: 'on', attributes: {} }
  };
  const entries = alarmEntries(hass(states), 'fio');
  expect(entries.map(entry => entry.id)).toEqual(['1', '2']);
  expect(entries[0]).toEqual({ id: '1', entityId: 'binary_sensor.fio_alm_1_active', title: 'Alarme pH', resetEntity: 'button.fio_alm_1_reset', active: true });
  expect(entries[1].active).toBe(false);
  expect(alarmSummary(hass(states), 'fio')).toEqual({ total: 2, active: 1, tone: 'alert', label: '1 alarme active' });
});
it('utilise le compteur global si aucune alarme individuelle', () => {
  const states = { 'sensor.fio_alm_active_count': { state: '3', attributes: {} } };
  expect(alarmSummary(hass(states), 'fio')).toEqual({ total: 3, active: 0, tone: 'ok', label: 'Tout est normal' });
});
it('indique une surveillance indisponible', () => {
  expect(alarmSummary(hass({}), 'fio')).toEqual({ total: 0, active: 0, tone: 'unknown', label: 'Surveillance indisponible' });
});
