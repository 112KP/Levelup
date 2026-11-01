import { useContext } from 'react'
import { AbilityStreakContext } from './AbilityStreakContext'

export function useAbilityStreaks() {
    const context = useContext(AbilityStreakContext)
    if (!context) {
        throw new Error('useAbilityStreaks must be used inside AbilityStreakProvider')
    }
    return context
}
