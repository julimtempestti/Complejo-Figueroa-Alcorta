import { useEffect, useState, useCallback } from 'react'
import { supabase, MESES_NOMBRE } from '../lib/supabase'

// Módulo de Balance del complejo (visible para admin y residentes por igual).
// Balance = ingresos por expensas + fondo acumulado − egresos.
//   - Ingresos: pagos recibidos, atribuidos al mes de la expensa.
//   - Egresos: gastos del complejo, por fecha.
//   - Fondo acumulado / balance = total ingresos − total egresos.
// Incluye un gráfico de barras (ingresos vs egresos por mes) hecho en SVG,
// sin dependencias externas.
export default function BalancePanel() {
  const [meses, setMeses] = useState([])
  const [totalIngresos, setTotalIngresos] = useState(0)
  const [totalEgresos, setTotalEgresos] = useState(0)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const [{ data: pagos }, { data: egresos }, { data: mesesData }] = await Promise.all([
      supabase.from('pagos').select('*'),
      supabase.from('egresos').select('*'),
      supabase.from('meses').select('*'),
    ])

    // Buckets de los últimos 6 meses
    const hoy = new Date()
    const buckets = []
    let y = hoy.getFullYear()
    let m = hoy.getMonth() + 1
    for (let i = 0; i < 6; i++) {
      buckets.unshift({ anio: y, mes: m, ingresos: 0, egresos: 0 })
      m -= 1
      if (m === 0) { m = 12; y -= 1 }
    }
    const idx = (a, mm) => buckets.findIndex((b) => b.anio === a && b.mes === mm)

    const mesById = {}
    for (const mm of mesesData || []) mesById[mm.id] = mm

    for (const p of pagos || []) {
      const mm = mesById[p.mes_id]
      if (!mm) continue
      const i = idx(mm.anio, mm.mes)
      if (i >= 0) buckets[i].ingresos += Number(p.monto || 0)
    }
    for (const e of egresos || []) {
      const d = new Date(e.fecha)
      const i = idx(d.getFullYear(), d.getMonth() + 1)
      if (i >= 0) buckets[i].egresos += Number(e.monto || 0)
    }

    setMeses(buckets)
    setTotalIngresos((pagos || []).reduce((a, p) => a + Number(p.monto || 0), 0))
    setTotalEgresos((egresos || []).reduce((a, e) => a + Number(e.monto || 0), 0))
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('balance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'egresos' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [cargar])

  if (cargando) {
    return <div className="py-20 text-center text-slate-400 text-sm">Cargando balance...</div>
  }

  const balance = totalIngresos - totalEgresos
  const fmt = (v) => '$' + Number(v).toLocaleString('es-AR')

  // Layout del gráfico de barras (SVG)
  const W = 640
  const H = 250
  const padTop = 16
  const padBottom = 38
  const padX = 10
  const plotH = H - padTop - padBottom
  const baseY = padTop + plotH
  const max = Math.max(1, ...meses.map((d) => Math.max(d.ingresos, d.egresos)))
  const groupW = (W - padX * 2) / meses.length
  const barW = Math.min(28, groupW * 0.3)

  return (
    <section>
      <h2 className="font-serif text-2xl text-tinta mb-1">Balance del complejo</h2>
      <p className="text-sm text-slate-500 mb-5">
        Ingresos por expensas + fondo acumulado − egresos del complejo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-tinta/10 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Ingresos totales</p>
          <p className="text-2xl font-semibold text-green-600">{fmt(totalIngresos)}</p>
        </div>
        <div className="bg-white border border-tinta/10 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Egresos totales</p>
          <p className="text-2xl font-semibold text-red-600">{fmt(totalEgresos)}</p>
        </div>
        <div className="bg-tinta text-white rounded-2xl p-5">
          <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Fondo acumulado</p>
          <p className={`text-2xl font-semibold ${balance < 0 ? 'text-red-300' : 'text-white'}`}>
            {fmt(balance)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-tinta/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-600">Ingresos vs egresos por mes</h3>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#16a34a' }} />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#dc2626' }} />
              Egresos
            </span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Gráfico de ingresos y egresos por mes">
          <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="#e2e8f0" strokeWidth="1" />
          {meses.map((d, i) => {
            const cx = padX + groupW * i + groupW / 2
            const hi = (d.ingresos / max) * plotH
            const he = (d.egresos / max) * plotH
            const etiqueta = `${MESES_NOMBRE[d.mes - 1].slice(0, 3)} ${String(d.anio).slice(2)}`
            return (
              <g key={`${d.anio}-${d.mes}`}>
                <rect x={cx - barW - 3} y={baseY - hi} width={barW} height={hi} rx="2" fill="#16a34a">
                  <title>{`Ingresos ${etiqueta}: ${fmt(d.ingresos)}`}</title>
                </rect>
                <rect x={cx + 3} y={baseY - he} width={barW} height={he} rx="2" fill="#dc2626">
                  <title>{`Egresos ${etiqueta}: ${fmt(d.egresos)}`}</title>
                </rect>
                <text x={cx} y={H - 18} textAnchor="middle" fontSize="12" fill="#94a3b8">
                  {etiqueta}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="text-xs text-slate-400 mt-2">Pasá el mouse sobre cada barra para ver el monto exacto.</p>
      </div>
    </section>
  )
}
