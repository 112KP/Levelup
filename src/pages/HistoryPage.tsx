import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { fetchActivityHistory } from '../lib/history'
import type { ActivityLogRow } from '../types/database'

const icons: Record<string, string> = {
    xp_gain: '✦',
    level_up: '⬆',
    stat_change: '⚙',
    penalty: '⚠',
    purchase: '◈',
    quest_complete: '✓',
    dungeon_clear: '🏆',
}

export function HistoryPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [items, setItems] = useState<ActivityLogRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [page, setPage] = useState(1)
    const [pageInfo, setPageInfo] = useState({ total: 0, hasMore: true })

    const loadHistory = useCallback(async (nextPage = page) => {
        if (!userId) return
        setLoading(true)
        const { data, error: queryError, count } = await fetchActivityHistory(userId, nextPage, 20)
        if (queryError) {
            setError(queryError.message || 'Unable to load activity history.')
            setLoading(false)
            return
        }
        setItems((data ?? []) as ActivityLogRow[])
        setPageInfo({
            total: count ?? (data?.length ?? 0),
            hasMore: (data?.length ?? 0) === 20,
        })
        setError('')
        setLoading(false)
    }, [page, userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadHistory(page)
    }, [loadHistory, page])

    return (
        <section className="screen-page">
            <div className="screen-header">
                <div>
                    <p className="eyebrow">HISTORY</p>
                    <h2>Activity log</h2>
                </div>
            </div>

            {error && <p className="status-error">{error}</p>}
            {loading ? (
                <p className="status-empty">Loading activity...</p>
            ) : items.length === 0 ? (
                <p className="status-empty">No activity recorded yet.</p>
            ) : (
                <>
                    <div className="history-list">
                        {items.map((item) => (
                            <div key={item.id} className="history-item">
                                <span className="history-icon">{icons[item.event_type] ?? '•'}</span>
                                <div>
                                    <div className="history-heading">
                                        <strong>{item.event_type.replaceAll('_', ' ')}</strong>
                                        <span>{new Date(item.created_at).toLocaleString()}</span>
                                    </div>
                                    <p>{item.description ?? 'No description'}</p>
                                    {item.amount !== null && <small>{item.amount}</small>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="action-row compact">
                        <button type="button" className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                        <span className="muted-copy">Page {page}</span>
                        <button type="button" className="secondary-button" disabled={!pageInfo.hasMore} onClick={() => setPage((current) => current + 1)}>Next</button>
                    </div>
                </>
            )}
        </section>
    )
}
