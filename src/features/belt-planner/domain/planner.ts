import { BomLine, FlightConfig, PlanNotice, PlannedRow, PlannerInput, PlanResult, PlanStats, RowPattern } from '../types';
import { formatCount, formatInches, formatLength, formatPlainNumber, LENGTH_UNIT_NAMES, ROUNDING_LABELS } from '../utils/format';
import { buildBom, totalBomQuantity } from './bom';
import { firstBlockedRow } from './cleanLayout';
import { layoutRows } from './layout';
import { moduleSupply } from './cuts';
import { buildPatterns, PatternOptions } from './patterns';
import { computePusherRows, pusherEdgeSupply, resolvePusherEdges, resolvePusherSpacing } from './pushers';
import { sharedSeams } from './seams';
import { calculateRows, inchesToLength, roundLinks } from './units';

// Reexportaciones para que los consumidores existentes sigan importando desde `planner`.
export { buildBom, totalBomQuantity } from './bom';
export { combinationsForTarget, combinationsOfPieceCount, normalizeSizes } from './combinations';
export { layoutRows } from './layout';
export { brickRotations, buildPatterns, comparePatterns, createRowPattern, rotateInnerModules } from './patterns';
export type { PatternOptions } from './patterns';
export { computePusherRows, resolvePusherEdges, resolvePusherSpacing } from './pushers';
export { calculateSeams, countSharedSeams, sharedSeams } from './seams';
export { calculateRows, minimumLinksFor, roundLinks, snapNearInteger } from './units';

const MEASURE_TOLERANCE = 1e-9;

function computeStats(rows: readonly PlannedRow[], bom: readonly BomLine[]): PlanStats {
  let alignedSeamCount = 0;
  let rowsWithAlignment = 0;
  let maxAlignedSeamsInRow = 0;
  rows.forEach((row) => {
    const aligned = row.alignedSeams.length;
    alignedSeamCount += aligned;
    if (aligned > 0) rowsWithAlignment += 1;
    maxAlignedSeamsInRow = Math.max(maxAlignedSeamsInRow, aligned);
  });

  return {
    totalPieces: totalBomQuantity(bom),
    normalPieces: totalBomQuantity(bom, 'normal'),
    pusherPieces: totalBomQuantity(bom, 'pusher'),
    alignedSeamCount,
    rowsWithAlignment,
    maxAlignedSeamsInRow,
    uniqueSeamSets: new Set(rows.map((row) => row.seams.join(','))).size,
    pusherRowsBuilt: rows.filter((row) => row.kind === 'pusher').length,
    cutPieces: bom.filter((line) => line.cutFromLinks !== undefined).reduce((sum, line) => sum + line.quantity, 0)
  };
}

/** Juntas presentes en todos los patrones: ninguna elección de fila puede evitar que coincidan. */
function seamsSharedByAllPatterns(patterns: readonly RowPattern[]): number[] {
  if (patterns.length === 0) return [];
  return patterns.slice(1).reduce((shared, pattern) => sharedSeams(shared, pattern.seams), [...patterns[0].seams]);
}

function describeRequestedSpacing(config: FlightConfig, value: 'step' | 'offset'): string {
  if (config.mode === 'rows') {
    const rows = value === 'step' ? config.stepRows : config.offsetRows;
    return formatCount(rows, 'fila', 'filas');
  }
  return `${formatPlainNumber(value === 'step' ? config.stepInches : config.offsetInches)} in`;
}

const joinPositions = (seams: readonly number[]) =>
  seams.length === 1 ? `${seams[0]}` : `${seams.slice(0, -1).join(', ')} y ${seams[seams.length - 1]}`;

/**
 * Explica por qué no hay armado sin juntas alineadas (combinación inválida): en qué fila se traba y,
 * si se puede saber, qué juntas lo obligan.
 */
