// Barra de progreso tipo "meta": se va llenando a medida que se recauda.
// Es el gráfico pedido para las expensas extraordinarias.
export default function MetaBar({ recaudado, objetivo }) {
  const pct = objetivo > 0 ? Math.min(100, (recaudado / objetivo) * 100) : 0
  const pctTxt = Math.round(pct)
  const fmt = (v) => '$' + Number(v).toLocaleString('es-AR')

  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1.5">
        <span className="font-semibold text-tinta">{fmt(recaudado)}</span>
        <span className="text-slate-400">Meta: {fmt(objetivo)}</span>
      </div>
      <div className="h-7 bg-slate-100 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
          style={{ width: `${pct}%` }}
        >
          {pct >= 14 && <span className="text-[11px] font-semibold text-white">{pctTxt}%</span>}
        </div>
        {pct < 14 && (
          <span className="absolute inset-0 flex items-center pl-3 text-[11px] font-semibold text-slate-500">
            {pctTxt}%
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-1.5">
        Falta recaudar {fmt(Math.max(0, objetivo - recaudado))}
      </p>
    </div>
  )
}
