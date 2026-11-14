import { describe, expect, it } from 'vitest';
import { currentThresholds, sharedEntity, sharedNumber, type Installation } from './integration-config';
const installation: Installation = {
  prefix: 'fio', ph_slot: 1, disinfection_slot: 2, filtration_slot: 0, mqtt_root: '',
  thresholds: { ph_good_min: 7 },
  entities: { ph_good_min: 'number.mon_seuil', ph_injected: 'sensor.mon_volume', dis_injected: null }
};
describe('entités partagées', () => {
  it('lit les identifiants réels sans construire de nom depuis le préfixe', () => {
    const state = { state: '125', attributes: { value_source: 'firmware' } };
    const states = { 'sensor.mon_volume': state };
    expect(sharedEntity(installation, states, 'ph_injected')).toBe(state);
    expect(sharedNumber(installation, states, 'ph_injected')).toBe(125);
    expect(sharedEntity(installation, states, 'dis_injected')).toBeUndefined();
  });
  it('reprend immédiatement un changement de seuil dans les états HA', () => {
    const states = { 'number.mon_seuil': { state: '7.1', attributes: {} } };
    expect(currentThresholds(installation, states).ph_good_min).toBe(7.1);
    states['number.mon_seuil'].state = '7.2';
    expect(currentThresholds(installation, states).ph_good_min).toBe(7.2);
  });
  it('ne remplace pas un état indisponible par zéro ou par un ancien seuil', () => {
    for (const state of ['unavailable', 'unknown', '', 'Infinity']) {
      expect(sharedNumber(installation, { 'number.mon_seuil': { state, attributes: {} } }, 'ph_good_min')).toBeUndefined();
    }
    expect(currentThresholds(installation, {}).ph_good_min).toBeUndefined();
    expect(sharedNumber(installation, { 'sensor.mon_volume': { state: '0', attributes: {} } }, 'ph_injected')).toBe(0);
  });
});
