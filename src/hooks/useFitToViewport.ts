import { RefObject, useLayoutEffect } from 'react';

/**
 * Publica en `--fit-max-h` la altura que le queda al elemento hasta el borde inferior de la
 * ventana (menos `marginPx`), según dónde está en pantalla. Sirve para un panel sticky: mientras
 * el encabezado de la página está a la vista el panel se acorta y su pie (los botones) no queda
 * fuera; al bajar, el panel crece hasta ocupar la ventana.
 */
export function useFitToViewport(ref: RefObject<HTMLElement>, marginPx = 16): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let frame = 0;

    const update = () => {
      frame = 0;
      const top = Math.max(element.getBoundingClientRect().top, marginPx);
      element.style.setProperty('--fit-max-h', `${Math.max(0, window.innerHeight - top - marginPx)}px`);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [ref, marginPx]);
}
