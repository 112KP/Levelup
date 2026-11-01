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
        const profileUserId = userId ?? ''
        if (!profileUserId) return

        let active = true
        async function loadTimeZone() {
            const { data, error: queryError } = await supabase
                .from('profiles')
                .select('timezone')
                .eq('user_id', profileUserId)
                .maybeSingle()

            if (!active) return
            if (queryError) {
                setError(queryError.message)
                setLoading(false)
                return
            }
            if (!data) {
                setError('Your profile timezone could not be found.')
                setLoading(false)
                return
            }

            const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
            if (typeof browserTimeZone === 'string' && browserTimeZone.length > 0 && data.timezone !== browserTimeZone) {
                const { error: syncError } = await supabase.rpc('set_timezone', {
                    p_tz: browserTimeZone,
                })
                if (!active) return
                if (syncError) {
                    setTimeZone(data.timezone)
                    setError(`Unable to sync your timezone: ${syncError.message}`)
                    setLoading(false)
                    return
                }
                setTimeZone(browserTimeZone)
            } else {
                setTimeZone(data.timezone)
            }
            setError('')
            setLoading(false)
        }

        void loadTimeZone()

        return () => {
            active = false
        }
    }, [userId])

    const updateTimeZone = useCallback(async (nextTimeZone: string) => {
        if (!userId) throw new Error('You must be signed in to change your timezone.')

        const { error: updateError } = await supabase.rpc('set_timezone', {
            p_tz: nextTimeZone,
        })

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
