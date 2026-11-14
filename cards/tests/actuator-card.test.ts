import { expect, it } from 'vitest';
import { actuatorGlobalReset, actuatorResetEntity, actuatorRole, formatRuntime, normalizeActuatorConfig, runtimeSecondsFor } from '../src/actuator-model';
it('ne conserve aucun préfixe local et rejette les anciennes options', () => {
  expect(normalizeActuatorConfig({})).toEqual({
    type: 'custom:flowio-actuator-card', title: 'Équipements du bassin', subtitle: 'Contrôle et suivi de consommation',
    name_prefix: '', entities: [], runtime_keys: { day: 'uptime_day_s', week: 'uptime_week_s', month: 'uptime_month_s', total: 'uptime_total_s' }, resets: {}
  });
  for (const input of [{ entity_prefix: 'fio' }, { entity_prefix: '' }, { title: '' }, { subtitle: 3 }, { entities: 'x' }, { runtime_keys: [] }, { resets: [] }, { grid_options: [] }]) {
    expect(() => normalizeActuatorConfig(input)).toThrow();
  }
});
it('identifie les rôles et les boutons de remise à zéro', () => {
  expect(actuatorRole('fio', 'switch.fio_io_flt_pmp')).toBe('filtration');
  expect(actuatorRole('fio', 'switch.fio_io_lights')).toBeUndefined();
  expect(actuatorGlobalReset('fio')).toBe('button.fio_pd_reset_upt_all');
  expect(actuatorResetEntity({ type: 'custom:flowio-actuator-card', title: '', subtitle: '', name_prefix: '', entities: [], runtime_keys: { day: 'day', week: 'week', month: 'month', total: 'total' }, resets: {} }, 'switch.fio_io_flt_pmp', 'fio')).toBe('button.fio_pd_reset_upt_flt');
  expect(actuatorResetEntity({ type: 'custom:flowio-actuator-card', title: '', subtitle: '', name_prefix: '', entities: [], runtime_keys: { day: 'day', week: 'week', month: 'month', total: 'total' }, resets: { 'switch.fio_io_lights': 'button.custom_reset' } }, 'switch.fio_io_lights', 'fio')).toBe('button.custom_reset');
});
it('lit les durées dans les attributs', () => {
  const state = { state: 'on', attributes: { uptime_day_s: 3600, uptime_week_s: '7200' } };
  const config = normalizeActuatorConfig({});
  expect(runtimeSecondsFor(state, config, 'day')).toBe(3600);
  expect(runtimeSecondsFor(state, config, 'week')).toBe(7200);
  expect(runtimeSecondsFor(state, config, 'month')).toBeUndefined();
  expect(formatRuntime(3600)).toBe('01:00:00');
  expect(formatRuntime(undefined)).toBe('—');
});
