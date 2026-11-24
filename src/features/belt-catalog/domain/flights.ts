import { PusherEdgeMode } from '../../belt-planner/types';
import { FlightSpec } from '../types';

export interface IndentOption {
  inches: number;
  kind: 'moldeado' | 'mínimo';
  label: string;
}

/**
 * Indents de referencia que ofrece el catálogo para un empujador, según de dónde salen las orillas:
 * - con orillas de empujador, primero los indents moldeados (el módulo trae la orilla);
 * - con orillas normales, el indent mínimo sin sideguards (la orilla normal es la franja sin flight).
 */
export function indentOptions(flight: FlightSpec, edgeMode: PusherEdgeMode): IndentOption[] {
  const molded = flight.moldedIndentInches.map((inches) => ({ inches, kind: 'moldeado' as const, label: `${inches} in moldeado` }));
  const minimum = flight.minIndentInches !== null ? [{ inches: flight.minIndentInches, kind: 'mínimo' as const, label: `${flight.minIndentInches} in mínimo` }] : [];
  return edgeMode === 'pusher' ? [...molded, ...minimum] : minimum;
}

/** Indent que se propone al elegir el empujador o cambiar el tipo de orilla; null si el catálogo no da uno. */
export function defaultIndent(flight: FlightSpec, edgeMode: PusherEdgeMode): number | null {
  return indentOptions(flight, edgeMode)[0]?.inches ?? null;
}
