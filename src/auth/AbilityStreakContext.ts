import { createContext } from 'react'
import type { AbilityStreakRefreshRow } from '../types/database.types'

export type AbilityStreakContextValue = {
    streaks: AbilityStreakRefreshRow[]
    error: string
    refresh: () => Promise<{
        data: AbilityStreakRefreshRow[] | null
        error: { message: string } | null
    }>
}

export const AbilityStreakContext = createContext<AbilityStreakContextValue | undefined>(undefined)
