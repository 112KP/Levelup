import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { TimezoneContext } from './TimezoneContext'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_TIME_ZONE } from '../lib/dateTime'

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
    const { session } = useAuth()
    const userId = session?.user.id
    const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!userId) return

        let active = true
        void supabase
            .from('profiles')
            .select('timezone')
            .eq('user_id', userId)
            .maybeSingle()
            .then(({ data, error: queryError }) => {
                if (!active) return
                if (queryError) {
                    setError(queryError.message)
                } else if (data) {
                    setTimeZone(data.timezone)
                    setError('')
                } else {
                    setError('Your profile timezone could not be found.')
                }
                setLoading(false)
            })

        return () => {
            active = false
        }
    }, [userId])

    const updateTimeZone = useCallback(async (nextTimeZone: string) => {
        if (!userId) throw new Error('You must be signed in to change your timezone.')

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ timezone: nextTimeZone })
            .eq('user_id', userId)

        if (updateError) {
            setError(updateError.message)
            throw updateError
        }

        setTimeZone(nextTimeZone)
        setError('')
    }, [userId])

    return (
        <TimezoneContext.Provider value={{ timeZone, loading, error, updateTimeZone }}>
            {children}
        </TimezoneContext.Provider>
    )
}
