export interface FiltrationConfig {
  type: string;
  title: string;
  description: string;
  grid_options?: Record<string, unknown>;
}

export const FILTRATION_DESCRIPTION = 'La plage de filtration combine contraintes horaires et température d’eau pour protéger le bassin.';

export function normalizeFiltrationConfig(input: unknown): FiltrationConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration objet attendue');
  const raw = input as Record<string, unknown>;
  if ('entity_prefix' in raw) throw new Error('entity_prefix supprimé : le préfixe vient de l’intégration Flow.io. Retirer ce champ.');
  const title = raw.title ?? 'Filtration';
  if (typeof title !== 'string' || !title.trim()) throw new Error('Titre invalide');
  const description = raw.description ?? FILTRATION_DESCRIPTION;
  if (typeof description !== 'string') throw new Error('Description invalide');
  const grid_options = raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) throw new Error('grid_options doit être un objet');
  return { type: 'custom:flowio-filtration-card', title, description,
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {}) };
}
