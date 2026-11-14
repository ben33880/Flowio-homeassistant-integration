import { expect, it } from 'vitest';
import {
  actuatorActiveCount,
  actuatorGlobalReset,
  actuatorResetEntity,
  actuatorRole,
  formatRuntime,
  normalizeActuatorConfig,
  runtimeSeconds,
  runtimeSecondsFor
} from '../src/actuator-model';
import type { Hass } from '../src/model';

const state = (attributes: Record<string, unknown>) => ({ state: 'on', attributes });

it('applique les valeurs par défaut', () => {
  const config = normalizeActuatorConfig({});
  expect(config.title).toBe('Équipements du bassin');
  expect(config.subtitle).toBe('Contrôle et suivi de consommation');
  expect(config.entity_prefix).toBe('fio');
  expect(config.entities).toEqual([]);
  expect(config.runtime_keys).toEqual({ day: 'uptime_day_s', week: 'uptime_week_s', month: 'uptime_month_s', total: 'uptime_total_s' });
  expect(config.resets).toEqual({});
});

it('accepte les clés d’attributs et les remises à zéro personnalisées', () => {
  const config = normalizeActuatorConfig({
    entities: ['switch.a', 'switch.a'],
    runtime_keys: { day: 'upt_day' },
    resets: { 'switch.a': 'button.reset_a' }
  });
  expect(config.entities).toEqual(['switch.a']);
  expect(config.runtime_keys.day).toBe('upt_day');
  expect(config.runtime_keys.week).toBe('uptime_week_s');
  expect(config.resets).toEqual({ 'switch.a': 'button.reset_a' });
});

it('rejette les configurations invalides', () => {
  for (const input of [undefined, [], 'x', { title: '  ' }, { subtitle: 3 }, { entities: 'switch.a' }, { entities: [''] }, { runtime_keys: { day: '' } }, { runtime_keys: 3 }, { resets: { a: 3 } }, { resets: [] }, { grid_options: [] }]) {
    expect(() => normalizeActuatorConfig(input)).toThrow();
  }
});

it('résout le rôle et l’entité de remise à zéro', () => {
  expect(actuatorRole('fio', 'switch.fio_io_flt_pmp')).toBe('filtration');
  expect(actuatorRole('fio', 'switch.fio_inconnu')).toBeUndefined();
  const config = normalizeActuatorConfig({ entity_prefix: 'fio', resets: { 'switch.fio_io_robot': 'button.fio_pd_reset_upt_robot' } });
  expect(actuatorResetEntity(config, 'switch.fio_io_flt_pmp')).toBe('button.fio_pd_reset_upt_flt');
  expect(actuatorResetEntity(config, 'switch.fio_io_ph_pmp')).toBe('button.fio_pd_reset_upt_ph');
  expect(actuatorResetEntity(config, 'switch.fio_io_robot')).toBe('button.fio_pd_reset_upt_robot');
  expect(actuatorResetEntity(config, 'switch.fio_inconnu')).toBeUndefined();
  expect(actuatorGlobalReset(config)).toBe('button.fio_pd_reset_upt_all');
});

it('lit et formate les durées de fonctionnement', () => {
  expect(runtimeSeconds(state({ runtime_day: 1184 }), 'runtime_day')).toBe(1184);
  expect(runtimeSeconds(state({ runtime_day: '59' }), 'runtime_day')).toBe(59);
  expect(runtimeSeconds(state({ runtime_day: -1 }), 'runtime_day')).toBeUndefined();
  expect(runtimeSeconds(state({ runtime_day: 'abc' }), 'runtime_day')).toBeUndefined();
  expect(runtimeSeconds(state({}), 'runtime_day')).toBeUndefined();
  expect(runtimeSeconds(undefined, 'runtime_day')).toBeUndefined();
  expect(formatRuntime(undefined)).toBe('—');
  expect(formatRuntime(0)).toBe('00:00:00');
  expect(formatRuntime(59)).toBe('00:00:59');
  expect(formatRuntime(1184)).toBe('00:19:44');
  expect(formatRuntime(1168368)).toBe('324:32:48');
});

it('tolère les anciens noms de clés de durée', () => {
  const s = state({ uptime_day_s: 2948, uptime_week_s: 2948, uptime_month_s: 2948, uptime_total_s: 1170133 });
  expect(runtimeSecondsFor(s, normalizeActuatorConfig({}), 'day')).toBe(2948);
  expect(runtimeSecondsFor(s, normalizeActuatorConfig({}), 'total')).toBe(1170133);
  const legacy = normalizeActuatorConfig({ runtime_keys: { day: 'runtime_day', week: 'runtime_week', month: 'runtime_month', total: 'runtime_total' } });
  expect(runtimeSecondsFor(s, legacy, 'day')).toBe(2948);
  expect(runtimeSecondsFor(s, legacy, 'week')).toBe(2948);
  expect(runtimeSecondsFor(s, legacy, 'month')).toBe(2948);
  expect(runtimeSecondsFor(s, legacy, 'total')).toBe(1170133);
});

it('compte les actionneurs actifs', () => {
  const hass = {
    states: { 'switch.a': { state: 'on', attributes: {} }, 'switch.b': { state: 'off', attributes: {} }, 'switch.c': { state: 'on', attributes: {} } },
    callService: async () => undefined
  } as unknown as Hass;
  expect(actuatorActiveCount(hass, ['switch.a', 'switch.b', 'switch.c'])).toBe(2);
  expect(actuatorActiveCount(undefined, ['switch.a'])).toBe(0);
});
