export type RoundingMode = 'round' | 'floor' | 'ceil';

export type SegmentRole = 'edge-left' | 'inner' | 'edge-right';

export interface Segment {
  size: number;
  role: SegmentRole;
  kind: 'normal' | 'pusher';
}

export interface RowPattern {
  segments: Segment[];
  seams: number[];
  score: number;
}

export interface FlightConfig {
  enabled: boolean;
  mode: 'rows' | 'distance';
  stepRows: number;
  offsetRows: number;
  stepInches: number;
  offsetInches: number;
}

export interface PlannerInput {
  pitchInches: number;
  linkIncrementInches: number;
  widthInches: number;
  lengthInches: number;
  roundingMode: RoundingMode;
  edgesNormal: number[];
  innerNormal: number[];
  edgesPusher: number[];
  innerPusher: number[];
  flightConfig: FlightConfig;
}

export interface PlanResult {
  widthLinks: number;
  realWidthInches: number;
  rowsCount: number;
  patternsNormal: RowPattern[];
  patternsPusher: RowPattern[];
  rows: RowPattern[];
  pusherRows: Set<number>;
  warnings: string[];
  uniqueSeamSets: number;
  bom: Record<string, number>;
}
