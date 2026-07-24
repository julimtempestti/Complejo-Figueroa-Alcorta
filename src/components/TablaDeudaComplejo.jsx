import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supabase, calcularEstado, mesActual, nombreMes, INICIO_ANIO, INICIO_MES } from '../lib/supabase'

function mesAnterior(anio, mes) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
}
function mesSiguiente(anio, mes) {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
}

// Cuadro de estado de pagos del complejo, con selector de mes.
//  - La columna "Estado" refleja el mes seleccionado.
//  - Morosidad y Total deuda son acumulados hasta ese mes (inclusive).
//  - La fila se pinta de rojo si tiene deuda y verde si está al día.
//  - editable = true (admin): la celda de estado es un botón para marcar
//    quién pagó y quién no en el mes seleccionado.
export default function TablaDeudaComplejo({ editable = false }) {
  const { anio: anioHoy, mes: mesHoy } = mesActual()
  const [vistaAnio, setVistaAnio] = useState(anioHoy)
  const [vistaMes, setVistaMes] = useState(mesHoy)
  const [filas, setFilas] = useState([])
  const [mesSelRow, setMesSelRow] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(null)
  const [interesActivo, setInteresActivo] = useState(false)
  const [tasaDiaria, setTasaDiaria] = useState(0)

  const cargar = useCallback(async () => {
    const [{ data: deptos }, { data: todosMeses }, { data: todosPagos }, { data: config }] = await Promise.all([
      supabase.from('departamentos').select('*').order('id'),
      supabase.from('meses').select('*').order('anio').order('mes'),
      supabase.from('pagos').select('*'),
      supabase.from('configuracion').select('clave, valor'),
    ])

    // Config de interés por morosidad
    const cfg = {}
    for (const r of config || []) cfg[r.clave] = r.valor
    const activo = cfg.interes_activo === 'true'
    const tasa = Number(cfg.interes_diario || 0)
    setInteresActivo(activo)
    setTasaDiaria(tasa)

    const mesRow = (todosMeses || []).find((m) => m.anio === vistaAnio && m.mes === vistaMes) || null
    setMesSelRow(mesRow)

    // Un mes está "facturado" (exigible) si ya pasó, o si es el mes corriente y
    // ya pasó el día 10 (antes del 10 NO cuenta como deuda).
    const hoy = new Date()
    const hoyDia = hoy.getDate()
    const hoyMs = hoy.getTime()
    const esFacturado = (m) =>
      m.anio < anioHoy ||
      (m.anio === anioHoy && m.mes < mesHoy) ||
      (m.anio === anioHoy && m.mes === mesHoy && hoyDia > 10)

    const resultado = (deptos || []).map((depto) => {
      const pagosDepto = (todosPagos || []).filter((p) => p.depto_id === depto.id)
      const pagadoTotal = pagosDepto.reduce((a, p) => a + Number(p.monto || 0), 0)

      // Total facturado (exigible) hasta hoy, meses sin pago e interés por mora.
      let facturado = 0
      let mesesAdeudados = 0
      let interes = 0
      for (const m of todosMeses || []) {
        if (!esFacturado(m)) continue
        facturado += Number(m.monto_expensa || 0)
        if (!pagosDepto.find((p) => p.mes_id === m.id)) {
          mesesAdeudados += 1
          // Interés diario sobre la cuota impaga, desde su vencimiento (día 10).
          if (activo && tasa > 0) {
            const venc = new Date(m.anio, m.mes - 1, 10).getTime()
            const dias = Math.max(0, Math.floor((hoyMs - venc) / 86400000))
            interes += Number(m.monto_expensa || 0) * (tasa / 100) * dias
          }
        }
      }

      // Cuenta corriente del depto: pagado − facturado.
      //   > 0  saldo a favor (pagó de más)
      //   < 0  debe (le falta para estar al día)
      const saldoCuenta = pagadoTotal - facturado

      // Estado del mes seleccionado en el navegador (Al día / Pendiente / Vencido).
      const pagoSel = mesRow ? pagosDepto.find((p) => p.mes_id === mesRow.id) || null : null
      const estadoSel = calcularEstado({ tienePago: Boolean(pagoSel), anio: vistaAnio, mes: vistaMes })

      return { depto, estadoSel, pagoSel, mesesAdeudados, saldoCuenta, interes: Math.round(interes) }
    })

    setFilas(resultado)
    setCargando(false)
  }, [vistaAnio, vistaMes])

  useEffect(() => {
    setCargando(true)
    cargar()
    const canal = supabase
      .channel('deuda-complejo-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meses' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [cargar])

  function irAnterior() {
    const { anio, mes } = mesAnterior(vistaAnio, vistaMes)
    setVistaAnio(anio)
    setVistaMes(mes)
  }
  function irSiguiente() {
    const { anio, mes } = mesSiguiente(vistaAnio, vistaMes)
    setVistaAnio(anio)
    setVistaMes(mes)
  }
  function irMesActual() {
    setVistaAnio(anioHoy)
    setVistaMes(mesHoy)
  }

  const esHoy = vistaAnio === anioHoy && vistaMes === mesHoy
  const esInicio = vistaAnio === INICIO_ANIO && vistaMes === INICIO_MES

  // Último monto de expensa definido (para heredarlo cuando se marca un pago
  // en un mes que todavía no tiene monto propio, y no quede en $0).
  async function ultimoMontoDefinido() {
    const { data } = await supabase
      .from('meses')
      .select('monto_expensa')
      .gt('monto_expensa', 0)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(1)
      .maybeSingle()
    return Number(data?.monto_expensa || 0)
  }

  async function toggle(fila) {
    if (!editable) return
    setGuardando(fila.depto.id)
    try {
      if (fila.pagoSel) {
        const { error } = await supabase.from('pagos').delete().eq('id', fila.pagoSel.id)
        if (error) { toast.error('No se pudo actualizar'); return }
        toast.success(`${fila.depto.nombre}: marcado como pendiente`)
        cargar()
        return
      }

      // Marcar como pagado: aseguramos que exista el período con un monto válido.
      let mesRow = mesSelRow
      const fallback = await ultimoMontoDefinido()
      if (!mesRow) {
        const { data, error } = await supabase
          .from('meses')
          .insert({ anio: vistaAnio, mes: vistaMes, monto_expensa: fallback })
          .select()
          .single()
        if (error) { toast.error('No se pudo crear el período'); return }
        mesRow = data
      }

      const montoPago = Number(mesRow.monto_expensa) > 0 ? Number(mesRow.monto_expensa) : fallback

      const { error } = await supabase.from('pagos').insert({
        depto_id: fila.depto.id,
        mes_id: mesRow.id,
        fecha_pago: new Date().toISOString(),
        metodo_pago: 'efectivo',
        monto: montoPago,
        estado: 'pagado',
        registrado_por: 'admin',
      })
      if (error) { toast.error('No se pudo actualizar'); return }
      toast.success(`${fila.depto.nombre}: marcado como pagado`)
      cargar()
    } finally {
      setGuardando(null)
    }
  }

  function BadgeEstado({ estado }) {
    if (!estado) return <span className="text-slate-300 text-xs">—</span>
    if (estado === 'pagado') {
      return <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">Al día</span>
    }
    if (estado === 'vencido') {
      return <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">Vencido</span>
    }
    return <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Pendiente</span>
  }

  // La deuda total de un depto incluye el interés por mora (si está activo).
  const deudaConInteres = (f) => (f.saldoCuenta < 0 ? -f.saldoCuenta : 0) + f.interes
  const totalAdeudado = filas.reduce((a, f) => a + deudaConInteres(f), 0)
  const totalAFavor = filas.reduce((a, f) => a + (f.saldoCuenta > 0 ? f.saldoCuenta : 0), 0)
  const totalInteres = filas.reduce((a, f) => a + f.interes, 0)

  return (
    <div>
      {/* Navegador de mes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={irAnterior}
            disabled={esInicio}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition disabled:opacity-30 disabled:cursor-default"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[130px] text-center">
            {nombreMes(vistaMes, vistaAnio)}
          </span>
          <button
            onClick={irSiguiente}
            disabled={esHoy}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition disabled:opacity-30 disabled:cursor-default"
          >
            ›
          </button>
        </div>
        {!esHoy && (
          <button onClick={irMesActual} className="text-xs text-tinta hover:underline font-medium">
            Volver al mes actual
          </button>
        )}
      </div>

      {cargando ? (
        <div className="py-10 text-center text-slate-400 text-sm">Cargando estado del complejo...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-left">
                <th className="px-4 py-3 font-medium">Depto</th>
                <th className="px-4 py-3 font-medium">Estado ({nombreMes(vistaMes, vistaAnio)})</th>
                <th className="px-4 py-3 font-medium">Morosidad</th>
                <th className="px-4 py-3 font-medium text-right">Intereses</th>
                <th className="px-4 py-3 font-medium text-right">Saldo de cuenta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f) => {
                const debe = f.saldoCuenta < 0
                const aFavor = f.saldoCuenta > 0
                // Rojo = debe · Ámbar = al día pero falta el mes corriente · Verde = al día / a favor
                const colorFila = debe
                  ? 'bg-red-50'
                  : f.saldoCuenta === 0 && f.estadoSel === 'pendiente'
                    ? 'bg-amber-50'
                    : 'bg-green-50'
                return (
                  <tr key={f.depto.id} className={colorFila}>
                    <td className="px-4 py-3 font-medium text-slate-700">{f.depto.nombre}</td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <button
                          onClick={() => toggle(f)}
                          disabled={guardando === f.depto.id}
                          title="Clic para cambiar entre pagado / pendiente"
                          className="disabled:opacity-50 hover:opacity-80 transition cursor-pointer"
                        >
                          <BadgeEstado estado={f.estadoSel} />
                        </button>
                      ) : (
                        <BadgeEstado estado={f.estadoSel} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {f.mesesAdeudados > 0 ? (
                        <span className="text-red-600 font-medium">
                          {f.mesesAdeudados} {f.mesesAdeudados === 1 ? 'mes' : 'meses'}
                        </span>
                      ) : (
                        <span className="text-green-600">Sin deuda</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                      {f.interes > 0 ? (
                        <span className="text-amber-600">+${f.interes.toLocaleString('es-AR')}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                      {debe ? (
                        <span className="text-red-600">Debe ${deudaConInteres(f).toLocaleString('es-AR')}</span>
                      ) : aFavor ? (
                        <span className="text-green-600">A favor ${f.saldoCuenta.toLocaleString('es-AR')}</span>
                      ) : (
                        <span className="text-green-600">Al día</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-tinta border-t-2 border-slate-200">
                <td className="px-4 py-3" colSpan={3}>
                  Total adeudado al complejo
                  {totalAFavor > 0 && (
                    <span className="text-green-600 font-normal text-xs ml-2">
                      (a favor: ${totalAFavor.toLocaleString('es-AR')})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-amber-600">
                  {totalInteres > 0 ? `+$${totalInteres.toLocaleString('es-AR')}` : ''}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-red-600">
                  ${totalAdeudado.toLocaleString('es-AR')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editable && (
        <p className="text-xs text-slate-400 mt-2">
          Tocá el estado de cada depto para marcar el pago del mes seleccionado.
        </p>
      )}
    </div>
  )
}
