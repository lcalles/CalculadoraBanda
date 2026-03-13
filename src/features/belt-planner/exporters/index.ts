import { RowPattern } from '../types';

export function toBomCsv(bom: Record<string, number>): string {
  const lines = ['modulo,cantidad'];
  Object.entries(bom).forEach(([module, count]) => lines.push(`${module},${count}`));
  return lines.join('\n');
}

export function toSeamsCsv(rows: RowPattern[]): string {
  const lines = ['fila,juntas'];
  rows.forEach((row, index) => lines.push(`${index + 1},"${row.seams.join(' ')}"`));
  return lines.join('\n');
}

export function toPlanJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function downloadTextFile(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
