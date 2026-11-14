import { describe, expect, it, vi } from 'vitest';
import { loadInstallations, parseInstallations, selectInstallation } from './integration-config';
function fixture() {
  return { prefix: 'fio', ph_slot: 1, disinfection_slot: 2, filtration_slot: 0, mqtt_root: 'flowio/ESP32-ABCDEF',
    thresholds: { ph_good_min: 7, ph_good_max: 7.4, ph_mid_min: 6.8, ph_mid_max: 7.6,
      orp_good_min: 650, orp_good_max: 750, orp_mid_min: 600, orp_mid_max: 800,
      temp_min: 4, temp_max: 32, tank_min: 15, offline_min: 10 } };
}
describe('configuration de l’intégration', () => {
  it('reprend les réglages reçus sans valeurs de repli', () => {
    const item = fixture();
    item.ph_slot = 4;
    item.thresholds.ph_good_min = 7.1;
    expect(parseInstallations({ installations: [item] })).toEqual([item]);
  });
  it('accepte une racine MQTT non renseignée', () => {
    expect(parseInstallations({ installations: [{ ...fixture(), mqtt_root: '' }] })[0].mqtt_root).toBe('');
  });
  it('refuse les réponses incomplètes et les valeurs invalides', () => {
    expect(() => parseInstallations({})).toThrow();
    expect(() => parseInstallations({ installations: [{ ...fixture(), thresholds: {} }] })).toThrow();
    expect(() => parseInstallations({ installations: [{ ...fixture(), ph_slot: 16 }] })).toThrow();
    expect(() => parseInstallations({ installations: [{ ...fixture(), filtration_slot: 16 }] })).toThrow();
    expect(() => parseInstallations({ installations: [{ ...fixture(), mqtt_root: 'flowio/+' }] })).toThrow();
    expect(() => parseInstallations({ installations: [fixture(), fixture()] })).toThrow();
  });
  it('ne choisit jamais arbitrairement entre plusieurs installations', () => {
    const one = fixture(), two = { ...fixture(), prefix: 'pool' };
    expect(selectInstallation([one])).toBe(one);
    expect(selectInstallation([one, two], 'pool')).toBe(two);
    expect(() => selectInstallation([one, two])).toThrow('Plusieurs installations');
    expect(() => selectInstallation([])).toThrow('Aucune intégration');
    expect(() => selectInstallation([one], 'missing')).toThrow('introuvable');
  });
  it('appelle flowio/config et propage un refus de connexion', async () => {
    const callWS = vi.fn().mockResolvedValue({ installations: [fixture()] });
    expect(await loadInstallations({ callWS })).toEqual([fixture()]);
    expect(callWS).toHaveBeenCalledWith({ type: 'flowio/config' });
    callWS.mockRejectedValue(new Error('Déconnecté'));
    await expect(loadInstallations({ callWS })).rejects.toThrow('Déconnecté');
  });
});
