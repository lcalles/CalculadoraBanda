import { BomLine, BomRole, ModuleKind, Segment } from '../types';

const KIND_ORDER: Record<ModuleKind, number> = { normal: 0, pusher: 1 };
const ROLE_ORDER: Record<BomRole, number> = { edge: 0, 'edge-left': 0, inner: 1, 'edge-right': 2 };

/** Rol con el que se cuenta un módulo: con orillas intercambiables, izquierda y derecha son la misma pieza. */
export function bomRoleOf(segment: Pick<Segment, 'role'>, edgesInterchangeable: boolean): BomRole {
  return edgesInterchangeable && segment.role !== 'inner' ? 'edge' : segment.role;
}

/**
 * Lista de materiales: cuenta módulos por tipo de inventario, rol, tamaño y, si la pieza sale cortada,
 * el tamaño del módulo que se corta (p. ej. "10 módulos de 9L cortados a 7L").
 * Con `edgesInterchangeable` (banda bidireccional) la orilla izquierda y la derecha del mismo tamaño
 * se cuentan juntas como una sola pieza.
 * Orden: normales antes que empujador; orillas, internos; tamaño mayor primero; enteras antes que cortadas.
 */
export function buildBom(
  rows: readonly { segments: readonly Segment[] }[],
  linkIncrementInches = 0,
  edgesInterchangeable = false
): BomLine[] {
  const counts = new Map<string, BomLine>();
  rows.forEach((row) => {
    row.segments.forEach((segment) => {
      const role = bomRoleOf(segment, edgesInterchangeable);
      const key = `${segment.kind}|${role}|${segment.size}|${segment.cutFrom ?? ''}`;
      const line = counts.get(key);
      if (line) {
        line.quantity += 1;
      } else {
        counts.set(key, {
          kind: segment.kind,
          role,
          sizeLinks: segment.size,
          widthInches: segment.size * linkIncrementInches,
          ...(segment.cutFrom !== undefined ? { cutFromLinks: segment.cutFrom } : {}),
          quantity: 1
        });
      }
    });
  });

  return [...counts.values()].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      b.sizeLinks - a.sizeLinks ||
      (a.cutFromLinks ?? 0) - (b.cutFromLinks ?? 0)
  );
}

export function totalBomQuantity(bom: readonly BomLine[], kind?: ModuleKind): number {
  return bom.filter((line) => !kind || line.kind === kind).reduce((sum, line) => sum + line.quantity, 0);
}
