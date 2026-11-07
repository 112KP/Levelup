import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabaseClient'
import { signOut } from '../services/authService'
import { listenForNativeOAuth } from '../services/nativeAuth'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let removeNativeOAuthListener: (() => void) | undefined
    let removeAppStateListener: (() => void) | undefined

    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (active) {
        setSession(currentSession)
        setAuthError(error?.message ?? null)
        setLoading(false)
      }
    })

    if (Capacitor.isNativePlatform()) {
      let appStateRevision = 0
      let refreshLifecycleQueue = Promise.resolve()
      const updateAutoRefresh = (isActive: boolean) => {
        refreshLifecycleQueue = refreshLifecycleQueue.then(async () => {
          try {
            if (isActive) {
              await supabase.auth.startAutoRefresh()
              if (active) setRefreshError(null)
            } else {
              await supabase.auth.stopAutoRefresh()
            }
          } catch (error) {
            if (active) {
              setRefreshError(
                error instanceof Error
                  ? error.message
                  : 'Unable to manage login token refresh for this app.',
              )
            }
          }
        })
        return refreshLifecycleQueue
      }

      void App.addListener('appStateChange', ({ isActive }) => {
        appStateRevision += 1
        void updateAutoRefresh(isActive)
      }).then(async (listener) => {
        if (!active) {
          await listener.remove()
          return
        }
        removeAppStateListener = () => {
          void listener.remove()
        }

        const revisionBeforeGetState = appStateRevision
        const appState = await App.getState()
        if (active && appStateRevision === revisionBeforeGetState) {
          await updateAutoRefresh(appState.isActive)
        }
      }).catch((error: unknown) => {
        if (active) {
          setRefreshError(
            error instanceof Error
              ? error.message
              : 'Unable to initialize login token refresh for this app.',
          )
        }
      })
    }

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
      removeAppStateListener?.()
      if (Capacitor.isNativePlatform()) {
        void supabase.auth.stopAutoRefresh().catch((error: unknown) => {
          console.error('Unable to stop Supabase token refresh.', error)
        })
      }
      data.subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    const { error } = await signOut()

    if (error) {
      throw error
    }
  }

  async function refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        setRefreshError(error.message)
        return false
      }
      if (!data.session) {
        setRefreshError('There is no active session to refresh. Please sign in again.')
        setSession(null)
        return false
      }

      setSession(data.session)
      setRefreshError(null)
      return true
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : 'Unable to refresh your login session.',
      )
      return false
    }
  }

  return (
    <AuthContext.Provider value={{ session, loading, authError, refreshError, refreshSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}