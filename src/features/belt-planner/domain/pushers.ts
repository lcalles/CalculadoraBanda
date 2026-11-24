import { normalizeSizes } from './combinations';
import { ModuleSupply, moduleSupply } from './cuts';
import { FlightConfig, PlannerInput, PusherEdgeRule, PusherSpacing } from '../types';
import { minimumLinksFor, snapNearInteger } from './units';

/**
 * Tamaños de orilla disponibles para las filas de empujador, antes de aplicar el indent:
 * las orillas de empujador (modo 'pusher') o las normales (modo 'normal'), más las cortadas si se permite cortar.
 */
export function pusherEdgeSupply(input: PlannerInput): ModuleSupply {
  const mode = input.flightConfig.edgeMode ?? 'pusher';
  return moduleSupply(mode === 'pusher' ? input.edgesPusher : input.edgesNormal, input.allowCutModules ?? false);
}

/**
 * Orillas de las filas de empujador:
 * - modo 'pusher': las orillas de empujador elegidas (el módulo de empujador trae la orilla);
 * - modo 'normal': las mismas orillas normales de la banda.
 * Con el corte de módulos activo también cuentan los tamaños que salen de cortar una orilla mayor.
 * Si hay indent, solo se usan las orillas que lo cumplen:
 * - ajuste 'minimum': las que lo cubren (de `minEdgeLinks` en adelante);
 * - ajuste 'exact': solo la de `minEdgeLinks`, la orilla más chica que lo cubre.
 * `excludedSizes` son las orillas elegidas que no se usan: ni cumplen el indent ni se cortan para dar una que sí.
 */
export function resolvePusherEdges(input: PlannerInput): PusherEdgeRule | null {
  const flight = input.flightConfig;
  if (!flight.enabled) return null;
  const mode = flight.edgeMode ?? 'pusher';
  const fit = flight.edgeIndentFit ?? 'minimum';
  const indentInches = flight.edgeIndentInches && flight.edgeIndentInches > 0 ? flight.edgeIndentInches : null;
  const minEdgeLinks = indentInches !== null ? minimumLinksFor(indentInches, input.linkIncrementInches) : null;
  const supply = pusherEdgeSupply(input);
  const selected = normalizeSizes(mode === 'pusher' ? input.edgesPusher : input.edgesNormal).sort((a, b) => a - b);
  const meetsIndent = (size: number) => minEdgeLinks === null || (fit === 'exact' ? size === minEdgeLinks : size >= minEdgeLinks);
  const usableSizes = [...supply.sizes].sort((a, b) => a - b).filter(meetsIndent);
  const cutSources = new Set(usableSizes.map((size) => supply.cutFrom.get(size)).filter((source) => source !== undefined));
  return {
    mode,
    minEdgeLinks,
    indentInches,
    fit,
    usableSizes,
    excludedSizes: selected.filter((size) => !meetsIndent(size) && !cutSources.has(size))
  };
}

/**
 * Convierte la configuración de empujadores a paso y offset en filas.
 * - Por filas: se redondea al entero más cercano.
 * - Por distancia: pulgadas / pitch, redondeado al entero más cercano.
 * El paso mínimo es 1 fila y el offset mínimo 0, igual que la versión validada.
 */
export function resolvePusherSpacing(config: FlightConfig, pitchInches: number): PusherSpacing {
  const rawStep = config.mode === 'rows' ? config.stepRows : config.stepInches / pitchInches;
  const rawOffset = config.mode === 'rows' ? config.offsetRows : config.offsetInches / pitchInches;
  const stepRows = Math.max(1, Math.round(snapNearInteger(rawStep || 0)));
  const offsetRows = Math.max(0, Math.round(snapNearInteger(rawOffset || 0)));
  return {
    stepRows,
    offsetRows,
    stepInches: stepRows * pitchInches,
    offsetInches: offsetRows * pitchInches
  };
}

/** Filas (1-based) que llevan empujador: la primera es 1 + offset y luego cada `paso` filas. */
export function computePusherRows(config: FlightConfig, rowsCount: number, pitchInches: number): Set<number> {
  const rows = new Set<number>();
  if (!config.enabled) return rows;
  const { stepRows, offsetRows } = resolvePusherSpacing(config, pitchInches);
  for (let row = 1 + offsetRows; row <= rowsCount; row += stepRows) rows.add(row);
  return rows;
}
