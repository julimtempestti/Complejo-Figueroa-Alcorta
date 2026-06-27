import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'

const CONTENIDO = {
  exito: {
    icono: '✅',
    titulo: '¡Pago realizado con éxito!',
    texto: 'Tu pago fue registrado. Puede tardar unos segundos en reflejarse en tu estado.',
  },
  pendiente: {
    icono: '⏳',
    titulo: 'Pago pendiente',
    texto: 'Tu pago está siendo procesado por MercadoPago. Te avisaremos cuando se confirme.',
  },
  error: {
    icono: '❌',
    titulo: 'Hubo un problema con el pago',
    texto: 'El pago no pudo completarse. Podés intentar nuevamente desde tu panel.',
  },
}

export default function PagoResultado({ tipo }) {
  const [params] = useSearchParams()
  const { icono, titulo, texto } = CONTENIDO[tipo]

  return (
    <div className="min-h-screen flex items-center justify-center bg-crema px-4">
      <div className="w-full max-w-sm bg-white shadow-sm rounded-2xl p-8 text-center border border-tinta/10">
        <Logo variant="mark" className="h-10 w-auto mx-auto mb-5" />
        <div className="text-4xl mb-3">{icono}</div>
        <h1 className="text-lg font-semibold text-slate-800 mb-2">{titulo}</h1>
        <p className="text-sm text-slate-500 mb-6">{texto}</p>
        {params.get('payment_id') && (
          <p className="text-xs text-slate-400 mb-6">ID de pago: {params.get('payment_id')}</p>
        )}
        <Link
          to="/"
          className="inline-block bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  )
}
