import type { EntityState } from './model';

const FIRMWARE_ENTITY_NAMES: Array<[string, string, string]> = [
  ['io_flt_pmp', 'Filtration Pump', 'Filtration'],
  ['io_ph_pmp', 'pH Pump', 'Pompe pH'],
  ['io_chl_pmp', 'Chlorine Pump', 'Pompe désinfectant'],
  ['io_fill_pmp', 'Fill Pump', 'Remplissage'],
  ['io_chl_gen', 'Chlorine Generator', 'Électrolyseur'],
  ['io_lights', 'Lights', 'Éclairage'],
  ['io_wat_htr', 'Water Heater', 'Chauffage'],
  ['io_wat_tmp', 'Water Temperature', 'Eau'],
  ['io_air_tmp', 'Air Temperature', 'Air'],
  ['io_psi', 'PSI', 'Pression'],
  ['pl_modes_auto', 'Pool Auto-regulation', 'Régulation automatique'],
  ['pl_modes_winter', 'Winter Mode', 'Hivernage'],
  ['pl_ph_auto_mode', 'pH Auto-regulation', 'Régulation pH'],
  ['pl_dis_auto', 'Orp Auto-regulation', 'Régulation désinfection'],
  ['pl_heat_auto', 'Heater Auto-regulation', 'Régulation chauffage'],
  ['pl_ph_dose_plus', 'pH Dosing uses pH+', 'Utiliser pH+'],
  ['pl_o2_temp_comp', 'O2 Temperature Compensation', 'Compensation température O₂'],
  ['pl_modes_dis', 'Disinfection Type', 'Type de désinfection'],
  ['pl_swg_ctrl', 'SWG Control Mode', 'Pilotage électrolyseur'],
  ['pl_o2_hour', 'O2 Dosing Hour', 'Heure de dosage O₂']
];

const FIRMWARE_ALARM_NAMES: Record<string, string> = {
  'low pressure': 'Pression basse',
  'high pressure': 'Pression haute',
  'ph tank low': 'Cuve pH basse',
  'chlorine tank low': 'Cuve désinfectant basse',
  'ph pump max uptime reached': 'Durée maximale de la pompe pH atteinte',
  'chlorine pump max uptime reached': 'Durée maximale de la pompe désinfectant atteinte',
  'pool water level low': 'Niveau d’eau du bassin bas'
};

function localizedFirmwareName(id: string, name: string): string {
  const lowerName = name.toLocaleLowerCase('en');
  for (const [original, localized] of Object.entries(FIRMWARE_ALARM_NAMES)) {
    if (lowerName === original) return localized;
    if (lowerName.endsWith(` ${original}`)) {
      const prefix = name.slice(0, -original.length);
      if (/^flow\.io(?: waveshare)? /i.test(prefix)) return prefix + localized;
    }
  }
  const suffix = id.split('.', 2)[1] ?? id;
  for (const [entitySuffix, original, localized] of FIRMWARE_ENTITY_NAMES) {
    if (!suffix.endsWith(entitySuffix)) continue;
    const lowerOriginal = original.toLocaleLowerCase('en');
    if (lowerName === lowerOriginal) return localized;
    if (lowerName.endsWith(` ${lowerOriginal}`)) {
      const prefix = name.slice(0, -original.length);
      if (/^flow\.io(?: waveshare)? /i.test(prefix)) return prefix + localized;
    }
  }
  return name;
}

export function entityName(id: string, state?: EntityState): string {
  const name = state?.attributes.friendly_name;
  return typeof name === 'string' && name ? localizedFirmwareName(id, name) : id;
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