function describeSeamConflict(input: PlannerInput, plan: Omit<PlanResult, 'notices'>, blockedRow: number | null): string {
  const { patternsNormal, patternsPusher, pusherEdges } = plan;
  const blockedRowIsPusher = blockedRow !== null && plan.pusherRows.includes(blockedRow) && patternsPusher.length > 0;
  const where =
    blockedRow !== null
      ? ` Desde la fila 1 no se puede llegar a la fila ${blockedRow}${blockedRowIsPusher ? ' (de empujador)' : ''} sin que alguna fila comparta juntas con la anterior.`
      : '';

  const causes: string[] = [];
  const pusherRowsBuilt = patternsPusher.length > 0 && plan.pusherRows.length > 0;
  const forcedPusher = pusherRowsBuilt ? seamsSharedByAllPatterns(patternsPusher) : [];
  if (forcedPusher.length > 0) {
    const fixedEdges =
      pusherEdges?.fit === 'exact' && pusherEdges.minEdgeLinks
        ? ` (orillas fijas de ${pusherEdges.minEdgeLinks}L por el indent deseado de ${formatPlainNumber(pusherEdges.indentInches!)} in)`
        : '';
    const avoiding = patternsNormal.filter((pattern) => sharedSeams(pattern.seams, forcedPusher).length === 0).length;
    causes.push(
      `Todas las filas de empujador tienen juntas en ${joinPositions(forcedPusher)} links${fixedEdges}; ` +
        (avoiding === 0
          ? 'ningún armado normal las evita.'
          : `solo ${formatCount(avoiding, 'armado normal las evita', 'armados normales las evitan')}, de ${patternsNormal.length}.`)
    );
  }
  const forcedNormal = seamsSharedByAllPatterns(patternsNormal);
  if (forcedNormal.length > 0) {
    causes.push(`Las juntas en ${joinPositions(forcedNormal)} links aparecen en todos los armados normales, así que dos filas normales seguidas siempre las alinean.`);
  }

  return (
    `Combinación inválida: con estos tamaños no hay forma de armar las ${rowsCountText(plan.rowsCount)} sin juntas alineadas entre filas vecinas.` +
    where +
    (causes.length > 0 ? ` ${causes.join(' ')}` : '') +
    ` Agrega tamaños de orilla o internos que den otras posiciones de junta${input.flightConfig.enabled ? ', o cambia el paso de los empujadores' : ''}.`
  );
}

const rowsCountText = (rows: number) => formatCount(rows, 'fila', 'filas');

