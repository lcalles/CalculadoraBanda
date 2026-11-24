/**
 * Juntas internas de una fila: posición acumulada (en links) después de cada módulo,
 * sin incluir el borde final de la banda. Incluye las juntas orilla/interno.
 */
export function calculateSeams(segments: readonly { size: number }[]): number[] {
  const seams: number[] = [];
  let cursor = 0;
  for (let index = 0; index < segments.length - 1; index += 1) {
    cursor += segments[index].size;
    seams.push(cursor);
  }
  return seams;
}

/** Juntas de `seams` que coinciden en posición con `referenceSeams`. */
export function sharedSeams(seams: readonly number[], referenceSeams: readonly number[]): number[] {
  const reference = new Set(referenceSeams);
  return seams.filter((seam) => reference.has(seam));
}

export function countSharedSeams(seams: readonly number[], referenceSeams: readonly number[]): number {
  return sharedSeams(seams, referenceSeams).length;
}
