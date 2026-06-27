import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

// Panel genérico de personas por departamento (nombre + email).
// Se usa tanto para "Residentes" (tabla `residentes`) como para
// "Propietarios" (tabla `propietarios`). Cada depto puede tener uno o más.
export default function PersonasPanel({ tabla, titulo, subtitulo, etiquetaAgregar = 'Agregar' }) {
  const [deptos, setDeptos] = useState([])
  const [personas, setPersonas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardandoKey, setGuardandoKey] = useState(null)
  const tmpId = useRef(0)

  const cargar = useCallback(async () => {
    const [{ data: d }, { data: r }] = await Promise.all([
      supabase.from('departamentos').select('id, nombre').order('id'),
      supabase.from(tabla).select('*').order('id'),
    ])
    setDeptos(d || [])
    setPersonas((r || []).map((x) => ({ ...x, _key: `db-${x.id}`, _dirty: false })))
    setCargando(false)
  }, [tabla])

  useEffect(() => {
    cargar()
  }, [cargar])

  function editar(key, campo, valor) {
    setPersonas((prev) =>
      prev.map((x) => (x._key === key ? { ...x, [campo]: valor, _dirty: true } : x)),
    )
  }

  function agregar(deptoId) {
    tmpId.current += 1
    const key = `tmp-${tmpId.current}`
    setPersonas((prev) => [
      ...prev,
      { _key: key, id: null, depto_id: deptoId, nombre: '', email: '', _dirty: true },
    ])
  }

  async function guardar(r) {
    if (!r.nombre.trim()) {
      toast.error('Ingresá el nombre')
      return
    }
    setGuardandoKey(r._key)

    if (r.id) {
      const { error } = await supabase
        .from(tabla)
        .update({ nombre: r.nombre, email: r.email })
        .eq('id', r.id)
      setGuardandoKey(null)
      if (error) {
        toast.error('No se pudo guardar')
        return
      }
      toast.success('Guardado')
      setPersonas((prev) => prev.map((x) => (x._key === r._key ? { ...x, _dirty: false } : x)))
    } else {
      const { data, error } = await supabase
        .from(tabla)
        .insert({ depto_id: r.depto_id, nombre: r.nombre, email: r.email })
        .select()
        .single()
      setGuardandoKey(null)
      if (error) {
        toast.error('No se pudo guardar')
        return
      }
      toast.success('Agregado')
      setPersonas((prev) =>
        prev.map((x) => (x._key === r._key ? { ...data, _key: `db-${data.id}`, _dirty: false } : x)),
      )
    }
  }

  async function eliminar(r) {
    if (r.id) {
      const { error } = await supabase.from(tabla).delete().eq('id', r.id)
      if (error) {
        toast.error('No se pudo eliminar')
        return
      }
      toast.success('Eliminado')
    }
    setPersonas((prev) => prev.filter((x) => x._key !== r._key))
  }

  if (cargando) {
    return <div className="py-20 text-center text-slate-400 text-sm">Cargando...</div>
  }

  return (
    <section>
      <h2 className="font-serif text-2xl text-tinta mb-1">{titulo}</h2>
      <p className="text-sm text-slate-500 mb-5">{subtitulo}</p>

      <div className="space-y-4">
        {deptos.map((d) => {
          const lista = personas.filter((r) => r.depto_id === d.id)
          return (
            <div key={d.id} className="bg-white border border-tinta/10 rounded-2xl p-4 sm:p-5">
              <h3 className="font-serif text-lg text-tinta mb-3">{d.nombre}</h3>

              <div className="space-y-2">
                {lista.length === 0 && (
                  <p className="text-xs text-slate-400">Sin datos cargados todavía.</p>
                )}
                {lista.map((r) => (
                  <div key={r._key} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      value={r.nombre}
                      onChange={(e) => editar(r._key, 'nombre', e.target.value)}
                      placeholder="Nombre y apellido"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    <input
                      type="email"
                      value={r.email || ''}
                      onChange={(e) => editar(r._key, 'email', e.target.value)}
                      placeholder="email@ejemplo.com"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => guardar(r)}
                        disabled={!r._dirty || guardandoKey === r._key}
                        className="bg-tinta hover:opacity-90 text-white text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        {guardandoKey === r._key ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => eliminar(r)}
                        aria-label="Eliminar"
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 w-9 h-9 rounded-lg flex items-center justify-center transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => agregar(d.id)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-tinta hover:opacity-70 transition"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-tinta/30 text-base leading-none">
                  +
                </span>
                {etiquetaAgregar}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
