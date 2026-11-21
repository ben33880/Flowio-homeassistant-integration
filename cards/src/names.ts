import en from '../../custom_components/flowio/translations/en.json';
import fr from '../../custom_components/flowio/translations/fr.json';
import type { EntityState } from './model';

type CardTranslations = typeof en.card;
const sourceNames = en.card;
const localizedCards: Record<string, CardTranslations> = { en: en.card, fr: fr.card };

export function languageFromHass(hass?: { language?: string; locale?: { language?: string } }): string {
  return hass?.locale?.language ?? hass?.language ?? 'en';
}

function cardTranslations(language = 'en'): CardTranslations {
  return localizedCards[language.toLowerCase().slice(0, 2)] ?? en.card;
}

function localizedFirmwareName(id: string, name: string, language: string): string {
  const translations = cardTranslations(language);
  const suffix = id.split('.', 2)[1] ?? id;
  const sourceEntities = sourceNames.firmware_entity_names;
  const entityKey = Object.keys(sourceEntities).find(key => suffix.endsWith(key));
  const translated = entityKey ? translations.firmware_entity_names[entityKey as keyof typeof sourceEntities] : undefined;
  const original = entityKey ? sourceEntities[entityKey as keyof typeof sourceEntities] : undefined;
  const alarmKey = Object.keys(sourceNames.firmware_alarm_names).find(key =>
    sourceNames.firmware_alarm_names[key as keyof typeof sourceNames.firmware_alarm_names].toLocaleLowerCase('en') ===
      name.toLocaleLowerCase('en'));
  const prefixedAlarmKey = Object.keys(sourceNames.firmware_alarm_names).find(key => {
    const source = sourceNames.firmware_alarm_names[key as keyof typeof sourceNames.firmware_alarm_names];
    return name.toLocaleLowerCase('en').endsWith(` ${source.toLocaleLowerCase('en')}`);
  });
  if (!entityKey && !alarmKey && !prefixedAlarmKey) return name;
  if (entityKey && original && translated) {
    const lowerName = name.toLocaleLowerCase('en'), lowerOriginal = original.toLocaleLowerCase('en');
    if (lowerName === lowerOriginal) return translated;
    if (lowerName.endsWith(` ${lowerOriginal}`)) {
      const prefix = name.slice(0, -original.length);
      if (/^flow\.io(?: waveshare)? /i.test(prefix)) return prefix + translated;
    }
    return name;
  }
  const key = alarmKey ?? prefixedAlarmKey;
  if (!key) return name;
  const source = sourceNames.firmware_alarm_names[key as keyof typeof sourceNames.firmware_alarm_names];
  const localized = translations.firmware_alarm_names[key as keyof typeof sourceNames.firmware_alarm_names];
  if (alarmKey) return localized;
  const prefix = name.slice(0, -source.length);
  return /^flow\.io(?: waveshare)? /i.test(prefix) ? prefix + localized : name;
}

export function entityName(id: string, state?: EntityState, source: string | { language?: string; locale?: { language?: string } } = 'en'): string {
  const name = state?.attributes.friendly_name;
  const language = typeof source === 'string' ? source : languageFromHass(source);
  return typeof name === 'string' && name ? localizedFirmwareName(id, name, language) : id;
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
