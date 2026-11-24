const UTF8_BOM = '﻿';

/** Descarga texto como archivo. `withBom` antepone la marca UTF-8 para que Excel lea bien los acentos. */
export function downloadTextFile(filename: string, text: string, mimeType: string, withBom = false): void {
  const blob = new Blob([withBom ? UTF8_BOM + text : text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Serializa un SVG del DOM como archivo independiente. */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

/** Texto apto para nombre de archivo: sin acentos, en minúsculas y con guiones. */
function fileSlug(text: string, maxLength = Infinity): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

const TITLE_SLUG_MAX_LENGTH = 40;

/**
 * Prefijo de nombre de archivo que identifica el plan: título (si hay), banda, ancho y filas.
 * P. ej. "banda-48L-60filas", "s800-flat-top-36L-60filas" u "ov-8926-s800-flat-top-36L-60filas".
 */
export function planFilePrefix(widthLinks: number, rowsCount: number, beltLabel?: string, title?: string): string {
  const titleSlug = fileSlug(title ?? '', TITLE_SLUG_MAX_LENGTH);
  const beltSlug = fileSlug(beltLabel ?? '');
  return `${titleSlug ? `${titleSlug}-` : ''}${beltSlug || 'banda'}-${widthLinks}L-${rowsCount}filas`;
}
