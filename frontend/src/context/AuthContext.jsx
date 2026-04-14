/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useMemo, useState } from 'react'
import { clearAuth, getAuth, setAuth } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const stored = getAuth()

  const [user, setUser] = useState(stored?.user || null)
  const [token, setToken] = useState(stored?.token || null)
  const [ready] = useState(true)

  const login = (nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    setAuth({ token: nextToken, user: nextUser })
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