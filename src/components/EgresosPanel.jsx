import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

// Módulo de egresos / gastos del complejo.
//   editable = true  -> vista del administrador (registra, edita y borra)
//   editable = false -> vista del residente (solo lectura)
//
// Las categorías están agrupadas en servicios fijos y gastos eventuales,
// según los ejemplos pedidos (luz, agua, limpieza, ascensores / electricista,
// cerrajero, etc.).
const GRUPOS = [
  { grupo: 'Servicios', items: ['Luz', 'Agua', 'Gas', 'Limpieza', 'Ascensores'] },
  { grupo: 'Eventuales', items: ['Electricista', 'Cerrajero', 'Plomero', 'Mantenimiento'] },
  { grupo: 'Otros', items: ['Administración', 'Seguro', 'Otro'] },
]

export default function EgresosPanel({ editable = false }) {
  const [egresos, setEgresos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [categoria, setCategoria] = useState('Luz')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('egresos').select('*').order('fecha', { ascending: false })
    setEgresos(data || [])
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('egresos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'egresos' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [cargar])

  async function registrar(e) {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    setEnviando(true)
    const { error } = await supabase.from('egresos').insert({
      fecha,
      categoria,
      descripcion,
      monto: Number(monto),
      registrado_por: 'admin',
    })
    setEnviando(false)
    if (error) {
      toast.error('No se pudo registrar el egreso')
      return
    }
    toast.success('Egreso registrado')
    setDescripcion('')
    setMonto('')
    cargar()
  }

  async function eliminar(id) {
    const { error } = await supabase.from('egresos').delete().eq('id', id)
    if (error) {
      toast.error('No se pudo eliminar')
      return
    }
    toast.success('Egreso eliminado')
    cargar()
  }

  const total = egresos.reduce((acc, e) => acc + Number(e.monto || 0), 0)

  if (cargando) {
    return <div className="py-20 text-center text-slate-400 text-sm">Cargando egresos...</div>
  }

  return (
    <section>
      <h2 className="font-serif text-2xl text-tinta mb-1">
        {editable ? 'Registro de egresos' : 'Gastos del complejo'}
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        {editable
          ? 'Registrá los pagos de servicios y gastos eventuales del complejo.'
          : 'Egresos registrados por la administración (solo lectura).'}
      </p>

      {editable && (
        <form
          onSubmit={registrar}
          className="bg-white border border-tinta/10 rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
        >
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            >
              {GRUPOS.map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map((it) => (
                    <option key={it} value={it}>{it}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Factura de luz mayo"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Monto</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={enviando}
              className="bg-tinta hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
            >
              {enviando ? 'Registrando...' : '+ Registrar egreso'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-tinta/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Monto</th>
              {editable && <th className="px-4 py-3 font-medium w-12"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {egresos.length === 0 && (
              <tr>
                <td colSpan={editable ? 5 : 4} className="px-4 py-6 text-center text-slate-400">
                  No hay egresos registrados todavía
                </td>
              </tr>
            )}
            {egresos.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(e.fecha).toLocaleDateString('es-AR')}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">
                    {e.categoria}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.descripcion || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-tinta whitespace-nowrap">
                  ${Number(e.monto).toLocaleString('es-AR')}
                </td>
                {editable && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => eliminar(e.id)}
                      aria-label="Eliminar egreso"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 w-8 h-8 rounded-lg flex items-center justify-center transition"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {egresos.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-medium text-tinta">
                <td className="px-4 py-3" colSpan={3}>
                  Total de egresos
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  ${total.toLocaleString('es-AR')}
                </td>
                {editable && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
