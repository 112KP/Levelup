import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { fetchTitles, recheckMyTitles, setActiveTitle } from '../lib/titles'
import type { TitleRow } from '../types/database'

export function TitlesPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [titles, setTitles] = useState<TitleRow[]>([])
    const [activeTitleId, setActiveTitleId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    const loadTitles = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        const [titlesResult, profileResult] = await Promise.all([
            fetchTitles(userId),
            (await import('../lib/supabaseClient')).supabase.from('profiles').select('active_title_id').eq('user_id', userId).maybeSingle(),
        ])

        if (titlesResult.error) {
            setError(titlesResult.error.message || 'Unable to load titles.')
            setLoading(false)
            return
        }
        if (profileResult.error) {
            setError(profileResult.error.message || 'Unable to refresh the active title.')
            setLoading(false)
            return
        }

        setTitles((titlesResult.data ?? []) as TitleRow[])
        setActiveTitleId(profileResult.data?.active_title_id ?? null)
        setError('')
        setLoading(false)
    }, [userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadTitles()
    }, [loadTitles])

    async function handleEquip(titleId: string | null) {
        setBusy(true)
        const { error: rpcError } = await setActiveTitle(titleId)
        if (rpcError) {
            setError(rpcError.message || 'Unable to change the active title.')
            setBusy(false)
            return
        }
        setActiveTitleId(titleId)
        setBusy(false)
        await loadTitles()
    }

    async function handleRecheck() {
        setBusy(true)
        const { error: recheckError } = await recheckMyTitles()
        if (recheckError) {
            setError(recheckError.message || 'Unable to check for new titles.')
            setBusy(false)
            return
        }
        setBusy(false)
        await loadTitles()
    }

    return (
        <section className="screen-page">
            <div className="screen-header">
                <div>
                    <p className="eyebrow">TITLES</p>
                    <h2>Unlocked titles</h2>
                </div>
                <button type="button" className="primary-button" onClick={() => void handleRecheck()} disabled={busy}>
                    {busy ? 'Checking...' : 'Check for new titles'}
                </button>
            </div>

            {error && <p className="status-error">{error}</p>}
            {loading ? (
                <p className="status-empty">Loading titles...</p>
            ) : titles.length === 0 ? (
                <p className="status-empty">No titles unlocked yet.</p>
            ) : (
                <div className="card-grid">
                    {titles.map((title) => (
                        <div key={title.id} className="mini-card">
                            <div className="mini-card-header">
                                <h3>{title.name}</h3>
                                {activeTitleId === title.id && <span className="pill active">Equipped</span>}
                            </div>
                            <p>{title.description}</p>
                            <p className="muted-copy">Unlock: {title.unlock_condition ?? 'Automatic'}</p>
                            <p className="muted-copy">Bonus: {title.bonus_stat && title.bonus_amount ? `${title.bonus_stat} +${title.bonus_amount}` : 'None'}</p>
                            <div className="action-row compact">
                                {activeTitleId === title.id ? (
                                    <button type="button" className="secondary-button" onClick={() => void handleEquip(null)}>Unequip</button>
                                ) : (
                                    <button type="button" className="primary-button" onClick={() => void handleEquip(title.id)}>Equip</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
