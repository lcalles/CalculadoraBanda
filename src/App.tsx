import { useCallback, useState } from 'react';
import { CatalogIntent, CatalogPage } from './features/belt-catalog/components/CatalogPage';
import { useBeltCatalog } from './features/belt-catalog/hooks/useBeltCatalog';
import { BeltCatalogEntry } from './features/belt-catalog/types';
import { ParametersPanel } from './features/belt-planner/components/ParametersPanel';
import { PlanView } from './features/belt-planner/components/PlanView';
import { useBeltPlanner } from './features/belt-planner/hooks/useBeltPlanner';
import { useHashView } from './hooks/useHashView';

type View = 'calculadora' | 'catalogo';
const VIEWS: Record<string, View> = { '': 'calculadora', catalogo: 'catalogo' };

const NAV_ITEMS: { view: View; href: string; label: string }[] = [
  { view: 'calculadora', href: '#/', label: 'Calculadora' },
  { view: 'catalogo', href: '#/catalogo', label: 'Catálogo de bandas' }
];

export function App() {
  const catalog = useBeltCatalog();
  const planner = useBeltPlanner(catalog.findById);
  const [view, navigate] = useHashView(VIEWS, 'calculadora');
  const [catalogIntent, setCatalogIntent] = useState<CatalogIntent | null>(null);
  const { form } = planner;
  const calculatorModules = {
    edgesNormal: form.edgesNormal,
    innerNormal: form.innerNormal,
    edgesPusher: form.edgesPusher,
    innerPusher: form.innerPusher
  };

  const clearIntent = useCallback(() => setCatalogIntent(null), []);

  const showInCatalog = (entryId: string) => {
    setCatalogIntent({ kind: 'edit', entryId });
    navigate('catalogo');
  };

  const saveToCatalog = () => {
    setCatalogIntent({
      kind: 'new',
      draft: {
        pitchInches: form.pitchInches,
        linkIncrementInches: form.linkIncrementInches,
        hasModules: true,
        modules: calculatorModules
      }
    });
    navigate('catalogo');
  };

  const applyEntry = (entry: BeltCatalogEntry) => {
    planner.selectCatalogEntry(entry);
    navigate('calculadora');
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2"
      >
        Ir al contenido
      </a>
      <header className="border-b border-line bg-surface print:border-b-2 print:border-ink">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-end justify-between gap-x-6 gap-y-1 px-4 pt-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 pb-3">
            <h1 className="font-display text-xl font-bold">Armado de banda modular</h1>
            <p className="text-sm text-ink-muted print:hidden">Convierte las medidas en filas, juntas y lista de materiales para producción.</p>
          </div>
          <nav aria-label="Secciones" className="flex gap-1 print:hidden">
            {NAV_ITEMS.map((item) => {
              const current = item.view === view;
              return (
                <a
                  key={item.view}
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors duration-150 ${
                    current ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      {view === 'catalogo' ? (
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1680px] px-4 py-4 outline-none">
          <CatalogPage
            catalog={catalog}
            selectedEntryId={planner.selectedEntry?.id ?? null}
            calculatorModules={calculatorModules}
            intent={catalogIntent}
            onIntentHandled={clearIntent}
            onUseEntry={applyEntry}
          />
        </main>
      ) : (
        <div className="mx-auto grid max-w-[1680px] gap-4 px-4 py-4 lg:grid-cols-[22.5rem_minmax(0,1fr)] lg:items-start print:block print:p-0">
          <div className="print:hidden lg:sticky lg:top-4">
            <ParametersPanel
              planner={planner}
              catalogEntries={catalog.entries}
              onShowInCatalog={showInCatalog}
              onSaveToCatalog={saveToCatalog}
            />
          </div>
          <main id="contenido" tabIndex={-1} className="min-w-0 outline-none">
            {planner.plan ? (
              <PlanView plan={planner.plan} isStale={planner.isStale} title={planner.planTitle} />
            ) : (
              <div className="border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
                <h2 className="font-display text-xl font-semibold">Todavía no hay plan</h2>
                <p className="mt-1 text-sm text-ink-muted">Completa los parámetros de la izquierda y presiona Calcular plan.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
