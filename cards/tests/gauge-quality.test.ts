import { expect, it } from 'vitest';
import * as quality from '../src/gauge-quality';

it('ne conserve aucune ancienne fonction de seuils fixes', () => {
  expect(quality).not.toHaveProperty('qualityFor');
});
it('produit des segments visibles bornés à la jauge', () => {
  expect(quality.bandPath(-5, 2, 0, 14)).not.toBe('');
  expect(quality.bandPath(2, 2, 0, 14)).toBe('');
  expect(quality.bandPath(20, 30, 0, 14)).toBe('');
  expect(quality.bandPath(-5, -1, 0, 14)).toBe('');
});
it('rejette les bornes invalides', () => {
  expect(quality.bandPath(1, 2, 4, 4)).toBe('');
  expect(quality.bandPath(1, Infinity, 0, 14)).toBe('');
  expect(quality.bandPath(NaN, 2, 0, 14)).toBe('');
});
