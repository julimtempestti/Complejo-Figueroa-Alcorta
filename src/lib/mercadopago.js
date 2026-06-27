// Helper de frontend para iniciar un pago con MercadoPago Checkout Pro.
//
// El flujo real es:
// 1. El frontend llama a nuestro endpoint backend /api/create-preference
//    (ver api/create-preference.js) pasando depto_id, mes_id y monto.
// 2. El backend usa el MP_ACCESS_TOKEN (variable de entorno, NUNCA en el
//    frontend) para crear una "preference" contra la API de MercadoPago.
// 3. El backend devuelve el "init_point" (URL de checkout) y el frontend
//    redirige al usuario ahí.
// 4. MercadoPago notifica el resultado del pago a /api/mp-webhook, que
//    registra el pago en la tabla `pagos` de Supabase usando la
//    SUPABASE_SERVICE_ROLE_KEY (también solo en el backend).
//
// La VITE_MP_PUBLIC_KEY se usa solo si en el futuro se quiere embeber el
// botón de pago con el SDK de MercadoPago.js en el cliente; con Checkout Pro
// "redirect" no es estrictamente necesaria, pero se deja configurada.

import { DEMO_MODE } from './supabase'

export async function iniciarPagoMercadoPago({ deptoId, mesId, monto, descripcion }) {
  if (DEMO_MODE) {
    throw new Error('Modo demo: el pago con MercadoPago no está disponible en la vista previa.')
  }

  const respuesta = await fetch('/api/create-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deptoId, mesId, monto, descripcion }),
  })

  if (!respuesta.ok) {
    throw new Error('No se pudo generar el link de pago de MercadoPago')
  }

  const { init_point } = await respuesta.json()
  window.location.href = init_point
}
