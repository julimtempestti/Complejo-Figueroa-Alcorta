import { createClient } from '@supabase/supabase-js'
import { createDemoClient, demoLogin } from './demo'

// Configurar estas variables en el archivo .env (ver .env.example)
// VITE_SUPABASE_URL: URL del proyecto en Supabase (Settings > API)
// VITE_SUPABASE_ANON_KEY: clave pública "anon" del proyecto (Settings > API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// MODO DEMO: se activa automáticamente mientras el .env tenga los valores
// de ejemplo (placeholder "xxxxxxxxxxxx"), o si forzás VITE_DEMO_MODE=true.
// Permite previsualizar la app con datos ficticios, sin conectar Supabase.
// Apenas completás el .env con credenciales reales, se apaga solo.
const usandoPlaceholder = !supabaseUrl || supabaseUrl.includes('xxxxxxxxxxxx')
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || usandoPlaceholder

if (!DEMO_MODE && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    'Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Revisá tu archivo .env',
  )
}

export const supabase = DEMO_MODE
  ? createDemoClient()
  : createClient(supabaseUrl, supabaseAnonKey)

export { demoLogin }

// Helpers de dominio --------------------------------------------------------

export const ESTADOS = {
  PAGADO: 'pagado',
  PARCIAL: 'parcial',
  PENDIENTE: 'pendiente',
  VENCIDO: 'vencido',
}

// Mes de inicio de la historia de la app: no se navega antes de esto.
export const INICIO_ANIO = 2025
export const INICIO_MES = 1

// La cuota vence el día 10. Regla única de vencimiento para toda la app (F-16).
export const DIA_VENCIMIENTO = 10

// Toda la app trabaja en horario de Buenos Aires, sin importar la zona horaria
// del dispositivo o del servidor donde se ejecute (F-08).
export const TZ = 'America/Argentina/Buenos_Aires'

// Devuelve { anio, mes, dia } de una fecha (por defecto, ahora) en horario de
// Buenos Aires. Evita el corrimiento de día/mes por zona horaria.
export function partesBA(date = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const val = (t) => Number(partes.find((x) => x.type === t)?.value)
  return { anio: val('year'), mes: val('month'), dia: val('day') }
}

export const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function mesActual() {
  const { anio, mes } = partesBA()
  return { anio, mes }
}

// Estado de un mes para un depto (todo en horario de Buenos Aires):
//   - parcial   -> hay plata registrada pero no cubre la cuota (F-07).
//   - pagado    -> cubierto.
//   - pendiente -> mes futuro/corriente sin vencer, sin pago.
//   - vencido   -> pasó el día 10 y no está cubierto.
// `cuota` y `pagado` son opcionales: si se pasan, se detecta el pago parcial.
export function calcularEstado({ tienePago, anio, mes, cuota = null, pagado = null }) {
  if (cuota != null && pagado != null && pagado > 0 && pagado < Number(cuota)) {
    return ESTADOS.PARCIAL
  }
  if (tienePago) return ESTADOS.PAGADO

  const { anio: ha, mes: hm, dia: hd } = partesBA()
  const esFuturo = anio > ha || (anio === ha && mes > hm)
  if (esFuturo) return ESTADOS.PENDIENTE
  const esPasado = anio < ha || (anio === ha && mes < hm)
  if (esPasado) return ESTADOS.VENCIDO
  // Mes corriente: vence el día 10.
  return hd > DIA_VENCIMIENTO ? ESTADOS.VENCIDO : ESTADOS.PENDIENTE
}

export function nombreMes(mes, anio) {
  return `${MESES_NOMBRE[mes - 1]} ${anio}`
}

// Devuelve { anio, mes } de una fecha para agruparla por mes. Las fechas "solo
// día" (YYYY-MM-DD) se toman tal cual (sin corrimiento); los timestamps con
// zona se convierten a horario de Buenos Aires (F-08).
export function anioMesBA(valor) {
  const s = String(valor)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { anio: Number(s.slice(0, 4)), mes: Number(s.slice(5, 7)) }
  }
  const { anio, mes } = partesBA(new Date(s))
  return { anio, mes }
}

// Devuelve el último monto de expensa definido (> 0), para heredarlo cuando se
// registra un pago en un mes que todavía no tiene monto propio. Así la cuota de
// un período NUNCA queda definida por el importe de un pago suelto (ver F-02).
export async function ultimoMontoDefinido() {
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

// Inserta un pago guardando un "snapshot" de la cuota vigente del mes
// (monto_cuota). Ese snapshot congela la deuda histórica: si más adelante se
// edita el monto del mes, los meses ya pagados no se recalculan (ver F-03).
// Si la columna todavía no existe en la base (migración no aplicada), reintenta
// sin ella para no romper el registro de pagos.
export async function insertarPagoConCuota(payload, montoCuota) {
  const conSnapshot =
    montoCuota != null && Number(montoCuota) > 0
      ? { ...payload, monto_cuota: Number(montoCuota) }
      : payload
  let res = await supabase.from('pagos').insert(conSnapshot).select().single()
  if (res.error && /monto_cuota/i.test(res.error.message || '')) {
    // La columna no existe todavía: registramos el pago igual, sin snapshot.
    res = await supabase.from('pagos').insert(payload).select().single()
  }
  return res
}

// Cuota efectiva de un depto para un mes: si alguno de sus pagos de ese mes
// tiene snapshot (monto_cuota), usamos ese valor (congelado); si no, el monto
// vigente del mes. `pagosMes` son los pagos del depto para ESE mes.
export function cuotaEfectiva(pagosMes, montoMesVigente) {
  const conSnap = (pagosMes || []).find((p) => p.monto_cuota != null)
  if (conSnap) return Number(conSnap.monto_cuota)
  return Number(montoMesVigente || 0)
}

// Muestra la fecha de un pago en dd/mm/aaaa evitando el corrimiento de día por
// zona horaria: los valores "solo fecha" (YYYY-MM-DD) o guardados como
// medianoche UTC se muestran tal cual (un pago del 1/7 no se ve como 30/6).
export function fechaCorta(valor) {
  if (!valor) return '-'
  const s = String(valor)
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const esDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s)
  const esMedianocheUTC = /T00:00:00(\.\d+)?(Z|\+00:?00)$/.test(s)
  return d.toLocaleDateString('es-AR', esDateOnly || esMedianocheUTC ? { timeZone: 'UTC' } : undefined)
}
