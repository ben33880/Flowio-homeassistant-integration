import { expect, it } from 'vitest';
import { FILTRATION_DESCRIPTION, normalizeFiltrationConfig } from '../src/filtration-model';

it('applique le titre et la description par défaut', () => {
  const config = normalizeFiltrationConfig({});
  expect(config.title).toBe('Filtration');
  expect(config.description).toBe(FILTRATION_DESCRIPTION);
  expect(config.entity_prefix).toBe('fio');
});

it('accepte un titre, une description et un préfixe personnalisés', () => {
  const config = normalizeFiltrationConfig({ title: 'Plage', description: 'Perso', entity_prefix: '' });
  expect(config).toEqual({ type: 'custom:flowio-filtration-card', title: 'Plage', description: 'Perso', entity_prefix: '' });
});

it('rejette les configurations invalides', () => {
  for (const input of [{ title: '' }, { title: 3 }, { description: 5 }, { entity_prefix: 'a.b' }, { grid_options: [] }]) {
    expect(() => normalizeFiltrationConfig(input)).toThrow();
  }
});
