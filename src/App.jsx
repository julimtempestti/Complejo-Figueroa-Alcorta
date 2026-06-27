import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PagoResultado from './pages/PagoResultado'

function RutaPrivada({ children }) {
  const { session, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Cargando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return children
}

function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/pago/exito" element={<PagoResultado tipo="exito" />} />
      <Route path="/pago/pendiente" element={<PagoResultado tipo="pendiente" />} />
      <Route path="/pago/error" element={<PagoResultado tipo="error" />} />
      <Route
        path="/"
        element={
          <RutaPrivada>
            <Dashboard />
          </RutaPrivada>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Rutas />
    </AuthProvider>
  )
}
