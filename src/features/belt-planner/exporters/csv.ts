import { BomLine, PlannedRow } from '../types';
import {
  formatComposition,
  formatCompositionInches,
  formatModuleNumber,
  formatSeams,
  formatSeamsInches,
  KIND_LABELS,
  ROLE_LABELS
} from '../utils/format';

type CsvCell = string | number;

export function escapeCsvField(value: CsvCell): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV con coma como separador y saltos de línea CRLF (lo que espera Excel en Windows). */
export function toCsv(table: readonly (readonly CsvCell[])[]): string {
  return table.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

/*
 * Pulgadas primero: cada dato que va en pulgadas y en links lleva la columna en pulgadas antes.
 * Tamaños y juntas en pulgadas van redondeados al cuarto, como en pantalla; "Ancho real (in)" es la medida exacta.
 */

/**
 * `pusherLabel` (p. ej. "Streamline Flights, 4 in") se agrega al tipo de los módulos de empujador.
 * Las columnas de corte van al final y quedan vacías en las piezas enteras.
 */
export function toBomCsv(bom: readonly BomLine[], linkIncrementInches: number, pusherLabel: string | null = null): string {
  return toCsv([
    ['Tipo', 'Rol', 'Tamaño (in)', 'Tamaño (links)', 'Ancho real (in)', 'Cantidad', 'Cortado de (in)', 'Cortado de (links)'],
    ...bom.map((line) => [
      line.kind === 'pusher' && pusherLabel ? `${KIND_LABELS.pusher} (${pusherLabel})` : KIND_LABELS[line.kind],
      ROLE_LABELS[line.role],
      formatModuleNumber(line.sizeLinks, linkIncrementInches),
      line.sizeLinks,
      line.widthInches.toFixed(3),
      line.quantity,
      line.cutFromLinks !== undefined ? formatModuleNumber(line.cutFromLinks, linkIncrementInches) : '',
      line.cutFromLinks ?? ''
    ])
  ]);
}

/** Composición con el nombre en pulgadas de cada módulo; juntas en pulgadas (redondeadas al cuarto) desde la orilla izquierda. */
export function toSeamsCsv(rows: readonly PlannedRow[], linkIncrementInches: number): string {
  return toCsv([
    [
      'Fila',
      'Tipo',
      'Composición (in)',
      'Composición (links)',
      'Piezas',
      'Juntas (in)',
      'Juntas (links)',
      'Juntas alineadas con fila anterior (in)',
      'Juntas alineadas con fila anterior (links)'
    ],
    ...rows.map((row) => [
      row.rowNumber,
      KIND_LABELS[row.kind],
      formatCompositionInches(row.segments, linkIncrementInches, ' '),
      formatComposition(row.segments, ' '),
      row.pieceCount,
      formatSeamsInches(row.seams, linkIncrementInches),
      formatSeams(row.seams),
      formatSeamsInches(row.alignedSeams, linkIncrementInches),
      formatSeams(row.alignedSeams)
    ])
  ]);
}
