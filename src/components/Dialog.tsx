import { ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Diálogo modal nativo (<dialog>): atrapa el foco, cierra con Esc y devuelve el foco
 * al control que lo abrió.
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Si el diálogo se desmonta abierto, el navegador no devuelve el foco: se hace a mano.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => opener?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="w-[min(46rem,calc(100vw-2rem))] max-w-none border border-ink/70 bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {title}
            </h2>
            <button type="button" className="btn btn-quiet h-9 w-9 p-0" onClick={onClose} aria-label="Cerrar">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
