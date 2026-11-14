import { describe, expect, it } from 'vitest';
import { normalizeConfig } from './model';

describe('paramètre supprimé mqtt_topic', () => {
  it('rejette entity_prefix et mqtt_topic supprimés', () => {
    expect(() => normalizeConfig({ entity_prefix: 'fio' })).toThrow('entity_prefix supprimé');
    expect(() => normalizeConfig({ mqtt_topic: 'pool/controller' })).toThrow('mqtt_topic supprimé');
  });
});
