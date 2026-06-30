import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Logo from '../components/Logo'

// Página a la que llega el usuario al hacer click en el link de "Olvidé mi
// contraseña" que le mandó Supabase por mail. El propio cliente de
// supabase-js detecta los tokens en la URL y arma una sesión temporal de
// recuperación; acá solo pedimos la nueva contraseña y la guardamos.
export default function RestablecerContrasena() {
  const { session, cargando } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmacion) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setEnviando(false)

    if (error) {
      toast.error(error.message || 'No se pudo actualizar la contraseña')
      return
    }

    toast.success('Contraseña actualizada')
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-crema px-4">
      <div className="w-full max-w-sm bg-white shadow-sm rounded-2xl p-8 border border-tinta/10">
        <Logo variant="full" className="mb-8" />

        {cargando ? (
          <p className="text-sm text-slate-400 text-center">Verificando el link...</p>
        ) : !session ? (
          <p className="text-sm text-red-500 text-center">
            Este link de recuperación no es válido o ya expiró. Pedí uno nuevo desde la
            pantalla de inicio de sesión.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500 text-center mb-5">
              Definí tu nueva contraseña.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={enviando}
                className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition"
              >
                {enviando ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
