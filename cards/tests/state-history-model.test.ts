import { expect, it } from 'vitest';
import {
  clockTime,
  formatDuration,
  isActive,
  normalizeStateHistoryConfig,
  stateActiveColor,
  stateHistoryIds,
  stateIcon,
  stateLabel,
  todayBounds,
  totalDuration
} from '../src/state-history-model';
import type { Hass } from '../src/model';

const state = (s: string, attributes: Record<string, unknown> = {}) => ({ state: s, attributes });

it('applique les valeurs par défaut de l’historique des états', () => {
  const config = normalizeStateHistoryConfig({});
  expect(config.title).toBe('Historique');
  expect(config.entity_prefix).toBe('fio');
  expect(config.name_prefix).toBe('');
  expect(config.entities).toEqual([]);
});

it('accepte le titre, le préfixe, le texte à retirer et déduplique les entités', () => {
  const config = normalizeStateHistoryConfig({ title: 'États', entity_prefix: 'piscine', name_prefix: 'Flow.io ', entities: ['switch.a', 'switch.a', 'binary_sensor.b'] });
  expect(config.title).toBe('États');
  expect(config.entity_prefix).toBe('piscine');
  expect(config.name_prefix).toBe('Flow.io ');
  expect(config.entities).toEqual(['switch.a', 'binary_sensor.b']);
});

it('rejette les configurations invalides', () => {
  for (const input of [undefined, [], 'x', { title: '  ' }, { name_prefix: 3 }, { entities: 'switch.a' }, { entities: [''] }, { grid_options: [] }]) {
    expect(() => normalizeStateHistoryConfig(input)).toThrow();
  }
});

it('découvre les interrupteurs et binaires du préfixe', () => {
  const hass = {
    states: {
      'switch.fio_io_flt_pmp': state('on'),
      'binary_sensor.fio_alm_1_active': state('off'),
      'switch.piscine_io_lights': state('on'),
      'sensor.fio_io_ph': state('7.2')
    }
  } as unknown as Hass;
  expect(stateHistoryIds(hass, 'fio')).toEqual(['binary_sensor.fio_alm_1_active', 'switch.fio_io_flt_pmp']);
  expect(stateHistoryIds(hass, 'piscine')).toEqual(['switch.piscine_io_lights']);
  expect(stateHistoryIds(undefined, 'fio')).toEqual([]);
});

it('choisit une icône selon l’entité, l’attribut ou le domaine', () => {
  expect(stateIcon('switch.fio_io_flt_pmp')).toBe('mdi:pump');
  expect(stateIcon('switch.fio_io_lights')).toBe('mdi:lightbulb-outline');
  expect(stateIcon('switch.fio_pl_modes_auto')).toBe('mdi:calendar-clock');
  expect(stateIcon('binary_sensor.fio_alm_1_active')).toBe('mdi:alert-outline');
  expect(stateIcon('binary_sensor.fio_alm_any_active')).toBe('mdi:shield-alert-outline');
  expect(stateIcon('switch.fio_custom', state('on', { icon: 'mdi:star' }))).toBe('mdi:star');
  expect(stateIcon('switch.fio_unknown')).toBe('mdi:toggle-switch');
  expect(stateIcon('binary_sensor.fio_unknown')).toBe('mdi:checkbox-marked-circle-outline');
});

it('borne la journée courante et formate les durées', () => {
  const now = new Date(2026, 0, 15, 13, 45, 20).getTime();
  const bounds = todayBounds(now);
  expect(bounds.start).toBe(new Date(2026, 0, 15, 0, 0, 0).getTime());
  expect(bounds.end - bounds.start).toBe(86400000);
  expect(formatDuration(0)).toBe('0 h 00');
  expect(formatDuration(3600000 * 11)).toBe('11 h 00');
  expect(formatDuration(3600000 * 5 + 1800000)).toBe('5 h 30');
  expect(formatDuration(45 * 60000)).toBe('0 h 45');
  expect(totalDuration([[0, 1000], [2000, 3500]])).toBe(2500);
  expect(totalDuration([])).toBe(0);
});

it('considère actifs les états on et true', () => {
  expect(isActive(state('on'))).toBe(true);
  expect(isActive(state('true'))).toBe(true);
  expect(isActive(state('off'))).toBe(false);
  expect(isActive(undefined)).toBe(false);
});

it('accepte un nom et une couleur par entité', () => {
  const config = normalizeStateHistoryConfig({ items: { 'switch.a': { name: 'Filt', color: '#ff0000' }, 'switch.b': {} } });
  expect(config.items).toEqual({ 'switch.a': { name: 'Filt', color: '#ff0000' }, 'switch.b': {} });
  expect(normalizeStateHistoryConfig({}).items).toEqual({});
  expect(() => normalizeStateHistoryConfig({ items: { a: { name: 3 } } })).toThrow();
  expect(() => normalizeStateHistoryConfig({ items: { a: { color: 3 } } })).toThrow();
  expect(() => normalizeStateHistoryConfig({ items: [] })).toThrow();
});

it('résout le libellé et la couleur par entité', () => {
  const config = normalizeStateHistoryConfig({ entities: ['switch.a', 'switch.b'], items: { 'switch.a': { name: 'Filt', color: '#ff0000' } } });
  const named = (name: string) => state('on', { friendly_name: name });
  expect(stateLabel(config, 'switch.a', named('Flow.io A'), 'Flow.io ')).toBe('Filt');
  expect(stateLabel(config, 'switch.b', named('Flow.io B'), 'Flow.io ')).toBe('B');
  expect(stateActiveColor(config, 'switch.a')).toBe('#ff0000');
  expect(stateActiveColor(config, 'switch.b')).toBe('');
});

it('affiche l’heure dans le fuseau demandé', () => {
  const stamp = Date.parse('2026-10-29T12:00:00Z');
  expect(clockTime(stamp, 'UTC')).toBe('12:00');
  expect(clockTime(stamp)).toMatch(/^\d{2}:\d{2}$/);
});
