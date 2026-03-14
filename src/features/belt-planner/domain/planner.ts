import { FlightConfig, PlannerInput, RowPattern, Segment } from '../types';

export function roundLinks(widthInches: number, incrementInches: number, mode: 'round' | 'floor' | 'ceil'): number {
  const links = widthInches / incrementInches;
  if (mode === 'floor') return Math.floor(links);
  if (mode === 'ceil') return Math.ceil(links);
  return Math.round(links);
}

export function calculateRows(lengthInches: number, pitchInches: number): number {
  return Math.max(1, Math.round(lengthInches / pitchInches));
}

export function combinationsForTarget(target: number, sizes: number[], limit = 1500): number[][] {
  const uniqueDesc = [...new Set(sizes)].filter((size) => size > 0).sort((a, b) => b - a);
  const result: number[][] = [];

  function dfs(remaining: number, index: number, current: number[]): void {
    if (result.length >= limit) return;
    if (remaining === 0) {
      result.push([...current]);
      return;
    }
    if (remaining < 0 || index >= uniqueDesc.length) return;

    const value = uniqueDesc[index];
    const maxCount = Math.floor(remaining / value);

    for (let count = maxCount; count >= 0; count -= 1) {
      for (let i = 0; i < count; i += 1) current.push(value);
      dfs(remaining - value * count, index + 1, current);
      current.length -= count;
    }
  }

  dfs(target, 0, []);
  return result;
}

export function calculateSeams(segments: Segment[]): number[] {
  const seams: number[] = [];
  let cursor = 0;
  segments.forEach((segment, index) => {
    cursor += segment.size;
    if (index < segments.length - 1 && segment.role !== 'edge-right') {
      seams.push(cursor);
    }
  });
  return seams;
}

function scorePieces(innerModules: number[]): number {
  const countPenalty = innerModules.length * 1000;
  const sizeBonus = innerModules.reduce((sum, size) => sum + size, 0);
  return countPenalty - sizeBonus;
}

export function buildPatterns(widthLinks: number, edges: number[], inners: number[], kind: 'normal' | 'pusher'): RowPattern[] {
  const patterns: RowPattern[] = [];
  const uniqueEdges = [...new Set(edges)].filter((edge) => edge > 0).sort((a, b) => b - a);

  uniqueEdges.forEach((leftEdge) => {
    uniqueEdges.forEach((rightEdge) => {
      const remaining = widthLinks - leftEdge - rightEdge;
      if (remaining < 0) return;
      if (remaining === 0) {
        patterns.push(buildPattern(leftEdge, [], rightEdge, kind));
        return;
      }
      const combos = combinationsForTarget(remaining, inners);
      combos.forEach((inner) => patterns.push(buildPattern(leftEdge, inner, rightEdge, kind)));
    });
  });

  return dedupeAndSortPatterns(patterns);
}

function buildPattern(leftEdge: number, inner: number[], rightEdge: number, kind: 'normal' | 'pusher'): RowPattern {
  const segments: Segment[] = [
    { size: leftEdge, role: 'edge-left', kind },
    ...inner.map((size) => ({ size, role: 'inner' as const, kind })),
    { size: rightEdge, role: 'edge-right', kind }
  ];

  return {
    segments,
    seams: calculateSeams(segments),
    score: scorePieces(inner)
  };
}

export function rotateInnerModules(pattern: RowPattern): RowPattern[] {
  const left = pattern.segments[0];
  const right = pattern.segments[pattern.segments.length - 1];
  const inner = pattern.segments.slice(1, -1).map((segment) => segment.size);
  if (inner.length <= 1) return [pattern];

  const variants: RowPattern[] = [];
  for (let offset = 0; offset < inner.length; offset += 1) {
    const rotated = inner.slice(offset).concat(inner.slice(0, offset));
    variants.push(buildPattern(left.size, rotated, right.size, left.kind));
  }
  return dedupeAndSortPatterns(variants);
}

