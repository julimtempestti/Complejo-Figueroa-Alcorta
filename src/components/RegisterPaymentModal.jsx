import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase, mesActual, fechaCorta, nombreMes, ultimoMontoDefinido, insertarPagoConCuota } from '../lib/supabase'

const METODOS = ['efectivo', 'transferencia', 'otro']

export default function RegisterPaymentModal({ departamentos, deptoIdInicial, onClose, onRegistrado }) {
  const { anio, mes } = mesActual()
  const [deptoId, setDeptoId] = useState(deptoIdInicial || departamentos[0]?.id || '')
  const [anioSel, setAnioSel] = useState(anio)
  const [mesSel, setMesSel] = useState(mes)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('transferencia')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Cuando ya existe al menos un pago para ese depto+mes, guardamos los
  // registros existentes acá para pedir confirmación antes de crear otro
  // (los pagos en cuotas están permitidos, pero avisamos para evitar
  // duplicados accidentales). null = sin conflicto pendiente.
  const [duplicados, setDuplicados] = useState(null) // { mesRow, existentes }

  useEffect(() => {
    async function precargarMonto() {
      const { data } = await supabase
        .from('meses')
        .select('monto_expensa')
        .eq('anio', anioSel)
        .eq('mes', mesSel)
        .maybeSingle()
      if (data) setMonto(data.monto_expensa)
    }
    precargarMonto()
  }, [anioSel, mesSel])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    setEnviando(true)

    // Buscamos el período SIN crearlo todavía: si no existe, no puede haber
    // pagos previos, así que no hay nada que confirmar.
    const { data: mesRow } = await supabase
      .from('meses')
      .select('*')
      .eq('anio', anioSel)
      .eq('mes', mesSel)
      .maybeSingle()

    if (mesRow) {
      const { data: existentes } = await supabase
        .from('pagos')
        .select('*')
        .eq('depto_id', Number(deptoId))
        .eq('mes_id', mesRow.id)
        .order('fecha_pago', { ascending: false })

      if (existentes && existentes.length > 0) {
        // Ya hay pago(s) para ese depto+mes: mostramos lo existente y pedimos
        // confirmación en vez de crear un duplicado a ciegas.
        setDuplicados({ mesRow, existentes })
        setEnviando(false)
        return
      }
    }

    await registrar(mesRow)
  }

  // Inserta el pago (creando el período si hiciera falta). Se llama tanto en el
  // flujo normal como al confirmar "registrar igual" sobre un pago existente.
  async function registrar(mesRowExistente) {
    setEnviando(true)
    let mesRow = mesRowExistente

    if (!mesRow) {
      // La cuota del período NO la define el importe del pago: heredamos el
      // último monto definido (F-02). Si no hay ninguno, como último recurso
      // usamos el monto ingresado para no crear una cuota en $0.
      const heredado = await ultimoMontoDefinido()
      const montoExpensa = heredado > 0 ? heredado : Number(monto)
      const { data: nuevoMes, error: errMes } = await supabase
        .from('meses')
        .insert({ anio: anioSel, mes: mesSel, monto_expensa: montoExpensa })
        .select()
        .single()
      if (errMes) {
        toast.error('No se pudo crear el período')
        setEnviando(false)
        return
      }
      mesRow = nuevoMes
    }

    // Snapshot de la cuota vigente del mes al momento del pago (F-03).
    const { data: pagoCreado, error } = await insertarPagoConCuota(
      {
        depto_id: Number(deptoId),
        mes_id: mesRow.id,
        fecha_pago: fecha,
        metodo_pago: metodo,
        monto: Number(monto),
        registrado_por: 'admin',
        estado: 'pagado',
        notas,
      },
      mesRow.monto_expensa,
    )

    setEnviando(false)
    setDuplicados(null)

    if (error) {
      toast.error('No se pudo registrar el pago')
      return
    }

    toast.success('Pago registrado correctamente')
    enviarReciboPorMail(pagoCreado.id)
    onRegistrado?.()
    onClose()
  }

  // Dispara el envío del recibo por mail (backend con Resend). No bloquea
  // el flujo de registro del pago si el email falla o el backend no está
  // configurado (ej. en modo demo / desarrollo local sin server.js).
  async function enviarReciboPorMail(pagoId) {
    try {
      const respuesta = await fetch('/api/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagoId }),
      })
      const resultado = await respuesta.json()
      if (resultado.sent) {
        toast.success('Recibo enviado por mail')
      } else if (resultado.reason === 'sin_email_cargado') {
        toast.error('No se pudo enviar el recibo: el depto no tiene email cargado')
      }
    } catch (err) {
      // Backend no disponible (ej. demo/dev local) — no interrumpe el flujo
      console.warn('No se pudo enviar el recibo por mail:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          {duplicados ? 'Ya existe un pago para este período' : 'Registrar pago manual'}
        </h3>

        {duplicados ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-800 font-medium">
                {departamentos.find((d) => d.id === Number(deptoId))?.nombre || 'Este depto'} ya tiene{' '}
                {duplicados.existentes.length === 1
                  ? 'un pago registrado'
                  : `${duplicados.existentes.length} pagos registrados`}{' '}
                en {nombreMes(mesSel, anioSel)}:
              </p>
              <ul className="mt-2 space-y-1">
                {duplicados.existentes.map((p) => (
                  <li key={p.id} className="text-sm text-amber-900 flex justify-between gap-3">
                    <span>{fechaCorta(p.fecha_pago)} · {p.metodo_pago}</span>
                    <span className="font-semibold">${Number(p.monto || 0).toLocaleString('es-AR')}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-amber-800 mt-2 pt-2 border-t border-amber-200">
                Ya registrado:{' '}
                <span className="font-semibold">
                  ${duplicados.existentes.reduce((a, p) => a + Number(p.monto || 0), 0).toLocaleString('es-AR')}
                </span>
                {' · '}vas a agregar{' '}
                <span className="font-semibold">${Number(monto || 0).toLocaleString('es-AR')}</span>
              </p>
            </div>
            <p className="text-sm text-slate-500">
              Si es un pago en cuotas, podés continuar. Si fue un error, cancelá.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDuplicados(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => registrar(duplicados.mesRow)}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg"
              >
                {enviando ? 'Guardando...' : 'Registrar igual'}
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Departamento</label>
            <select
              value={deptoId}
              onChange={(e) => setDeptoId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            >
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Mes</label>
              <select
                value={mesSel}
                onChange={(e) => setMesSel(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Año</label>
              <input
                type="number"
                value={anioSel}
                onChange={(e) => setAnioSel(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Monto</label>
            <input
              type="number"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Método</label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm capitalize"
              >
                {METODOS.map((m) => (
                  <option key={m} value={m} className="capitalize">{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Fecha de pago</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg"
            >
              {enviando ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
