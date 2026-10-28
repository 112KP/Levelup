import { createContext } from 'react'

export type TimezoneContextValue = {
    timeZone: string
    loading: boolean
    error: string
    updateTimeZone: (timeZone: string) => Promise<void>
}

export const TimezoneContext = createContext<TimezoneContextValue | undefined>(undefined)
