import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

// Tres tipos de cuenta, determinados por la asociación del user_id:
//   - residente  -> existe en `departamentos` (user_id = uid)
//   - propietario -> existe en `propietarios` (user_id = uid)
//   - admin      -> no está asociado a ninguna de las dos
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [rol, setRol] = useState(null) // 'admin' | 'residente' | 'propietario'
  const [departamento, setDepartamento] = useState(null)
  const [propietario, setPropietario] = useState(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sesion) => {
      setSession(sesion)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function cargarPerfil() {
      if (!session?.user) {
        setRol(null)
        setDepartamento(null)
        setPropietario(null)
        setCargandoPerfil(false)
        return
      }

      setCargandoPerfil(true)
      const uid = session.user.id

      // ¿Residente?
      const { data: depto } = await supabase
        .from('departamentos')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle()

      if (depto) {
        setRol('residente')
        setDepartamento(depto)
        setPropietario(null)
        setCargandoPerfil(false)
        return
      }

      // ¿Propietario?
      const { data: prop } = await supabase
        .from('propietarios')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle()

      if (prop) {
        const { data: deptoProp } = await supabase
          .from('departamentos')
          .select('*')
          .eq('id', prop.depto_id)
          .maybeSingle()
        setRol('propietario')
        setPropietario(prop)
        setDepartamento(deptoProp || null)
        setCargandoPerfil(false)
        return
      }

      // Si no es residente ni propietario -> admin
      setRol('admin')
      setDepartamento(null)
      setPropietario(null)
      setCargandoPerfil(false)
    }

    if (session !== undefined) cargarPerfil()
  }, [session])

  const cerrarSesion = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{
        session,
        usuario: session?.user ?? null,
        rol,
        departamento,
        propietario,
        esAdmin: rol === 'admin',
        esResidente: rol === 'residente',
        esPropietario: rol === 'propietario',
        cargando: session === undefined || cargandoPerfil,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
