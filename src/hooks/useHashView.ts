import { useCallback, useEffect, useState } from 'react';

/**
 * Vista actual leída del hash de la URL (#/catalogo). Permite enlazar directo a una vista
 * y que el botón Atrás del navegador funcione.
 */
export function useHashView<View extends string>(views: Record<string, View>, fallback: View): [View, (view: View) => void] {
  const read = useCallback(() => views[window.location.hash.replace(/^#\/?/, '')] ?? fallback, [views, fallback]);
  const [view, setView] = useState<View>(read);

  useEffect(() => {
    const onChange = () => setView(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [read]);

  const navigate = useCallback(
    (next: View) => {
      const hash = Object.keys(views).find((key) => views[key] === next) ?? '';
      window.location.hash = `/${hash}`;
      window.scrollTo({ top: 0 });
    },
    [views]
  );

  return [view, navigate];
}
