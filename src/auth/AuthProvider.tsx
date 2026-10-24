import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { signOut } from '../services/authService'
import { listenForNativeOAuth } from '../services/nativeAuth'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let removeNativeOAuthListener: (() => void) | undefined

    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (active) {
        setSession(currentSession)
        setAuthError(error?.message ?? null)
        setLoading(false)
      }
    })

    void listenForNativeOAuth((message) => {
      if (active) setAuthError(message)
    }).then((removeListener) => {
      if (active) {
        removeNativeOAuthListener = removeListener
      } else {
        removeListener()
      }
    }).catch((error: unknown) => {
      if (active) {
        setAuthError(
          error instanceof Error
            ? error.message
            : 'Unable to initialize Google sign-in on this device.',
        )
      }
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthError(null)
      setLoading(false)
    })

    return () => {
      active = false
      removeNativeOAuthListener?.()
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