function collectNotices(
  input: PlannerInput,
  plan: Omit<PlanResult, 'notices'>,
  seamConflict: { blockedRow: number | null } | null
): PlanNotice[] {
  const warnings: string[] = [];
  const infos: string[] = [];
  const { widthLinks, rowsCount, pusherSpacing } = plan;
  const flight = input.flightConfig;

  if (plan.patternsNormal.length === 0) {
    warnings.push(
      `Ningún armado con los módulos normales seleccionados suma ${widthLinks} links. ` +
        'Revisa que las orillas quepan en el ancho y agrega tamaños de módulo interno.'
    );
  }

  const edges = plan.pusherEdges;
  const edgeKindLabel = edges?.mode === 'normal' ? 'orilla normal' : 'orilla de empujador';
  const exactIndent = edges?.fit === 'exact';
  const indentText =
    edges?.indentInches && edges.minEdgeLinks
      ? (exactIndent
          ? `el indent deseado de ${formatPlainNumber(edges.indentInches)} in pide orillas de exactamente ${edges.minEdgeLinks} links `
          : `el indent de ${formatPlainNumber(edges.indentInches)} in pide al menos ${edges.minEdgeLinks} links `) +
        `(${formatInches(edges.minEdgeLinks * input.linkIncrementInches)})`
      : '';
  const edgesBlockedByIndent = edges !== null && edges.usableSizes.length === 0 && edges.excludedSizes.length > 0;

  if (edgesBlockedByIndent && plan.patternsNormal.length > 0) {
    warnings.push(
      exactIndent
        ? `Ninguna ${edgeKindLabel} elegida da el indent: ${indentText}. ` +
            `Las filas de empujador se armaron con módulos normales; agrega la orilla de ${edges.minEdgeLinks}L.`
        : `Ninguna ${edgeKindLabel} elegida cubre el indent: ${indentText}. ` +
            `Las filas de empujador se armaron con módulos normales; elige orillas de ${edges.minEdgeLinks}L o más.`
    );
  } else if (flight.enabled && plan.patternsNormal.length > 0 && plan.patternsPusher.length === 0) {
    warnings.push(
      `Ningún armado con los módulos de empujador seleccionados suma ${widthLinks} links, ` +
        'así que las filas de empujador se armaron con módulos normales.'
    );
  }

  if (edges && edges.usableSizes.length > 0 && edges.excludedSizes.length > 0) {
    infos.push(
      `En las filas de empujador no se usan las orillas de ${edges.excludedSizes.map((size) => `${size}L`).join(', ')}: ${indentText}.`
    );
  }

  if (flight.enabled && pusherSpacing && plan.pusherRows.length === 0) {
    warnings.push(
      `Con paso de ${describeRequestedSpacing(flight, 'step')} y offset de ${describeRequestedSpacing(flight, 'offset')} ` +
        `no cae ningún empujador dentro de las ${rowsCount} filas.`
    );
  }

  if (seamConflict) warnings.push(describeSeamConflict(input, plan, seamConflict.blockedRow));

  if (plan.stats.cutPieces > 0) {
    // Una entrada por inventario y corte (orillas izquierda y derecha juntas).
    const cuts = new Map<string, { label: string; quantity: number }>();
    plan.bom.forEach((line) => {
      if (line.cutFromLinks === undefined) return;
      const key = `${line.kind}|${line.cutFromLinks}|${line.sizeLinks}`;
      const entry = cuts.get(key) ?? { label: `de ${line.cutFromLinks}L a ${line.sizeLinks}L${line.kind === 'pusher' ? ' (empujador)' : ''}`, quantity: 0 };
      entry.quantity += line.quantity;
      cuts.set(key, entry);
    });
    infos.push(
      `Se cortan ${formatCount(plan.stats.cutPieces, 'módulo', 'módulos')} a un tamaño menor: ` +
        `${[...cuts.values()].map((entry) => `${entry.quantity.toLocaleString('es-MX')} ${entry.label}`).join(', ')}. ` +
        'La lista de materiales indica de qué tamaño sale cada pieza.'
    );
  }

  if (Math.abs(plan.realWidthInches - plan.requestedWidthInches) > MEASURE_TOLERANCE) {
    infos.push(
      `El ancho quedó en ${widthLinks} links = ${formatInches(plan.realWidthInches)} ` +
        `(se pidieron ${formatPlainNumber(plan.requestedWidthInches)} in, redondeo ${ROUNDING_LABELS[input.roundingMode]}).`
    );
  }

  if (Math.abs(plan.realLengthInches - plan.requestedLengthInches) > MEASURE_TOLERANCE) {
    const unit = input.lengthUnit;
    const requested = unit
      ? `${formatPlainNumber(inchesToLength(plan.requestedLengthInches, unit), 4)} ${LENGTH_UNIT_NAMES[unit].short}`
      : `${formatPlainNumber(plan.requestedLengthInches)} in`;
    const real = unit
      ? `${formatLength(plan.realLengthInches, unit)} (${formatInches(plan.realLengthInches)})`
      : formatInches(plan.realLengthInches);
    infos.push(`El largo quedó en ${formatCount(rowsCount, 'fila', 'filas')} = ${real} (se pidieron ${requested}).`);
  }

  if (flight.enabled && pusherSpacing && flight.mode === 'distance') {
    if (Math.abs(pusherSpacing.stepInches - flight.stepInches) > MEASURE_TOLERANCE) {
      infos.push(
        `El paso de empujadores de ${formatPlainNumber(flight.stepInches)} in se ajustó a ` +
          `${formatCount(pusherSpacing.stepRows, 'fila', 'filas')} = ${formatInches(pusherSpacing.stepInches)} para coincidir con el pitch.`
      );
    }
    if (Math.abs(pusherSpacing.offsetInches - flight.offsetInches) > MEASURE_TOLERANCE) {
      infos.push(
        `El offset de empujadores de ${formatPlainNumber(flight.offsetInches)} in se ajustó a ` +
          `${formatCount(pusherSpacing.offsetRows, 'fila', 'filas')} = ${formatInches(pusherSpacing.offsetInches)}.`
      );
    }
  }

  return [
    ...warnings.map((message) => ({ level: 'warning' as const, message })),
    ...infos.map((message) => ({ level: 'info' as const, message }))
  ];
}

