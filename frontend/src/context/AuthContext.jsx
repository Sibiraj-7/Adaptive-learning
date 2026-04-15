import { createContext, useContext, useMemo, useState } from 'react'
import { clearAuth, setAuthToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [ready] = useState(true)

  const login = (nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    setAuthToken(nextToken)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    clearAuth()
  }

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      login,
      logout,
      isTeacher: user?.role === 'teacher',
      isStudent: user?.role === 'student',
    }),
    [user, token, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