function seamOverlap(a: number[], b: number[]): number {
  const setB = new Set(b);
  return a.reduce((acc, seam) => acc + (setB.has(seam) ? 1 : 0), 0);
}

function dedupeAndSortPatterns(patterns: RowPattern[]): RowPattern[] {
  const map = new Map<string, RowPattern>();
  patterns.forEach((pattern) => {
    const key = pattern.segments.map((segment) => `${segment.role}:${segment.size}`).join('|');
    if (!map.has(key)) map.set(key, pattern);
  });

  return [...map.values()].sort((a, b) => a.score - b.score);
}

export function chooseRows(patterns: RowPattern[], rowsCount: number): RowPattern[] {
  if (patterns.length === 0) return [];
  const firstVariants = rotateInnerModules(patterns[0]);
  const candidates = [...firstVariants, ...patterns];

  const rows: RowPattern[] = [candidates[0]];
  for (let row = 1; row < rowsCount; row += 1) {
    let best = candidates[0];
    let bestOverlap = Number.POSITIVE_INFINITY;
    candidates.forEach((candidate) => {
      const overlap = seamOverlap(rows[row - 1].seams, candidate.seams);
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = candidate;
      }
    });
    rows.push(best);
  }
  return rows;
}

export function computePusherRows(config: FlightConfig, rowsCount: number, pitchInches: number): Set<number> {
  const rows = new Set<number>();
  if (!config.enabled) return rows;

  if (config.mode === 'rows') {
    const step = Math.max(1, config.stepRows);
    const offset = Math.max(0, config.offsetRows);
    for (let row = 1 + offset; row <= rowsCount; row += step) rows.add(row);
    return rows;
  }

  const stepInRows = Math.max(1, Math.round(config.stepInches / pitchInches));
  const offsetRows = Math.max(0, Math.round(config.offsetInches / pitchInches));
  for (let row = 1 + offsetRows; row <= rowsCount; row += stepInRows) rows.add(row);
  return rows;
}

export function buildBom(rows: RowPattern[]): Record<string, number> {
  const bom: Record<string, number> = {};
  rows.forEach((row) => {
    row.segments.forEach((segment) => {
      const key = `${segment.kind}:${segment.role}:${segment.size}L`;
      bom[key] = (bom[key] ?? 0) + 1;
    });
  });
  return Object.fromEntries(Object.entries(bom).sort(([a], [b]) => a.localeCompare(b)));
}

export function planBelt(input: PlannerInput) {
  const widthLinks = roundLinks(input.widthInches, input.linkIncrementInches, input.roundingMode);
  const rowsCount = calculateRows(input.lengthInches, input.pitchInches);
  const patternsNormal = buildPatterns(widthLinks, input.edgesNormal, input.innerNormal, 'normal');
  const patternsPusher = input.flightConfig.enabled
    ? buildPatterns(widthLinks, input.edgesPusher, input.innerPusher, 'pusher')
    : [];

  const warnings: string[] = [];
  if (patternsNormal.length === 0) warnings.push('No hay patrón normal válido con los módulos seleccionados.');
  if (input.flightConfig.enabled && patternsPusher.length === 0) warnings.push('No hay patrón de empujador válido; se usarán filas normales.');

  const pusherRows = computePusherRows(input.flightConfig, rowsCount, input.pitchInches);
  const normalRows = chooseRows(patternsNormal, rowsCount);
  const pusherRowsBuilt = chooseRows(patternsPusher, rowsCount);

  const rows = normalRows.map((normalRow, index) => {
    const rowNumber = index + 1;
    if (pusherRows.has(rowNumber) && pusherRowsBuilt[index]) return pusherRowsBuilt[index];
    return normalRow;
  });

  const uniqueSeamSets = new Set(rows.map((row) => row.seams.join('-'))).size;

  return {
    widthLinks,
    realWidthInches: widthLinks * input.linkIncrementInches,
    rowsCount,
    patternsNormal,
    patternsPusher,
    rows,
    pusherRows,
    warnings,
    uniqueSeamSets,
    bom: buildBom(rows)
  };
}
