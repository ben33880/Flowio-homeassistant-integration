import { describe, expect, it } from 'vitest';
import { normalizeConfig } from './model';

describe('paramètre persistant mqtt_topic', () => {
  it('rejette entity_prefix supprimé et ne crée pas de topic', () => {
    expect(() => normalizeConfig({ entity_prefix: 'fio' })).toThrow('entity_prefix supprimé');
    expect(normalizeConfig({}).mqtt_topic).toBeUndefined();
    expect(normalizeConfig({ mqtt_topic: '' }).mqtt_topic).toBeUndefined();
    expect(normalizeConfig({ mqtt_topic: '  ' }).mqtt_topic).toBeUndefined();
  });
  it('conserve le topic et reste indépendant du préfixe HA', () => {
    const config = normalizeConfig({ mqtt_topic: ' pool/controller/ ' });
    expect(config.mqtt_topic).toBe('pool/controller');
    expect(normalizeConfig(JSON.parse(JSON.stringify(config))).mqtt_topic).toBe('pool/controller');
  });
  it('refuse les types invalides, jokers et segments vides', () => {
    for (const mqtt_topic of [null, false, 42, {}, [], 'pool/+', 'pool/#', 'pool//controller', '/pool/controller']) {
      expect(() => normalizeConfig({ mqtt_topic })).toThrow();
    }
  });
});
