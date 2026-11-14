export interface FirmwarePanelConfig {
  type: string;
  calculated_values: string[];
  device_metrics: string[];
  device_slot: number;
  operations: string[];
  inline_operations: string[];
}
function stringList(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) throw new Error(`Liste ${label} invalide`);
  return [...new Set(value as string[])];
}
export function normalizeFirmwarePanelConfig(input: unknown): FirmwarePanelConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration objet attendue');
  const raw = input as Record<string, unknown>;
  if ('prefix' in raw) throw new Error('prefix supprimé : le préfixe vient de l’intégration Flow.io. Retirer ce champ.');
  if ('mqtt_topic' in raw) throw new Error('mqtt_topic supprimé : le topic vient de l’intégration Flow.io. Retirer ce champ.');
  const device_slot = raw.device_slot ?? 0;
  if (typeof device_slot !== 'number' || !Number.isInteger(device_slot) || device_slot < 0) throw new Error('device_slot attendu comme entier positif');
  return {
    type: 'custom:flowio-firmware-panel',
    calculated_values: stringList(raw.calculated_values, 'calculated_values'),
    device_metrics: stringList(raw.device_metrics, 'device_metrics'),
    device_slot,
    operations: stringList(raw.operations, 'operations'),
    inline_operations: stringList(raw.inline_operations, 'inline_operations')
  };
}
