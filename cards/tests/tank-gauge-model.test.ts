import { expect, it } from 'vitest';
import { tankGaugeTone } from '../src/tank-gauge-model';
import type { Installation, SharedState } from '../src/integration-config';

function installation(): Installation {
  return { prefix: 'fio', ph_slot: 1, disinfection_slot: 2, filtration_slot: 0,
    mqtt_root: '', thresholds: { tank_min: 25 } };
}

it('utilise tank_min et inclut la limite dans la zone bonne', () => {
  const config = installation();
  expect(tankGaugeTone(24, config, {})).toBe('bad');
  expect(tankGaugeTone(25, config, {})).toBe('good');
  config.thresholds.tank_min = 40;
  expect(tankGaugeTone(30, config, {})).toBe('bad');
});

it('lit le seuil courant de l’entité sans repli sur une valeur locale', () => {
  const config = installation();
  config.entities = { tank_min: 'number.tank_min' };
  const states: Record<string, SharedState> = {
    'number.tank_min': { state: '50', attributes: {} }
  };
  expect(tankGaugeTone(30, config, states)).toBe('bad');
  states['number.tank_min'].state = 'unavailable';
  expect(tankGaugeTone(30, config, states)).toBeUndefined();
  expect(tankGaugeTone(30, config, {})).toBeUndefined();
});

it('reste neutre pour des valeurs ou seuils invalides', () => {
  for (const value of [undefined, NaN, Infinity, -1, 101]) {
    expect(tankGaugeTone(value, installation(), {})).toBeUndefined();
  }
  for (const threshold of [NaN, Infinity, -1, 101]) {
    const config = installation();
    config.thresholds.tank_min = threshold;
    expect(tankGaugeTone(30, config, {})).toBeUndefined();
  }
  expect(tankGaugeTone(30, undefined, {})).toBeUndefined();
});
