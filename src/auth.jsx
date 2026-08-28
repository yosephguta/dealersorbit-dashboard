import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getMe, login as apiLogin, setToken, getToken } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)   // true while we resolve a stored token
  const [error, setError] = useState(null)

  // On mount: if a token is stored, resolve the user via /auth/me.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!getToken()) { setLoading(false); return }
      try {
        const me = await getMe()
        if (!cancelled) setUser(me)
      } catch {
        // stale/invalid token — drop it
        setToken(null)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const token = await apiLogin(email, password)
    setToken(token)
    const me = await getMe()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, setError, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
