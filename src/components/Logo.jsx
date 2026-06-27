import { useState } from 'react'

// El logo del complejo es la imagen que se guarda en /public/logo.png
// (la estrella). NO se modifica: se usa el archivo tal cual.
// Si el archivo todavía no está, se muestra solo el texto de la marca.
export function Marca({ className = '' }) {
  const [error, setError] = useState(false)
  if (error) return null
  return (
    <img
      src="/logo.png"
      alt="Complejo Figueroa Alcorta"
      className={className}
      onError={() => setError(true)}
    />
  )
}

export function Wordmark({ className = '' }) {
  return (
    <div className={`text-center text-tinta ${className}`}>
      <p className="font-serif tracking-[0.35em] text-xs text-tinta/60">COMPLEJO</p>
      <h1 className="font-serif text-2xl sm:text-3xl tracking-[0.1em] leading-tight">
        FIGUEROA ALCORTA
      </h1>
      <p className="font-serif tracking-[0.3em] text-[11px] text-tinta/60 mt-1">
        • GODOY CRUZ 898 •
      </p>
    </div>
  )
}

export default function Logo({ variant = 'full', className = '' }) {
  if (variant === 'mark') {
    return <Marca className={className || 'h-8 w-auto'} />
  }

  return (
    <div className={`flex flex-col items-center text-tinta ${className}`}>
      <Marca className="h-20 w-auto mb-4" />
      <Wordmark />
    </div>
  )
}
