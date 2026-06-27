import { useAuth } from '../lib/AuthContext'
import AdminPanel from '../components/AdminPanel'
import UserPanel from '../components/UserPanel'
import PropietarioPanel from '../components/PropietarioPanel'
import Logo from '../components/Logo'

const SUBTITULO = {
  admin: 'Administración',
  residente: 'Residente',
  propietario: 'Propietario',
}

export default function Dashboard() {
  const { usuario, departamento, rol, esAdmin, esResidente, esPropietario, cerrarSesion } = useAuth()

  return (
    <div className="min-h-screen bg-crema">
      <header className="bg-white border-b border-tinta/10 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="mark" className="h-9 w-auto shrink-0" />
            <div>
              <h1 className="font-serif tracking-[0.1em] text-sm sm:text-base text-tinta leading-none">
                FIGUEROA ALCORTA
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {esAdmin
                  ? SUBTITULO.admin
                  : `${SUBTITULO[rol] || ''}${departamento ? ' · ' + departamento.nombre : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">{usuario?.email}</span>
            <button
              onClick={cerrarSesion}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {esAdmin && <AdminPanel />}
        {esResidente && departamento && <UserPanel departamento={departamento} />}
        {esPropietario && <PropietarioPanel departamento={departamento} />}
        {!esAdmin && !esResidente && !esPropietario && (
          <p className="text-center text-slate-400 py-20 text-sm">
            Tu usuario no tiene un perfil asignado. Contactá al administrador.
          </p>
        )}
      </main>
    </div>
  )
}
