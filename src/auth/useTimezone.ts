import { useContext } from 'react'
import { TimezoneContext } from './TimezoneContext'

export function useTimezone() {
    const context = useContext(TimezoneContext)
    if (!context) {
        throw new Error('useTimezone must be used inside TimezoneProvider')
    }
    return context
}
