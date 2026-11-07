import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthContextValue = {
    session: Session | null
    loading: boolean
    authError: string | null
    refreshError: string | null
    refreshSession: () => Promise<boolean>
    logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)