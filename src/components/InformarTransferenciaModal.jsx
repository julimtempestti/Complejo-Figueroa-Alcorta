import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

// El inquilino sube un comprobante; queda registrado como "pendiente" hasta
// que el admin lo confirme manualmente desde el panel de administración.
export default function InformarTransferenciaModal({ depto, mesInfo, monto, onClose, onEnviado }) {
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!mesInfo?.id) {
      toast.error('Todavía no se definió el monto de expensas de este mes')
      return
    }
    setEnviando(true)

    let comprobante_url = null
    if (archivo) {
      const ruta = `${depto.id}/${mesInfo.id}-${Date.now()}-${archivo.name}`
      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(ruta, archivo)

      if (uploadError) {
        toast.error('No se pudo subir el comprobante')
        setEnviando(false)
        return
      }
      const { data } = supabase.storage.from('comprobantes').getPublicUrl(ruta)
      comprobante_url = data.publicUrl
    }

    const { error } = await supabase.from('pagos').insert({
      depto_id: depto.id,
      mes_id: mesInfo.id,
      fecha_pago: new Date().toISOString(),
      metodo_pago: 'transferencia',
      monto,
      registrado_por: 'inquilino',
      estado: 'pendiente',
      comprobante_url,
    })

    setEnviando(false)

    if (error) {
      toast.error('No se pudo informar la transferencia')
      return
    }

    toast.success('Transferencia informada. El administrador la confirmará.')
    onEnviado?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Informar transferencia</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Comprobante (opcional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              className="w-full text-sm"
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
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
