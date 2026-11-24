import { BomLine, PlannedRow } from '../types';
import { formatComposition, formatSeams, KIND_LABELS, ROLE_LABELS } from '../utils/format';

type CsvCell = string | number;

export function escapeCsvField(value: CsvCell): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV con coma como separador y saltos de línea CRLF (lo que espera Excel en Windows). */
export function toCsv(table: readonly (readonly CsvCell[])[]): string {
  return table.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

/**
 * `pusherLabel` (p. ej. "Streamline Flights, 4 in") se agrega al tipo de los módulos de empujador.
 * "Cortado de (links)" va al final para no mover las columnas anteriores; vacío en las piezas enteras.
 */
export function toBomCsv(bom: readonly BomLine[], pusherLabel: string | null = null): string {
  return toCsv([
    ['Tipo', 'Rol', 'Tamaño (links)', 'Ancho (in)', 'Cantidad', 'Cortado de (links)'],
    ...bom.map((line) => [
      line.kind === 'pusher' && pusherLabel ? `${KIND_LABELS.pusher} (${pusherLabel})` : KIND_LABELS[line.kind],
      ROLE_LABELS[line.role],
      line.sizeLinks,
      line.widthInches.toFixed(3),
      line.quantity,
      line.cutFromLinks ?? ''
    ])
  ]);
}

export function toSeamsCsv(rows: readonly PlannedRow[]): string {
  return toCsv([
    ['Fila', 'Tipo', 'Composición (links)', 'Piezas', 'Juntas (links)', 'Juntas alineadas con fila anterior'],
    ...rows.map((row) => [
      row.rowNumber,
      KIND_LABELS[row.kind],
      formatComposition(row.segments, ' '),
      row.pieceCount,
      formatSeams(row.seams),
      formatSeams(row.alignedSeams)
    ])
  ]);
}
