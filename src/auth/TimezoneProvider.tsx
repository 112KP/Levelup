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
            const retryDelays = [500, 1000, 2000]
            let retryIndex = 0

            function waitBeforeRetry(error: { message: string }): Promise<boolean> {
                if (!/jwt issued at future/i.test(error.message)) return Promise.resolve(false)
                const delay = retryDelays[retryIndex]
                if (delay === undefined) return Promise.resolve(false)

                retryIndex += 1
                return new Promise<boolean>((resolve) => {
                    window.setTimeout(() => resolve(true), delay)
                })
            }

            setLoading(true)
            setError('')

            while (active) {
                const { data, error: queryError } = await supabase
                    .from('profiles')
                    .select('timezone')
                    .eq('user_id', profileUserId)
                    .maybeSingle()

                if (!active) return
                if (queryError) {
                    if (await waitBeforeRetry(queryError)) continue
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
                        if (await waitBeforeRetry(syncError)) continue
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
                return
            }
        }

        void loadTimeZone()

        return () => {
            active = false
        }
    }, [session?.access_token, userId])

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
