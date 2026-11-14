export interface Installation {
  prefix: string;
  ph_slot: number;
  disinfection_slot: number;
  filtration_slot: number;
  mqtt_root: string;
  thresholds: Record<string, number>;
  entities?: Record<string, string | null>;
}

export interface ConfigConnection {
  callWS<T>(message: { type: string }): Promise<T>;
}

const thresholdKeys = [
  'ph_good_min', 'ph_good_max', 'ph_mid_min', 'ph_mid_max',
  'orp_good_min', 'orp_good_max', 'orp_mid_min', 'orp_mid_max',
  'temp_min', 'temp_max', 'tank_min', 'offline_min'
];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Configuration Flow.io invalide.');
  }
  return value as Record<string, unknown>;
}

function slot(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 15) {
    throw new Error('Slot Flow.io invalide.');
  }
  return value;
}

export function parseInstallations(response: unknown): Installation[] {
  const data = object(response);
  if (!Array.isArray(data.installations)) throw new Error('Liste des installations Flow.io absente.');
  const seen = new Set<string>();
  return data.installations.map(value => {
    const item = object(value);
    if (typeof item.prefix !== 'string' || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(item.prefix) || seen.has(item.prefix)) {
      throw new Error('Préfixe Flow.io invalide ou dupliqué.');
    }
    seen.add(item.prefix);
    if (typeof item.mqtt_root !== 'string' || (item.mqtt_root !== '' &&
      (item.mqtt_root.startsWith('/') || item.mqtt_root.endsWith('/') || /[+#\s\u0000]/u.test(item.mqtt_root) || item.mqtt_root.split('/').some(part => !part)))) {
      throw new Error('Racine MQTT Flow.io invalide.');
    }
    const raw = object(item.thresholds);
    const thresholds: Record<string, number> = {};
    for (const key of thresholdKeys) {
      const number = raw[key];
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error(`Seuil Flow.io invalide : ${key}`);
      thresholds[key] = number;
    }
    let entities: Record<string, string | null> | undefined;
    if (item.entities !== undefined) {
      entities = {};
      for (const [key, id] of Object.entries(object(item.entities))) {
        if (id !== null && (typeof id !== 'string' || !/^(sensor|number)\.[a-z0-9_]+$/.test(id))) {
          throw new Error(`Entité Flow.io invalide : ${key}`);
        }
        entities[key] = id;
      }
    }
    return { prefix: item.prefix, ph_slot: slot(item.ph_slot),
      disinfection_slot: slot(item.disinfection_slot), filtration_slot: slot(item.filtration_slot), mqtt_root: item.mqtt_root, thresholds,
      ...(entities !== undefined ? { entities } : {}) };
  });
}

export async function loadInstallations(hass: ConfigConnection): Promise<Installation[]> {
  return parseInstallations(await hass.callWS<unknown>({ type: 'flowio/config' }));
}

export function selectInstallation(installations: Installation[], prefix?: string): Installation {
  if (prefix !== undefined) {
    const match = installations.find(item => item.prefix === prefix);
    if (match) return match;
    throw new Error('Installation Flow.io introuvable.');
  }
  if (installations.length === 1) return installations[0];
  if (!installations.length) throw new Error('Aucune intégration Flow.io chargée.');
  throw new Error('Plusieurs installations Flow.io : sélectionner une installation.');
}

export interface SharedState {
  state: string;
  attributes: Record<string, unknown>;
}

export function sharedEntity(installation: Installation, states: Record<string, SharedState>, key: string): SharedState | undefined {
  const id = installation.entities?.[key];
  return id ? states[id] : undefined;
}

export function sharedNumber(installation: Installation, states: Record<string, SharedState>, key: string): number | undefined {
  const value = sharedEntity(installation, states, key)?.state;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function currentThresholds(installation: Installation, states: Record<string, SharedState>): Record<string, number | undefined> {
  return Object.fromEntries(thresholdKeys.map(key => [key,
    installation.entities === undefined ? installation.thresholds[key] : sharedNumber(installation, states, key)
  ]));
}
