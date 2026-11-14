import { expect, it } from 'vitest';
import { mergeOrder, moveItem, orderItems } from '../src/order-list';

it('déplace un élément dans une liste', () => {
  expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  expect(moveItem(['a', 'b', 'c'], 0, 5)).toEqual(['a', 'b', 'c']);
  expect(moveItem(['a', 'b', 'c'], -1, 0)).toEqual(['a', 'b', 'c']);
});

it('fusionne l’ordre : conserve l’existant puis ajoute les nouveaux', () => {
  expect(mergeOrder(['a', 'b', 'c'], ['c', 'a', 'd'])).toEqual(['a', 'c', 'd']);
  expect(mergeOrder(['a', 'b'], ['b', 'a'])).toEqual(['a', 'b']);
  expect(mergeOrder([], ['x', 'y'])).toEqual(['x', 'y']);
  expect(mergeOrder(['a', 'b'], [])).toEqual([]);
});

it('construit les libellés de la liste d’ordre', () => {
  const states = { 'sensor.x': { state: '1', attributes: { friendly_name: 'Flow.io Waveshare pH' } } };
  expect(orderItems(['sensor.x'], states, 'Flow.io Waveshare ')).toEqual([{ value: 'sensor.x', label: 'pH' }]);
});
