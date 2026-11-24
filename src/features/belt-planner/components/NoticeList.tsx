import { Info, TriangleAlert } from 'lucide-react';
import { PlanNotice } from '../types';

/** Avisos del cálculo: advertencias primero (requieren acción) y luego ajustes informativos. */
export function NoticeList({ notices }: { notices: readonly PlanNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <ul aria-label="Avisos del cálculo" className="space-y-1.5">
      {notices.map((notice) => {
        const isWarning = notice.level === 'warning';
        const Icon = isWarning ? TriangleAlert : Info;
        return (
          <li
            key={notice.message}
            className={`flex gap-2.5 border-l-4 px-3 py-2 text-sm ${isWarning ? 'border-alert bg-alert-soft' : 'border-primary/60 bg-info-soft'}`}
          >
            <Icon aria-hidden="true" size={18} className={`mt-0.5 shrink-0 ${isWarning ? 'text-alert' : 'text-primary'}`} />
            <span>
              <span className="sr-only">{isWarning ? 'Advertencia: ' : 'Nota: '}</span>
              {notice.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
