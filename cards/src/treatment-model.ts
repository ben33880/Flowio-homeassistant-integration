import { normalizePrefix } from './entities';
import { numericValue } from './gauge-model';
import { available, type EntityState } from './model';
import type { Treatment } from './modes-model';

export interface TreatmentConfig {
  type: string;
  entity_prefix: string;
  grid_options?: Record<string, unknown>;
}

export interface TreatmentPresentation {
  title: string;
  icon: string;
  description: string;
}

export interface TreatmentTile {
  label: string;
  entityId: string;
  unit?: string;
  minutes?: boolean;
  toggle?: boolean;
}

export const TREATMENT_PRESENTATION: Record<Treatment, TreatmentPresentation> = {
  chlorine_bromine: {
    title: 'Chlore / Brome',
    icon: 'mdi:flask-outline',
    description: 'Régulation liquide pilotée par la mesure ORP et une pompe doseuse.'
  },
  electrolyzer: {
    title: 'Électrolyse',
    icon: 'mdi:lightning-bolt-outline',
    description: 'Production au sel, soit sur consigne ORP, soit en continu pendant la filtration.'
  },
  oxygen: {
    title: 'Oxygène actif',
    icon: 'mdi:water-outline',
    description: 'Dosage hebdomadaire calculé depuis le volume du bassin, la charge et la température.'
  },
  disabled: {
    title: 'Désactivé',
    icon: 'mdi:file-document-outline',
    description: 'Aucun traitement de désinfection n’est sélectionné.'
  }
};

const UNKNOWN_PRESENTATION: TreatmentPresentation = {
  title: 'Traitement indisponible',
  icon: 'mdi:help-circle-outline',
  description: 'Le type de traitement n’est pas disponible. Vérifier l’entité « Type de désinfection ».'
};

export function normalizeTreatmentConfig(input: unknown): TreatmentConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Configuration objet attendue');
  }
  const raw = input as Record<string, unknown>;
  const grid_options = raw.grid_options === undefined ? undefined : raw.grid_options;
  if (grid_options !== undefined && (!grid_options || typeof grid_options !== 'object' || Array.isArray(grid_options))) {
    throw new Error('grid_options doit être un objet');
  }
  return {
    type: 'custom:flowio-treatment-card',
    entity_prefix: normalizePrefix(raw.entity_prefix),
    ...(grid_options ? { grid_options: grid_options as Record<string, unknown> } : {})
  };
}

export function treatmentPresentation(treatment: Treatment | undefined): TreatmentPresentation {
  return treatment ? TREATMENT_PRESENTATION[treatment] : UNKNOWN_PRESENTATION;
}

export function treatmentTiles(prefix: string, treatment: Treatment | undefined): TreatmentTile[] {
  const stem = prefix ? `${prefix}_` : '';
  switch (treatment) {
    case 'chlorine_bromine':
      return [
        { label: 'Auto ORP', entityId: `switch.${stem}pl_dis_auto`, toggle: true },
        { label: 'Consigne', entityId: `number.${stem}pl_dis_setpoint`, unit: '' },
        { label: 'Fenêtre', entityId: `number.${stem}pl_dis_window`, minutes: true }
      ];
    case 'electrolyzer':
      return [
        { label: 'Contrôle', entityId: `select.${stem}pl_swg_ctrl` },
        { label: 'Délai', entityId: `number.${stem}pl_swg_dly_elec`, unit: 'min' },
        { label: 'Sécurité eau', entityId: `number.${stem}pl_swg_min_temp`, unit: '°C' }
      ];
    case 'oxygen':
      return [
        { label: 'Volume bassin', entityId: `number.${stem}pl_o2_vol`, unit: 'm³' },
        { label: 'Dose hebdo', entityId: `number.${stem}pl_o2_dose`, unit: 'ml' },
        { label: 'Injections', entityId: `number.${stem}pl_o2_split`, unit: '' },
        { label: 'En attente', entityId: `sensor.${stem}pl_o2_pending`, unit: 'ml' }
      ];
    default:
      return [];
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function formatMinutes(value: number): string {
  const total = Math.round(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours} h${minutes ? ` ${minutes}` : ''}` : `${minutes} min`;
}

export function treatmentTileValue(state: EntityState | undefined, tile: TreatmentTile): string {
  if (!state) return 'Entité absente';
  if (!available(state)) return 'Indisponible';
  if (tile.toggle) return state.state === 'on' ? 'Marche' : state.state === 'off' ? 'Arrêt' : state.state;
  const value = numericValue(state.state);
  if (tile.minutes) return value === undefined ? state.state : formatMinutes(value);
  const unit = tile.unit ?? (typeof state.attributes.unit_of_measurement === 'string' ? state.attributes.unit_of_measurement : '');
  const display = value === undefined ? state.state : formatNumber(value);
  return unit ? `${display} ${unit}` : display;
}
