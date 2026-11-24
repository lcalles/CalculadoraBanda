import { ModuleKind, PlannedRow, RowPattern } from '../types';
import { CleanContinuations, findCleanContinuations, hasPattern, PatternSet, rowKindOf } from './cleanLayout';
import { sharedSeams } from './seams';

export interface LayoutParams {
  rowsCount: number;
  widthLinks: number;
  /** Patrones normales ordenados por prioridad (ver `buildPatterns`). */
  normalPatterns: readonly RowPattern[];
  /** Patrones de empujador ordenados por prioridad. Si está vacío, las filas de empujador se arman normales. */
  pusherPatterns: readonly RowPattern[];
  /** Filas (1-based) que la configuración marca como empujador. */
  pusherRowNumbers: ReadonlySet<number>;
}

/** Mejor fila que puede ir después de un patrón dado (para la mirada de una fila hacia adelante). */
interface SuccessorOutlook {
  overlap: number;
  pieceCount: number;
  cutCount: number;
  sizeScore: number;
}

/** Puntaje de una fila candidata junto con su mejor fila siguiente. Se compara en este orden. */
interface CandidateScore {
  /** Juntas coincidentes con la fila anterior (regla 11). */
  overlap: number;
  /** Juntas coincidentes entre la candidata y su mejor fila siguiente. */
  successorOverlap: number;
  /** Piezas de la candidata + piezas de su mejor fila siguiente (regla 8). */
  pairPieces: number;
  /** Piezas cortadas de la candidata + las de su mejor fila siguiente (a igual número de piezas, menos cortes). */
  pairCuts: number;
  /** Suma de cuadrados de la candidata + la de su mejor fila siguiente (regla 9). */
  pairSizeScore: number;
}

/** Patrones permitidos en una fila: su conjunto y el id con el que se memoriza. */
interface AllowedPatterns {
  id: number;
  set: PatternSet;
}

const NO_SUCCESSOR: SuccessorOutlook = { overlap: 0, pieceCount: 0, cutCount: 0, sizeScore: 0 };

function isBetterSuccessor(a: SuccessorOutlook, b: SuccessorOutlook): boolean {
  if (a.overlap !== b.overlap) return a.overlap < b.overlap;
  if (a.pieceCount !== b.pieceCount) return a.pieceCount < b.pieceCount;
  if (a.cutCount !== b.cutCount) return a.cutCount < b.cutCount;
  return a.sizeScore > b.sizeScore;
}

/** Comparación lexicográfica estricta: en empate se conserva la candidata anterior (prioridad del patrón). */
function isBetterCandidate(a: CandidateScore, b: CandidateScore): boolean {
  if (a.overlap !== b.overlap) return a.overlap < b.overlap;
  if (a.successorOverlap !== b.successorOverlap) return a.successorOverlap < b.successorOverlap;
  if (a.pairPieces !== b.pairPieces) return a.pairPieces < b.pairPieces;
  if (a.pairCuts !== b.pairCuts) return a.pairCuts < b.pairCuts;
  return a.pairSizeScore > b.pairSizeScore;
}

const hasAlignedSeams = (rows: readonly PlannedRow[]) => rows.some((row) => row.alignedSeams.length > 0);

