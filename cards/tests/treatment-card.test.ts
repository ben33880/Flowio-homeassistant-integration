import { expect, it } from 'vitest';
import {
  formatMinutes,
  normalizeTreatmentConfig,
  treatmentPresentation,
  treatmentTileValue,
  treatmentTiles
} from '../src/treatment-model';

it('applique le préfixe fio par défaut et rejette les options invalides', () => {
  expect(normalizeTreatmentConfig({}).entity_prefix).toBe('fio');
  expect(normalizeTreatmentConfig({ entity_prefix: 'piscine' }).entity_prefix).toBe('piscine');
  for (const input of [{ entity_prefix: 24 }, { grid_options: [] }]) {
    expect(() => normalizeTreatmentConfig(input)).toThrow();
  }
});

it('présente chaque type de traitement', () => {
  expect(treatmentPresentation('chlorine_bromine').title).toBe('Chlore / Brome');
  expect(treatmentPresentation('electrolyzer').icon).toBe('mdi:lightning-bolt-outline');
  expect(treatmentPresentation('oxygen').title).toBe('Oxygène actif');
  expect(treatmentPresentation('disabled').description).toContain('Aucun traitement');
  expect(treatmentPresentation(undefined).title).toBe('Traitement indisponible');
});

it('expose les entités adaptées au traitement actif', () => {
  expect(treatmentTiles('fio', 'chlorine_bromine').map(tile => tile.entityId)).toEqual([
    'switch.fio_pl_dis_auto',
    'number.fio_pl_dis_setpoint',
    'number.fio_pl_dis_window'
  ]);
  expect(treatmentTiles('', 'electrolyzer').map(tile => tile.entityId)).toEqual([
    'select.pl_swg_ctrl',
    'number.pl_swg_dly_elec',
    'number.pl_swg_min_temp'
  ]);
  expect(treatmentTiles('fio', 'oxygen').map(tile => tile.label)).toEqual(['Volume bassin', 'Dose hebdo', 'Injections', 'En attente']);
  expect(treatmentTiles('fio', 'disabled')).toEqual([]);
  expect(treatmentTiles('fio', undefined)).toEqual([]);
});

it('met en forme les valeurs des tuiles', () => {
  const state = (value: string, unit?: string) => ({ state: value, attributes: unit ? { unit_of_measurement: unit } : {} });
  expect(treatmentTileValue(undefined, { label: 'x', entityId: 'x' })).toBe('Entité absente');
  expect(treatmentTileValue(state('unavailable'), { label: 'x', entityId: 'x' })).toBe('Indisponible');
  expect(treatmentTileValue(state('on'), { label: 'Auto ORP', entityId: 'x', toggle: true })).toBe('Marche');
  expect(treatmentTileValue(state('off'), { label: 'Auto ORP', entityId: 'x', toggle: true })).toBe('Arrêt');
  expect(treatmentTileValue(state('700.0'), { label: 'Consigne', entityId: 'x', unit: '' })).toBe('700');
  expect(treatmentTileValue(state('60'), { label: 'Fenêtre', entityId: 'x', minutes: true })).toBe('1 h');
  expect(treatmentTileValue(state('10'), { label: 'Délai', entityId: 'x', unit: 'min' })).toBe('10 min');
  expect(treatmentTileValue(state('15'), { label: 'Sécurité eau', entityId: 'x', unit: '°C' })).toBe('15 °C');
  expect(treatmentTileValue(state('Continu sur filtration'), { label: 'Contrôle', entityId: 'x' })).toBe('Continu sur filtration');
});

it('formate les durées en minutes', () => {
  expect(formatMinutes(60)).toBe('1 h');
  expect(formatMinutes(90)).toBe('1 h 30');
  expect(formatMinutes(45)).toBe('45 min');
  expect(formatMinutes(0)).toBe('0 min');
});
