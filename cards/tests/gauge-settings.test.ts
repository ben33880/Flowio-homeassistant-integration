import { expect, it } from 'vitest';
import { gaugeSettings } from '../src/gauge-settings';
import type { Installation } from '../src/integration-config';

function installation(): Installation {
  return {
    prefix: 'fio', filtration_slot: 0, ph_slot: 1, disinfection_slot: 2,
    mqtt_root: 'flowio/pool',
    thresholds: {
      ph_good_min: 7.1, ph_good_max: 7.5, ph_mid_min: 6.9, ph_mid_max: 7.7,
      orp_good_min: 600, orp_good_max: 700, orp_mid_min: 550, orp_mid_max: 800
    }
  };
}

it('utilise uniquement les extrémités des attributs firmware', () => {
  const result = gaugeSettings({ min: 350, max: 900 }, 'orp', 650, installation(), {});
  expect(result.scale).toEqual({ min: 350, max: 900 });
  expect(result.zones).toEqual([
    { from: 350, to: 550, tone: 'bad' },
    { from: 550, to: 600, tone: 'medium' },
    { from: 600, to: 700, tone: 'good' },
    { from: 700, to: 800, tone: 'medium' },
    { from: 800, to: 900, tone: 'bad' }
  ]);
});

it('recalcule les zones lorsque les paramètres intégration changent', () => {
  const config = installation();
  expect(gaugeSettings({ min: 6, max: 9 }, 'ph', 7, config, {}).tone).toBe('medium');
  config.thresholds.ph_good_min = 7;
  expect(gaugeSettings({ min: 6, max: 9 }, 'ph', 7, config, {}).tone).toBe('good');
});

it('lit les entités de seuils lorsque l’intégration les fournit', () => {
  const config = installation();
  config.entities = {
    orp_good_min: 'number.good_min', orp_good_max: 'number.good_max',
    orp_mid_min: 'number.mid_min', orp_mid_max: 'number.mid_max'
  };
  const states = {
    'number.good_min': { state: '660', attributes: {} },
    'number.good_max': { state: '720', attributes: {} },
    'number.mid_min': { state: '600', attributes: {} },
    'number.mid_max': { state: '800', attributes: {} }
  };
  expect(gaugeSettings({ min: 350, max: 900 }, 'orp', 650, config, states).tone).toBe('medium');
  delete states['number.good_min'];
  expect(gaugeSettings({ min: 350, max: 900 }, 'orp', 650, config, states).zones).toEqual([]);
});

it('ne remplace pas les extrémités firmware absentes ou invalides', () => {
  for (const attributes of [undefined, {}, { min: 900, max: 350 }]) {
    const result = gaugeSettings(attributes, 'orp', 650, installation(), {});
    expect(result.scale).toBeUndefined();
    expect(result.zones).toEqual([]);
  }
});

it('reste neutre pour des seuils absents, invalides ou désordonnés', () => {
  for (const value of [NaN, Infinity, 850]) {
    const config = installation();
    config.thresholds.orp_good_min = value;
    const result = gaugeSettings({ min: 350, max: 900 }, 'orp', 650, config, {});
    expect(result.zones).toEqual([]);
    expect(result.tone).toBeUndefined();
  }
  expect(gaugeSettings({ min: 350, max: 900 }, 'orp', 650, undefined, {}).zones).toEqual([]);
});

it('limite les bandes à l’échelle sans déplacer les extrémités firmware', () => {
  const result = gaugeSettings({ min: 625, max: 675 }, 'orp', undefined, installation(), {});
  expect(result.zones).toEqual([{ from: 625, to: 675, tone: 'good' }]);
  expect(result.tone).toBeUndefined();
});
