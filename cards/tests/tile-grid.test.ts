import { expect, it } from 'vitest';
import { normalizeTileGridConfig } from '../src/tile-grid';
it('conserve les options de présentation sans préfixe local', () => {
  const config = normalizeTileGridConfig({ title: 'Équipements', columns: 3, entities: ['switch.fio_light'] }, 'custom:flowio-equipment-card', 'Équipements');
  expect(config).toEqual({ type: 'custom:flowio-equipment-card', title: 'Équipements', columns: 3, name_prefix: '', entities: ['switch.fio_light'] });
  expect(config).not.toHaveProperty('entity_prefix');
});
it('rejette les configurations invalides et les anciens préfixes', () => {
  for (const input of [{ title: '' }, { columns: 0 }, { columns: 7 }, { name_prefix: 3 }, { entities: 'x' }, { entity_prefix: 'fio' }, { grid_options: [] }]) {
    expect(() => normalizeTileGridConfig(input, 'custom:flowio-equipment-card', 'Équipements')).toThrow();
  }
});
