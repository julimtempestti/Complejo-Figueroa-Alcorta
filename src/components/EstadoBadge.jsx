const ESTILOS = {
  pagado: 'bg-green-100 text-green-700',
  parcial: 'bg-amber-100 text-amber-700',
  pendiente: 'bg-yellow-100 text-yellow-700',
  vencido: 'bg-red-100 text-red-700',
}

const ICONOS = {
  pagado: '✅',
  parcial: '◐',
  pendiente: '⏳',
  vencido: '❌',
}

const TEXTOS = {
  pagado: 'Pagado',
  parcial: 'Pago parcial',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
}

export default function EstadoBadge({ estado }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${ESTILOS[estado] || 'bg-slate-100 text-slate-600'}`}
    >
      <span>{ICONOS[estado]}</span>
      {TEXTOS[estado] || estado}
    </span>
  )
}
