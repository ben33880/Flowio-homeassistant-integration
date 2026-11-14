export const GRAPH_TYPES = ['line', 'bar'] as const;
export type GraphType = typeof GRAPH_TYPES[number];