/**
 * Coloca las filas una por una, de la primera a la última. **Nunca entrega filas con juntas alineadas:**
 * dos filas vecinas que comparten una junta hacen inválida la combinación (regla 11). Si no existe ningún
 * armado sin coincidencias, devuelve una lista vacía y el plan lo explica.
 *
 * Primera pasada (la de la versión validada), criterio para cada fila, en este orden:
 * 1. Menos juntas coincidentes con la fila anterior.
 * 2. Que la fila siguiente pueda colocarse con la menor coincidencia posible (mirada de una fila hacia adelante).
 *    Evita, por ejemplo, elegir una fila normal que deje sin opción limpia al empujador que sigue.
 * 3. Menos piezas sumando la fila y su mejor fila siguiente (regla 8).
 * 4. Menos piezas cortadas sumando las dos filas (solo cuenta con el corte de módulos activo).
 * 5. Piezas más grandes sumando la fila y su mejor fila siguiente (regla 9).
 * 6. Prioridad del patrón (orden de la lista).
 *
 * Los criterios 3 y 4 miran el par de filas y no la fila sola: un patrón que aislado tiene piezas
 * más grandes puede obligar a que la fila siguiente use más piezas para no alinear juntas.
 * Como la coincidencia entre dos filas es simétrica, en un tramo largo el mejor armado es alternar
 * el mejor par de patrones compatibles, y este criterio lo encuentra.
 *
 * Si la primera pasada deja juntas alineadas, mirar una fila adelante no bastó (p. ej. orillas fijas en las
 * filas de empujador por un indent deseado: la decisión que lo evitaba era de varias filas atrás). Entonces se
 * calcula con exactitud qué patrones permiten terminar la banda sin coincidencias desde cada fila
 * (`findCleanContinuations`) y se repite la colocación eligiendo solo entre ellos, con los mismos criterios 3 a 6.
 * Un plan que la primera pasada deja sin coincidencias no cambia.
 *
 * La elección solo depende de (patrón anterior, tipo de fila, tipo de la fila siguiente y, en la segunda
 * pasada, los conjuntos permitidos), así que se memoriza y el costo por fila es constante cuando el armado se repite.
 */
export function layoutRows(params: LayoutParams): PlannedRow[] {
  if (params.normalPatterns.length === 0 || params.rowsCount <= 0) return [];
  const oneRowAhead = placeRows(params, null);
  if (!hasAlignedSeams(oneRowAhead)) return oneRowAhead;
  const clean = findCleanContinuations(params);
  if (!clean) return [];
  const rows = placeRows(params, clean);
  // Por construcción no hay coincidencias; si las hubiera, la combinación no se entrega como válida.
  return hasAlignedSeams(rows) ? [] : rows;
}

