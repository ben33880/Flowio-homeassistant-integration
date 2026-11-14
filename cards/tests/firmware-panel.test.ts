import { expect, it } from 'vitest';
import { normalizeFirmwarePanelConfig } from '../src/firmware-panel-model';
it('ne conserve aucun préfixe local et rejette les anciennes options', () => {
  expect(normalizeFirmwarePanelConfig({})).toEqual({
    type: 'custom:flowio-firmware-panel', calculated_values: [], device_metrics: [], device_slot: 0, operations: [], inline_operations: []
  });
  for (const input of [{ prefix: 'fio' }, { prefix: '' }, { mqtt_topic: 3 }, { calculated_values: 'x' }, { device_metrics: 'x' }, { device_slot: -1 }, { operations: 'x' }, { inline_operations: 'x' }]) {
    expect(() => normalizeFirmwarePanelConfig(input)).toThrow();
  }
});