/**
 * Calcula el plan completo de armado: conversión a links y filas, patrones válidos por inventario,
 * colocación de filas con anti-alineación de juntas, filas de empujador, BOM y avisos.
 */
export function planBelt(input: PlannerInput, options: PatternOptions = {}): PlanResult {
  const widthLinks = roundLinks(input.widthInches, input.linkIncrementInches, input.roundingMode);
  const rowsCount = calculateRows(input.lengthInches, input.pitchInches);
  const flight = input.flightConfig;

  // Tamaños disponibles por inventario: los elegidos y, con el corte activo, los que salen de cortar uno mayor.
  const allowCuts = input.allowCutModules ?? false;
  const normalEdges = moduleSupply(input.edgesNormal, allowCuts);
  const normalInner = moduleSupply(input.innerNormal, allowCuts);
  const pusherInner = moduleSupply(input.innerPusher, allowCuts);

  const patternsNormal = buildPatterns(widthLinks, normalEdges.sizes, normalInner.sizes, 'normal', {
    ...options,
    cutFrom: { edges: normalEdges.cutFrom, inner: normalInner.cutFrom }
  });
  const pusherEdges = resolvePusherEdges(input);
  const patternsPusher = pusherEdges
    ? buildPatterns(widthLinks, pusherEdges.usableSizes, pusherInner.sizes, 'pusher', {
        ...options,
        edgeKind: pusherEdges.mode === 'pusher' ? 'pusher' : 'normal',
        cutFrom: { edges: pusherEdgeSupply(input).cutFrom, inner: pusherInner.cutFrom }
      })
    : [];

  const pusherSpacing = flight.enabled ? resolvePusherSpacing(flight, input.pitchInches) : null;
  const pusherRowSet = computePusherRows(flight, rowsCount, input.pitchInches);

  const layoutParams = {
    rowsCount,
    widthLinks,
    normalPatterns: patternsNormal,
    pusherPatterns: patternsPusher,
    pusherRowNumbers: pusherRowSet
  };
  const rows = layoutRows(layoutParams);
  // Hay patrones pero no filas: no existe armado sin juntas alineadas (combinación inválida).
  const seamConflict = patternsNormal.length > 0 && rows.length === 0 ? { blockedRow: firstBlockedRow(layoutParams) } : null;
  const bom = buildBom(rows, input.linkIncrementInches, input.bidirectional ?? false);

  const plan: Omit<PlanResult, 'notices'> = {
    widthLinks,
    realWidthInches: widthLinks * input.linkIncrementInches,
    requestedWidthInches: input.widthInches,
    rowsCount,
    realLengthInches: rowsCount * input.pitchInches,
    requestedLengthInches: input.lengthInches,
    patternsNormal,
    patternsPusher,
    rows,
    pusherRows: [...pusherRowSet].sort((a, b) => a - b),
    pusherSpacing,
    pusherEdges,
    stats: computeStats(rows, bom),
    bom
  };

  return { ...plan, notices: collectNotices(input, plan, seamConflict) };
}
