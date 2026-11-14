import { expect, it } from 'vitest';
import { defaultSeriesColor, defaultShadeColor, GRAPH_PALETTE, normalizeGraphConfig, seriesColor, shadeColor, SHADE_PALETTE } from '../src/graph-model';
import { consolidatePoints, consolidationMs, onIntervals, statisticsPoints, type HistoryPoint } from '../src/history-data';

it('applique les valeurs par défaut de la carte graphique', () => {
  const config = normalizeGraphConfig({});
  expect(config.title).toBe('Graphique');
  expect(config.entity_prefix).toBe('fio');
  expect(config.hours_to_show).toBe(12);
  expect(config.chart_type).toBe('line');
  expect(config.show_stats).toBe(true);
  expect(config.entities).toEqual([]);
  expect(config.colors).toEqual({});
});

it('accepte de masquer le bandeau Min · Moy · Max', () => {
  expect(normalizeGraphConfig({ show_stats: false }).show_stats).toBe(false);
  expect(() => normalizeGraphConfig({ show_stats: 'oui' })).toThrow();
});

it('accepte les entités, couleurs et le type de graphique', () => {
  const config = normalizeGraphConfig({ chart_type: 'bar', hours_to_show: 24, entities: ['sensor.a', 'sensor.a', 'sensor.b'], colors: { 'sensor.a': '#ff0000' } });
  expect(config.chart_type).toBe('bar');
  expect(config.hours_to_show).toBe(24);
  expect(config.entities).toEqual(['sensor.a', 'sensor.b']);
  expect(config.colors).toEqual({ 'sensor.a': '#ff0000' });
});

it('rejette les configurations invalides', () => {
  for (const input of [{ hours_to_show: 0 }, { hours_to_show: 200 }, { chart_type: 'pie' }, { entities: 'sensor.a' }, { entities: [''] }, { colors: { a: 3 } }, { colors: [] }, { grid_options: [] }]) {
    expect(() => normalizeGraphConfig(input)).toThrow();
  }
});

it('répartit la palette par défaut et respecte les couleurs choisies', () => {
  expect(defaultSeriesColor(0)).toBe(GRAPH_PALETTE[0]);
  expect(defaultSeriesColor(GRAPH_PALETTE.length)).toBe(GRAPH_PALETTE[0]);
  const config = normalizeGraphConfig({ colors: { 'sensor.a': '#123456' } });
  expect(seriesColor(config, 'sensor.a', 1)).toBe('#123456');
  expect(seriesColor(config, 'sensor.b', 1)).toBe(GRAPH_PALETTE[1]);
});

it('configure les plages pdN à ombrer (pastel)', () => {
  const config = normalizeGraphConfig({ shades: { 'switch.a': '', 'switch.b': '#dbeafe' } });
  expect(config.shades).toEqual({ 'switch.a': '', 'switch.b': '#dbeafe' });
  expect(normalizeGraphConfig({}).shades).toEqual({});
  expect(defaultShadeColor(0)).toBe(SHADE_PALETTE[0]);
  expect(shadeColor(config, 'switch.a', 0)).toBe(SHADE_PALETTE[0]);
  expect(shadeColor(config, 'switch.b', 1)).toBe('#dbeafe');
  expect(() => normalizeGraphConfig({ shades: { a: 3 } })).toThrow();
  expect(() => normalizeGraphConfig({ shades: [] })).toThrow();
});

it('consolide les statistiques horaires en points', () => {
  const start = new Date(2026, 0, 1, 0, 0).getTime();
  const end = new Date(2026, 0, 1, 6, 0).getTime();
  const response = {
    'sensor.fio_io_ph': [
      { start: new Date(2026, 0, 1, 0, 0).getTime(), end: new Date(2026, 0, 1, 1, 0).getTime(), mean: 7.1 },
      { start: new Date(2026, 0, 1, 1, 0).getTime(), end: new Date(2026, 0, 1, 2, 0).getTime(), mean: 7.2 },
      { start: new Date(2026, 0, 1, 2, 0).getTime(), end: new Date(2026, 0, 1, 3, 0).getTime(), min: 7.0, max: 7.4 }
    ]
  };
  expect(statisticsPoints(response, start, end)).toEqual([
    [new Date(2026, 0, 1, 0, 0).getTime(), 7.1],
    [new Date(2026, 0, 1, 1, 0).getTime(), 7.2],
    [new Date(2026, 0, 1, 2, 0).getTime(), 7.4]
  ]);
  expect(statisticsPoints({ 'sensor.a': [{ start: end + 3600000, mean: 5 }] }, start, end)).toEqual([]);
  expect(statisticsPoints({ 'sensor.a': [{ start: start - 7200000, mean: 5 }] }, start, end)).toEqual([[start, 5]]);
  for (const bad of [undefined, null, [], { 'sensor.a': 'x' }, { 'sensor.a': [{ mean: 5 }] }]) expect(statisticsPoints(bad, start, end)).toEqual([]);
});

it('choisit la résolution de consolidation selon la période', () => {
  expect(consolidationMs(1)).toBe(300000);
  expect(consolidationMs(6)).toBe(300000);
  expect(consolidationMs(12)).toBe(600000);
  expect(consolidationMs(24)).toBe(900000);
  expect(consolidationMs(48)).toBe(3600000);
  expect(consolidationMs(168)).toBe(3600000);
});

it('regroupe les points par bucket en moyenne, sans faux zéro', () => {
  const t0 = new Date(2026, 0, 1, 0, 0).getTime();
  const points: HistoryPoint[] = [
    [t0, 1], [t0 + 300000, 3], [t0 + 600000, null], [t0 + 900000, 5], [t0 + 1200000, 7]
  ];
  expect(consolidatePoints(points, 600000)).toEqual([
    [t0, 2], [t0 + 600000, 5], [t0 + 1200000, 7]
  ]);
  expect(consolidatePoints([], 600000)).toEqual([]);
  expect(consolidatePoints([[t0, null]], 600000)).toEqual([]);
  expect(consolidatePoints(points, 300000)).toEqual([
    [t0, 1], [t0 + 300000, 3], [t0 + 900000, 5], [t0 + 1200000, 7]
  ]);
});

it('calcule les intervalles allumés pour l’ombrage', () => {
  const at = (min: number) => new Date(2026, 0, 1, 0, min).toISOString();
  const response = [[
    { state: 'off', last_changed: at(0) },
    { state: 'on', last_changed: at(10) },
    { state: 'off', last_changed: at(30) },
    { state: 'on', last_changed: at(40) }
  ]];
  const start = new Date(2026, 0, 1, 0, 0).getTime();
  const end = new Date(2026, 0, 1, 0, 50).getTime();
  expect(onIntervals(response, start, end)).toEqual([
    [new Date(2026, 0, 1, 0, 10).getTime(), new Date(2026, 0, 1, 0, 30).getTime()],
    [new Date(2026, 0, 1, 0, 40).getTime(), end]
  ]);
  expect(onIntervals(null, start, end)).toEqual([]);
  // réponse plate (non imbriquée)
  expect(onIntervals(response[0], start, end)).toHaveLength(2);
  // dernier intervalle fermé si l'entité n'est plus allumée
  expect(onIntervals(response, start, end, false)).toEqual([
    [new Date(2026, 0, 1, 0, 10).getTime(), new Date(2026, 0, 1, 0, 30).getTime()]
  ]);
  // un seul point allumé s'étend jusqu'à la fin de la période
  const single = [[{ state: 'on', last_changed: at(5) }]];
  expect(onIntervals(single, start, end)).toEqual([[new Date(2026, 0, 1, 0, 5).getTime(), end]]);
});
