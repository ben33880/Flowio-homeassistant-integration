import type { EntityState } from './model';

export function entityName(id: string, state?: EntityState): string {
  const name = state?.attributes.friendly_name;
  return typeof name === 'string' && name ? name : id;
}

export function commonNamePrefix(names: string[]): string {
  if (names.length < 2) return '';
  let prefix = names[0];
  for (const name of names) {
    while (prefix && !name.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  if (!prefix) return '';
  const boundary = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('·'), prefix.lastIndexOf('-'));
  return boundary >= 0 ? prefix.slice(0, boundary + 1) : '';
}

export function displayName(name: string, prefix: string): string {
  if (prefix && name.startsWith(prefix)) return name.slice(prefix.length).trim() || name;
  return name;
}

export function commonEntityPrefix(ids: string[], states?: Record<string, EntityState>): string {
  const names: string[] = [];
  for (const id of ids) {
    const name = states?.[id]?.attributes.friendly_name;
    if (typeof name === 'string' && name) names.push(name);
  }
  if (names.length < 2) return '';
  const counts = new Map<string, number>();
  for (const name of names) {
    const seen = new Set<string>();
    for (let i = 0; i < name.length; i++) {
      const ch = name[i];
      if (ch === ' ' || ch === '·' || ch === '-') {
        const candidate = name.slice(0, i + 1);
        if (!seen.has(candidate)) {
          seen.add(candidate);
          counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
        }
      }
    }
  }
  let best = '';
  let bestCount = 1;
  for (const [candidate, count] of counts) {
    if (count > bestCount || (count === bestCount && candidate.length > best.length)) {
      best = candidate;
      bestCount = count;
    }
  }
  return bestCount >= 2 ? best : '';
}
