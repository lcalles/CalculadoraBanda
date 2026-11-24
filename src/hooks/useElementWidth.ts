import { RefObject, useEffect, useState } from 'react';

/** Ancho de contenido de un elemento, actualizado cuando cambia su tamaño. */
export function useElementWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
