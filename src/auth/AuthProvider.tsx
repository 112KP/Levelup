import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { signOut } from '../services/authService'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (active) {
        setSession(currentSession)
        setAuthError(error?.message ?? null)
        setLoading(false)
      }
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthError(null)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    const { error } = await signOut()

    if (error) {
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ session, loading, authError, logout }}>
      {children}
    </AuthContext.Provider>
  )
}