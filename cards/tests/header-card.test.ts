import { expect, it } from 'vitest';
import { gaugeLabel, gaugeUnit, normalizeHeaderConfig, poolStatus, statusDescription } from '../src/header-model';
import type { Hass } from '../src/model';

const hass = (states: Record<string, string>): Hass => ({
  states: Object.fromEntries(Object.entries(states).map(([id, state]) => [id, { state, attributes: {} }])),
  callService: async () => undefined
});

it('applique le libellé et les jauges Eau · ORP · Air par défaut', () => {
  const config = normalizeHeaderConfig({});
  expect(config.title).toBe('État du bassin');
  expect(config.entity_prefix).toBe('fio');
  expect(config.measurements).toEqual(['water_temperature', 'orp', 'air_temperature']);
  expect(config.status).toBe(true);
});

it('accepte un préfixe vide et déduplique les mesures', () => {
  const config = normalizeHeaderConfig({ entity_prefix: '', measurements: ['ph', 'ph', 'pressure'] });
  expect(config.entity_prefix).toBe('');
  expect(config.measurements).toEqual(['ph', 'pressure']);
});

it('rejette les mesures et options invalides', () => {
  for (const input of [{ measurements: 'ph' }, { measurements: ['inconnu'] }, { status: 'oui' }, { title: '  ' }, { grid_options: [] }]) {
    expect(() => normalizeHeaderConfig(input)).toThrow();
  }
});

it('choisit le design standard par défaut et accepte le design Flow.io', () => {
  expect(normalizeHeaderConfig({}).design).toBe('standard');
  expect(normalizeHeaderConfig({ design: 'flowio' }).design).toBe('flowio');
  expect(() => normalizeHeaderConfig({ design: 'autre' })).toThrow();
});

it('conserve grid_options pour les vues Sections', () => {
  expect(normalizeHeaderConfig({ grid_options: { columns: 'full' } }).grid_options).toEqual({ columns: 'full' });
});

it('déduit l’état depuis le nombre d’alarmes et l’alarme globale', () => {
  expect(poolStatus(hass({ 'sensor.fio_alm_active_count': '0', 'binary_sensor.fio_alm_any_active': 'off' }), 'fio')).toEqual({ tone: 'ok', label: 'État normal' });
  expect(poolStatus(hass({ 'sensor.fio_alm_active_count': '2' }), 'fio')).toEqual({ tone: 'alert', label: 'Alarme en cours' });
  expect(poolStatus(hass({ 'binary_sensor.fio_alm_any_active': 'on' }), 'fio').tone).toBe('alert');
  expect(poolStatus(hass({}), 'fio').tone).toBe('unknown');
});

it('décrit le mode de filtration et le traitement configuré', () => {
  const manual = hass({ 'switch.fio_pl_modes_auto': 'off', 'select.fio_pl_modes_dis': 'Chlore/Brome' });
  expect(statusDescription(manual, 'fio')).toBe('Mode manuel : les automatismes sont suspendus. Traitement configuré : Chlore / Brome.');
  const auto = hass({ 'switch.fio_pl_modes_auto': 'on', 'select.fio_pl_modes_dis': 'Electrolyse' });
  expect(statusDescription(auto, 'fio')).toBe('Filtration automatique active. Traitement configuré : Électrolyse.');
  expect(statusDescription(hass({}), 'fio')).toBe('');
});

it('fournit libellés et unités de repli', () => {
  expect(gaugeLabel('water_temperature')).toBe('Eau');
  expect(gaugeUnit('orp', 'mV')).toBe('mV');
  expect(gaugeUnit('orp', undefined)).toBe('mV');
  expect(gaugeUnit('ph', '')).toBe('');
});
