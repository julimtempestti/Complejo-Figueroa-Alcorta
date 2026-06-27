import EstadoBadge from './EstadoBadge'
import { nombreMes } from '../lib/supabase'
import { iniciarPagoMercadoPago } from '../lib/mercadopago'
import toast from 'react-hot-toast'

export default function PaymentStatusCard({
  mesActualInfo,
  estadoActual,
  montoActual,
  mesesAdeudados,
  onInformarTransferencia,
}) {
  async function handlePagarMP() {
    if (!mesActualInfo?.id) {
      toast.error('Todavía no se definió el monto de expensas de este mes')
      return
    }
    try {
      await iniciarPagoMercadoPago({
        deptoId: mesActualInfo.depto_id,
        mesId: mesActualInfo.id,
        monto: montoActual,
        descripcion: `Expensas ${nombreMes(mesActualInfo.mes, mesActualInfo.anio)}`,
      })
    } catch (err) {
      toast.error(err.message || 'No se pudo iniciar el pago con MercadoPago')
    }
  }

  return (
    <div className="bg-white border border-tinta/10 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Período actual</p>
          <h2 className="font-serif text-2xl text-tinta leading-tight">
            {nombreMes(mesActualInfo.mes, mesActualInfo.anio)}
          </h2>
        </div>
        <EstadoBadge estado={estadoActual} />
      </div>

      {mesesAdeudados > 0 && (
        <div className="mb-4 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">
          {mesesAdeudados === 1
            ? 'Tenés 1 mes anterior con expensas pendientes.'
            : `Tenés ${mesesAdeudados} meses anteriores con expensas pendientes. Por favor regularizá tu situación.`}
        </div>
      )}

      {estadoActual !== 'pagado' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handlePagarMP}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 rounded-xl transition"
          >
            Pagar con MercadoPago
          </button>
          <button
            onClick={onInformarTransferencia}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-3 rounded-xl transition"
          >
            Informar transferencia
          </button>
        </div>
      )}
    </div>
  )
}