function placeRows(params: LayoutParams, clean: CleanContinuations | null): PlannedRow[] {
  const { rowsCount, widthLinks, normalPatterns, pusherPatterns, pusherRowNumbers } = params;
  const kindOfRow = rowKindOf(params);
  const candidatesFor = (kind: ModuleKind): readonly RowPattern[] => (kind === 'pusher' ? pusherPatterns : normalPatterns);
  const allowedIn = (rowNumber: number): AllowedPatterns | null =>
    clean && rowNumber >= 1 && rowNumber <= rowsCount ? { id: clean.setIdOfRow(rowNumber), set: clean.setOfRow(rowNumber) } : null;

  const seamMasks = new Map<RowPattern, Uint8Array>();
  const seamMaskOf = (pattern: RowPattern): Uint8Array => {
    let mask = seamMasks.get(pattern);
    if (!mask) {
      mask = new Uint8Array(widthLinks + 1);
      pattern.seams.forEach((seam) => {
        if (seam >= 0 && seam <= widthLinks) mask![seam] = 1;
      });
      seamMasks.set(pattern, mask);
    }
    return mask;
  };
  const overlapWithMask = (seams: readonly number[], mask: Uint8Array): number => {
    let shared = 0;
    for (const seam of seams) shared += mask[seam] ?? 0;
    return shared;
  };

  // Mejor fila de tipo `kind` que puede colocarse después de `pattern`: menor coincidencia, luego menos piezas,
  // luego más grandes. En la segunda pasada solo entre los patrones permitidos en esa fila.
  const successorCache = new Map<RowPattern, Map<string, SuccessorOutlook>>();
  const bestSuccessor = (pattern: RowPattern, kind: ModuleKind, allowed: AllowedPatterns | null): SuccessorOutlook => {
    let byKind = successorCache.get(pattern);
    if (!byKind) {
      byKind = new Map();
      successorCache.set(pattern, byKind);
    }
    const key = `${kind}:${allowed?.id ?? 'todos'}`;
    const cached = byKind.get(key);
    if (cached) return cached;
    const mask = seamMaskOf(pattern);
    let best: SuccessorOutlook | null = null;
    candidatesFor(kind).forEach((candidate, index) => {
      if (allowed && !hasPattern(allowed.set, index)) return;
      const outlook: SuccessorOutlook = {
        overlap: overlapWithMask(candidate.seams, mask),
        pieceCount: candidate.pieceCount,
        cutCount: candidate.cutCount,
        sizeScore: candidate.sizeScore
      };
      if (!best || isBetterSuccessor(outlook, best)) best = outlook;
    });
    const result = best ?? NO_SUCCESSOR;
    byKind.set(key, result);
    return result;
  };

  const chooseRow = (
    previous: RowPattern | null,
    kind: ModuleKind,
    nextKind: ModuleKind | null,
    allowed: AllowedPatterns | null,
    nextAllowed: AllowedPatterns | null
  ): RowPattern => {
    const previousMask = previous ? seamMaskOf(previous) : null;
    const candidates = candidatesFor(kind);
    let chosen: RowPattern | null = null;
    let chosenScore: CandidateScore | null = null;
    candidates.forEach((candidate, index) => {
      const overlap = previousMask ? overlapWithMask(candidate.seams, previousMask) : 0;
      // Segunda pasada: solo patrones sin coincidencias con la fila anterior que dejan terminar la banda limpia.
      if (allowed && (overlap > 0 || !hasPattern(allowed.set, index))) return;
      const successor = nextKind ? bestSuccessor(candidate, nextKind, nextAllowed) : NO_SUCCESSOR;
      const score: CandidateScore = {
        overlap,
        successorOverlap: successor.overlap,
        pairPieces: candidate.pieceCount + successor.pieceCount,
        pairCuts: candidate.cutCount + successor.cutCount,
        pairSizeScore: candidate.sizeScore + successor.sizeScore
      };
      if (!chosenScore || isBetterCandidate(score, chosenScore)) {
        chosen = candidate;
        chosenScore = score;
      }
    });
    return chosen ?? candidates[0];
  };

  // Memo de decisiones: (patrón anterior | inicio) → "tipo>siguiente>permitidos" → patrón elegido.
  const FIRST_ROW = 'inicio';
  const decisions = new Map<RowPattern | typeof FIRST_ROW, Map<string, RowPattern>>();
  const decideRow = (
    previous: RowPattern | null,
    kind: ModuleKind,
    nextKind: ModuleKind | null,
    allowed: AllowedPatterns | null,
    nextAllowed: AllowedPatterns | null
  ): RowPattern => {
    const previousKey = previous ?? FIRST_ROW;
    let byKinds = decisions.get(previousKey);
    if (!byKinds) {
      byKinds = new Map();
      decisions.set(previousKey, byKinds);
    }
    const kindsKey = `${kind}>${nextKind ?? 'fin'}>${allowed?.id ?? '-'}>${nextAllowed?.id ?? '-'}`;
    let decision = byKinds.get(kindsKey);
    if (!decision) {
      decision = chooseRow(previous, kind, nextKind, allowed, nextAllowed);
      byKinds.set(kindsKey, decision);
    }
    return decision;
  };

  const rows: PlannedRow[] = [];
  let previous: RowPattern | null = null;

  for (let rowNumber = 1; rowNumber <= rowsCount; rowNumber += 1) {
    const kind = kindOfRow(rowNumber);
    const nextKind = rowNumber < rowsCount ? kindOfRow(rowNumber + 1) : null;
    const chosen = decideRow(previous, kind, nextKind, allowedIn(rowNumber), nextKind ? allowedIn(rowNumber + 1) : null);

    rows.push({
      rowNumber,
      kind,
      pusherRequested: pusherRowNumbers.has(rowNumber),
      segments: chosen.segments,
      seams: chosen.seams,
      pieceCount: chosen.pieceCount,
      alignedSeams: previous ? sharedSeams(chosen.seams, previous.seams) : []
    });
    previous = chosen;
  }

  return rows;
}
