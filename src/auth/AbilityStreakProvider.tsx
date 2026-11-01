import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import type { AbilityStreakRefreshRow } from '../types/database.types'
import { refreshAbilityStreaks } from '../lib/streaks'
import { AbilityStreakContext } from './AbilityStreakContext'

export function AbilityStreakProvider({ children }: { children: ReactNode }) {
    const [streaks, setStreaks] = useState<AbilityStreakRefreshRow[]>([])
    const [error, setError] = useState('')

    const refresh = useCallback(async () => {
        const result = await refreshAbilityStreaks()
        if (result.error) {
            setError(result.error.message)
            return result
        }

        setStreaks(result.data ?? [])
        setError('')
        return result
    }, [])

    return (
        <AbilityStreakContext.Provider value={{ streaks, error, refresh }}>
            {children}
        </AbilityStreakContext.Provider>
    )
}
