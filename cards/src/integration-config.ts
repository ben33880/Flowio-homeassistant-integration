export function sharedNumber(installation: Installation, states: Record<string, SharedState>, key: string): number | undefined {
  const value = sharedEntity(installation, states, key)?.state;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}