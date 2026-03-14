import { NumberInput } from './components/NumberInput';
import { SizeSelector } from './components/SizeSelector';
import { toBomCsv, toPlanJson, toSeamsCsv, downloadTextFile } from './features/belt-planner/exporters';
import { useBeltPlanner } from './features/belt-planner/hooks/useBeltPlanner';
import { PlannerInput, RoundingMode } from './features/belt-planner/types';

const initialInput: PlannerInput = {
  pitchInches: 1,
  linkIncrementInches: 0.5,
  widthInches: 24,
  lengthInches: 60,
  roundingMode: 'round',
  edgesNormal: [2, 3],
  innerNormal: [4, 6, 8],
  edgesPusher: [2, 3],
  innerPusher: [4, 6],
  flightConfig: {
    enabled: true,
    mode: 'rows',
    stepRows: 4,
    offsetRows: 0,
    stepInches: 6,
    offsetInches: 0
  }
};

export function App() {
  const { input, setInput, result, recalculate } = useBeltPlanner(initialInput);
  const pxPerLink = 14;

  const setRounding = (mode: RoundingMode) => setInput({ ...input, roundingMode: mode });

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Calculadora de armado de banda modular</h1>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded bg-white p-4 shadow lg:col-span-2">
          <h2 className="mb-2 text-lg font-semibold">Parámetros</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Pitch (in)" value={input.pitchInches} min={0.01} step={0.01} onChange={(v) => setInput({ ...input, pitchInches: v })} />
            <NumberInput label="Incremento por link (in)" value={input.linkIncrementInches} min={0.01} step={0.01} onChange={(v) => setInput({ ...input, linkIncrementInches: v })} />
            <NumberInput label="Ancho (in)" value={input.widthInches} min={0.1} step={0.1} onChange={(v) => setInput({ ...input, widthInches: v })} />
            <NumberInput label="Largo (in)" value={input.lengthInches} min={0.1} step={0.1} onChange={(v) => setInput({ ...input, lengthInches: v })} />
          </div>

          <div className="mt-3 flex gap-2">
            {(['round', 'floor', 'ceil'] as RoundingMode[]).map((mode) => (
              <button key={mode} className={`rounded border px-2 py-1 text-sm ${input.roundingMode === mode ? 'bg-slate-900 text-white' : ''}`} onClick={() => setRounding(mode)} type="button">
                {mode}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SizeSelector label="Orillas normales" selected={input.edgesNormal} onChange={(sizes) => setInput({ ...input, edgesNormal: sizes })} />
            <SizeSelector label="Internos normales" selected={input.innerNormal} onChange={(sizes) => setInput({ ...input, innerNormal: sizes })} />
            <SizeSelector label="Orillas empujador" selected={input.edgesPusher} onChange={(sizes) => setInput({ ...input, edgesPusher: sizes })} />
            <SizeSelector label="Internos empujador" selected={input.innerPusher} onChange={(sizes) => setInput({ ...input, innerPusher: sizes })} />
          </div>

          <div className="mt-4 rounded border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={input.flightConfig.enabled}
                onChange={(event) => setInput({ ...input, flightConfig: { ...input.flightConfig, enabled: event.target.checked } })}
              />
              Activar empujadores
            </label>
            <div className="mt-2 flex gap-2 text-sm">
              <button className={`rounded border px-2 py-1 ${input.flightConfig.mode === 'rows' ? 'bg-slate-900 text-white' : ''}`} onClick={() => setInput({ ...input, flightConfig: { ...input.flightConfig, mode: 'rows' } })} type="button">Por filas</button>
              <button className={`rounded border px-2 py-1 ${input.flightConfig.mode === 'distance' ? 'bg-slate-900 text-white' : ''}`} onClick={() => setInput({ ...input, flightConfig: { ...input.flightConfig, mode: 'distance' } })} type="button">Por distancia</button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={recalculate} type="button">Calcular</button>
            <button className="rounded border px-3 py-1" onClick={() => downloadTextFile('bom.csv', toBomCsv(result.bom), 'text/csv')} type="button">Exportar BOM</button>
            <button className="rounded border px-3 py-1" onClick={() => downloadTextFile('plan.json', toPlanJson(result), 'application/json')} type="button">Exportar JSON</button>
            <button className="rounded border px-3 py-1" onClick={() => downloadTextFile('juntas.csv', toSeamsCsv(result.rows), 'text/csv')} type="button">Exportar juntas</button>
          </div>
        </div>

        <div className="rounded bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">Resumen</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            <li>Ancho links: <b>{result.widthLinks}</b></li>
            <li>Ancho real: <b>{result.realWidthInches.toFixed(3)} in</b></li>
            <li>Filas: <b>{result.rowsCount}</b></li>
            <li>Patrones normal/empujador: <b>{result.patternsNormal.length}</b> / <b>{result.patternsPusher.length}</b></li>
            <li>Sets de juntas únicos: <b>{result.uniqueSeamSets}</b></li>
            <li>Filas con empujador: <b>{result.pusherRows.size}</b></li>
          </ul>
          {result.warnings.length > 0 && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm">
              {result.warnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded bg-white p-4 shadow">
          <h3 className="font-semibold">BOM</h3>
          <table className="mt-2 w-full border text-sm">
            <thead><tr className="bg-slate-100"><th className="border p-1 text-left">Módulo</th><th className="border p-1 text-right">Cantidad</th></tr></thead>
            <tbody>
              {Object.entries(result.bom).map(([module, qty]) => (
                <tr key={module}><td className="border p-1">{module}</td><td className="border p-1 text-right">{qty}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <h3 className="font-semibold">Juntas por fila</h3>
          <div className="mt-2 max-h-64 overflow-auto text-sm">
            {result.rows.map((row, index) => (
              <p key={index}>{index + 1}. {row.seams.join(' ') || '(sin juntas internas)'}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded bg-white p-4 shadow">
        <h3 className="mb-2 font-semibold">Diagrama</h3>
        <div className="overflow-auto rounded border">
          <svg width={result.widthLinks * pxPerLink + 24} height={result.rows.length * 18 + 20}>
            {result.rows.map((row, rowIndex) => {
              let cursor = 8;
              const y = 8 + rowIndex * 18;
              return (
                <g key={rowIndex}>
                  {row.segments.map((segment, segmentIndex) => {
                    const width = segment.size * pxPerLink;
                    const fill = segment.kind === 'pusher' ? '#f59e0b' : segment.role === 'inner' ? '#60a5fa' : '#cbd5e1';
                    const node = <rect key={`${rowIndex}-${segmentIndex}`} x={cursor} y={y} width={width} height={14} fill={fill} stroke="#111827" strokeWidth="1" />;
                    cursor += width;
                    return node;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </section>
    </main>
  );
}
