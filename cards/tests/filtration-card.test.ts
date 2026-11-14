import { expect, it } from 'vitest';
import { FILTRATION_DESCRIPTION, normalizeFiltrationConfig } from '../src/filtration-model';
it('applique les options de présentation sans préfixe local', () => {
  const config = normalizeFiltrationConfig({});
  expect(config.title).toBe('Filtration');
  expect(config.description).toBe(FILTRATION_DESCRIPTION);
  expect(config).not.toHaveProperty('entity_prefix');
});
it('accepte un titre et une description personnalisés', () => {
  expect(normalizeFiltrationConfig({ title: 'Plage', description: 'Perso' })).toEqual({
    type: 'custom:flowio-filtration-card', title: 'Plage', description: 'Perso'
  });
});
it('rejette les configurations invalides et les anciens préfixes', () => {
  for (const input of [{ title: '' }, { title: 3 }, { description: 5 }, { entity_prefix: '' }, { entity_prefix: 'fio' }, { grid_options: [] }]) {
    expect(() => normalizeFiltrationConfig(input)).toThrow();
  }
});
