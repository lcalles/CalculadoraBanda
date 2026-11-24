export type RoundingMode = 'round' | 'floor' | 'ceil';

/** Tipo de inventario del que sale un módulo. */
export type ModuleKind = 'normal' | 'pusher';

/** Posición del módulo dentro de la fila. Las orillas siempre van en los extremos. */
export type SegmentRole = 'edge-left' | 'inner' | 'edge-right';

export type PusherMode = 'rows' | 'distance';

/** Unidad en la que se captura y se muestra el largo de la banda. */
export type LengthUnit = 'ft' | 'm';

export interface Segment {
  /** Ancho del módulo en links (el que queda en la banda). */
  size: number;
  role: SegmentRole;
  kind: ModuleKind;
  /** Solo en piezas cortadas: tamaño (links) del módulo elegido del que se corta. */
  cutFrom?: number;
}

/** Una forma válida de armar una fila: orilla izquierda + internos + orilla derecha. */
export interface RowPattern {
  segments: Segment[];
  /** Posiciones (en links desde la orilla izquierda) de las juntas internas de la fila. */
  seams: number[];
  /** Total de piezas de la fila, orillas incluidas. Menos es mejor (regla 8). */
  pieceCount: number;
  /** Piezas que salen de cortar un módulo más grande. A igual número de piezas, menos es mejor. */
  cutCount: number;
  /** Suma de los cuadrados de los tamaños. Más alto = piezas más grandes (regla 9). */
  sizeScore: number;
}

/**
 * De dónde salen las orillas de las filas de empujador:
 * - 'pusher': módulos de empujador que traen la orilla integrada (indent moldeado).
 * - 'normal': módulos de orilla normales; el empujador va solo en los internos.
 */
export type PusherEdgeMode = 'pusher' | 'normal';

/**
 * Cómo limita el indent a las orillas de las filas de empujador:
 * - 'minimum': sirve cualquier orilla que lo cubra (indent moldeado de la orilla de empujador o mínimo del catálogo);
 * - 'exact': solo la orilla que da ese indent, la más chica que lo cubre, en ambos lados. Es el caso del indent
 *   deseado con orillas normales: ahí la orilla es justo la franja sin flight, así que su tamaño es el indent.
 */
export type IndentFit = 'minimum' | 'exact';

export interface FlightConfig {
  enabled: boolean;
  mode: PusherMode;
  stepRows: number;
  offsetRows: number;
  stepInches: number;
  offsetInches: number;
  /** Por defecto 'pusher' (comportamiento de la versión validada). */
  edgeMode?: PusherEdgeMode;
  /** Indent de referencia (in): las orillas de las filas de empujador deben cubrirlo. null = sin restricción. */
  edgeIndentInches?: number | null;
  /** Por defecto 'minimum' (comportamiento anterior). */
  edgeIndentFit?: IndentFit;
  /** Nombre del empujador para la BOM y la hoja de armado, p. ej. "Streamline Flights, 4 in". */
  flightLabel?: string | null;
}

export interface PlannerInput {
  pitchInches: number;
  linkIncrementInches: number;
  widthInches: number;
  /** El cálculo trabaja en pulgadas; el largo se captura en pies o metros y se convierte. */
  lengthInches: number;
  /** Unidad en la que se capturó el largo; solo cambia cómo se redactan los avisos. Sin valor: pulgadas. */
  lengthUnit?: LengthUnit;
  roundingMode: RoundingMode;
  edgesNormal: number[];
  innerNormal: number[];
  edgesPusher: number[];
  innerPusher: number[];
  flightConfig: FlightConfig;
  /**
   * true: la orilla izquierda y la derecha del mismo tamaño son la misma pieza (banda sin sentido de marcha).
   * Por defecto false: se tratan como piezas distintas, igual que la versión validada.
   */
  bidirectional?: boolean;
  /**
   * true: cualquier módulo elegido (orillas e internos, normales y de empujador) se puede cortar a un tamaño
   * menor, así que cada inventario dispone de todos los tamaños por debajo de su módulo más grande.
   * Por defecto false: solo los tamaños elegidos.
   */
  allowCutModules?: boolean;
}

/** Fila ya colocada en la banda. */
export interface PlannedRow {
  /** Número de fila, empezando en 1. */
  rowNumber: number;
  /** Inventario con el que realmente se armó la fila. */
  kind: ModuleKind;
  /** La configuración pedía empujador en esta fila (puede haberse armado normal si no hubo patrón de empujador). */
  pusherRequested: boolean;
  segments: Segment[];
  seams: number[];
  pieceCount: number;
  /** Juntas que coinciden con la fila anterior (vacío en la primera fila). */
  alignedSeams: number[];
}

/** Paso y offset efectivos de los empujadores, ya convertidos a filas. */
export interface PusherSpacing {
  stepRows: number;
  offsetRows: number;
  stepInches: number;
  offsetInches: number;
}

/** Orillas que realmente se usan en las filas de empujador. */
export interface PusherEdgeRule {
  mode: PusherEdgeMode;
  /** Tamaño mínimo (links) que exige el indent; null si no hay indent. Con ajuste 'exact' es el único tamaño válido. */
  minEdgeLinks: number | null;
  indentInches: number | null;
  fit: IndentFit;
  /** Tamaños elegidos que sí cumplen el indent. */
  usableSizes: number[];
  /** Tamaños elegidos que quedan fuera: menores al indent o, con ajuste 'exact', distintos al que lo da. */
  excludedSizes: number[];
}

/** En la BOM, 'edge' agrupa orilla izquierda y derecha cuando son la misma pieza (banda bidireccional). */
export type BomRole = SegmentRole | 'edge';

export interface BomLine {
  kind: ModuleKind;
  role: BomRole;
  /** Tamaño de la pieza en la banda. */
  sizeLinks: number;
  widthInches: number;
  /** Solo en piezas cortadas: tamaño del módulo que se corta (p. ej. 10 módulos de 9L cortados a 7L). */
  cutFromLinks?: number;
  quantity: number;
}

export type NoticeLevel = 'warning' | 'info';

export interface PlanNotice {
  level: NoticeLevel;
  message: string;
}

export interface PlanStats {
  totalPieces: number;
  normalPieces: number;
  pusherPieces: number;
  /** Total de juntas que coinciden con la fila inmediata anterior. */
  alignedSeamCount: number;
  /** Filas que comparten al menos una junta con la fila anterior. */
  rowsWithAlignment: number;
  maxAlignedSeamsInRow: number;
  uniqueSeamSets: number;
  /** Filas que efectivamente se armaron con módulos de empujador. */
  pusherRowsBuilt: number;
  /** Piezas que salen de cortar un módulo más grande. */
  cutPieces: number;
}

export interface PlanResult {
  widthLinks: number;
  realWidthInches: number;
  requestedWidthInches: number;
  rowsCount: number;
  realLengthInches: number;
  requestedLengthInches: number;
  patternsNormal: RowPattern[];
  patternsPusher: RowPattern[];
  rows: PlannedRow[];
  /** Filas (1-based) donde la configuración pide empujador, en orden ascendente. */
  pusherRows: number[];
  pusherSpacing: PusherSpacing | null;
  /** null si los empujadores están desactivados. */
  pusherEdges: PusherEdgeRule | null;
  notices: PlanNotice[];
  stats: PlanStats;
  bom: BomLine[];
}
