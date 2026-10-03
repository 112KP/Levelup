import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { clearDungeon, createDungeon, deleteDungeon, fetchDungeons, getDaysRemaining, setDungeonStatus, updateDungeon } from '../lib/dungeons'
import type { DungeonRow, DungeonStatus, Rank } from '../types/database'
import { RankBadge } from '../components/status/RankBadge'
import { useSearchParams } from 'react-router-dom'

const rankOptions: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S']

const defaultForm = {
    name: '',
    dungeon_rank: 'E' as Rank,
    xp_reward: 0,
    gold_reward: 0,
    deadline: '',
}

function statusLabel(status: DungeonStatus) {
    return status.replace('_', ' ')
}

function deadlineLabel(deadline: string | null) {
    if (!deadline) return 'No deadline'
    return new Date(`${deadline}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ManageDungeonsPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [searchParams] = useSearchParams()
    const focusedId = searchParams.get('focus')
    const [dungeons, setDungeons] = useState<DungeonRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(defaultForm)
    const [busy, setBusy] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [toast, setToast] = useState('')
    const dialogRef = useRef<HTMLDialogElement | null>(null)

    const loadDungeons = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        const { data, error: queryError } = await fetchDungeons(userId)
        if (queryError) {
            setError(queryError.message || 'Unable to load dungeons.')
            setLoading(false)
            return
        }
        setDungeons(data ?? [])
        setError('')
        setLoading(false)
    }, [userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDungeons()
    }, [loadDungeons])

    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(''), 3000)
        return () => window.clearTimeout(timer)
    }, [toast])

    useEffect(() => {
        if (loading || !focusedId) return
        const target = document.getElementById(`dungeon-${focusedId}`)
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target?.focus({ preventScroll: true })
    }, [dungeons, focusedId, loading])

    const sortedDungeons = useMemo(() => [...dungeons].sort((left, right) => {
        if (!left.deadline) return right.deadline ? 1 : 0
        if (!right.deadline) return -1
        return left.deadline.localeCompare(right.deadline)
    }), [dungeons])

    function openCreateForm() {
        setEditingId(null)
        setForm(defaultForm)
        setError('')
        dialogRef.current?.showModal()
    }

    function openEditForm(dungeon: DungeonRow) {
        setEditingId(dungeon.id)
        setForm({
            name: dungeon.name,
            dungeon_rank: dungeon.dungeon_rank,
            xp_reward: dungeon.xp_reward,
            gold_reward: dungeon.gold_reward,
            deadline: dungeon.deadline ?? '',
        })
        setError('')
        dialogRef.current?.showModal()
    }

    function closeForm() {
        dialogRef.current?.close()
        setEditingId(null)
        setForm(defaultForm)
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const name = form.name.trim()
        if (!name) {
            setError('Dungeon name is required.')
            return
        }

        setBusy(true)
        setError('')
        const payload = {
            name,
            dungeon_rank: form.dungeon_rank,
            xp_reward: Math.max(0, Number(form.xp_reward) || 0),
            gold_reward: Math.max(0, Number(form.gold_reward) || 0),
            deadline: form.deadline || null,
        }
        const result = editingId
            ? await updateDungeon(editingId, payload)
            : await createDungeon({ ...payload, user_id: userId })
        if (result.error) {
            setError(result.error.message || 'The dungeon could not be saved.')
            setBusy(false)
            return
        }

        const wasEditing = Boolean(editingId)
        setBusy(false)
        closeForm()
        setToast(wasEditing ? 'Dungeon updated.' : 'Dungeon created.')
        await loadDungeons()
    }

    async function handleDelete(dungeon: DungeonRow) {
        if (!window.confirm(`Delete "${dungeon.name}"? This cannot be undone.`)) return
        const { error: deleteError } = await deleteDungeon(dungeon.id)
        if (deleteError) {
            setError(deleteError.message || 'Unable to delete the dungeon.')
            return
        }
        setToast('Dungeon deleted.')
        await loadDungeons()
    }

    async function changeStatus(dungeon: DungeonRow, status: 'in_progress' | 'failed') {
        if (status === 'failed' && !window.confirm(`Abandon "${dungeon.name}"? It will be marked as failed.`)) return
        setBusyId(dungeon.id)
        setError('')
        const { error: statusError } = await setDungeonStatus(dungeon.id, status)
        if (statusError) {
            setError(statusError.message || 'Unable to update the dungeon status.')
            setBusyId(null)
            return
        }
        setDungeons((current) => current.map((item) => item.id === dungeon.id ? { ...item, status } : item))
        setToast(status === 'in_progress' ? `${dungeon.name} started.` : `${dungeon.name} abandoned.`)
        setBusyId(null)
    }

    async function handleClear(dungeon: DungeonRow) {
        if (dungeon.status !== 'in_progress' || busyId) return
        setBusyId(dungeon.id)
        setError('')
        const { error: clearError } = await clearDungeon(dungeon.id)
        if (clearError) {
            setError(clearError.message || 'Unable to clear the dungeon.')
            setBusyId(null)
            return
        }
        setDungeons((current) => current.map((item) => item.id === dungeon.id ? { ...item, status: 'cleared' } : item))
        setToast(`${dungeon.name} cleared: +${dungeon.xp_reward} XP, +${dungeon.gold_reward} gold.`)
        setBusyId(null)
    }

    return (
        <section className="screen-page manage-screen" aria-labelledby="manage-dungeons-title">
            <header className="screen-header">
                <div>
                    <p className="eyebrow">DUNGEONS / CONFIGURATION</p>
                    <h2 id="manage-dungeons-title">Manage dungeons</h2>
                </div>
                <button type="button" className="primary-button manage-create-button" onClick={openCreateForm}>
                    <Plus size={17} aria-hidden="true" /> New Dungeon
                </button>
            </header>

            {toast && <div className="toast-banner" role="status">{toast}</div>}
            {error && <div className="manage-error" role="alert"><p>{error}</p><button type="button" className="rpg-action-button" onClick={() => void loadDungeons()}>Retry</button></div>}

            {loading ? (
                <div className="manage-loading" role="status" aria-live="polite">Loading dungeons...</div>
            ) : error && dungeons.length === 0 ? null : (
                sortedDungeons.length === 0 ? (
                <div className="manage-empty"><h3>No dungeons yet</h3><p>Create a dungeon to track a larger goal against a deadline.</p></div>
                ) : (
                <div className="manage-list">
                    {sortedDungeons.map((dungeon) => {
                        const remaining = getDaysRemaining(dungeon.deadline)
                        const busyThisDungeon = busyId === dungeon.id
                        return (
                            <article
                                className={`manage-row dungeon-manage-row${focusedId === dungeon.id ? ' is-focused' : ''}`}
                                id={`dungeon-${dungeon.id}`}
                                key={dungeon.id}
                                tabIndex={-1}
                                aria-label={`${dungeon.name}, ${statusLabel(dungeon.status)}`}
                            >
                                <div className="dungeon-rank"><RankBadge rank={dungeon.dungeon_rank} /></div>
                                <div className="manage-row-main">
                                    <div className="dungeon-row-heading">
                                        <h3>{dungeon.name}</h3>
                                        <span className={`dungeon-status-badge ${dungeon.status}`}>{statusLabel(dungeon.status)}</span>
                                    </div>
                                    <div className="manage-row-tags">
                                        <span>{deadlineLabel(dungeon.deadline)}</span>
                                        <span className="reward-text">+{dungeon.xp_reward} XP</span>
                                        <span className="reward-text">+{dungeon.gold_reward} gold</span>
                                        {dungeon.deadline && (
                                            <span className={`dungeon-days${remaining !== null && remaining < 0 ? ' overdue' : ''}`}>
                                                {remaining !== null && remaining < 0 ? 'Overdue' : `${remaining} ${remaining === 1 ? 'day' : 'days'} left`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="dungeon-row-actions">
                                    <button type="button" className="rpg-action-button" onClick={() => openEditForm(dungeon)}>Edit</button>
                                    <button type="button" className="rpg-action-button danger" onClick={() => void handleDelete(dungeon)}>Delete</button>
                                    {dungeon.status === 'open' && <button type="button" className="rpg-action-button" disabled={busyThisDungeon} onClick={() => void changeStatus(dungeon, 'in_progress')}>Start</button>}
                                    {(dungeon.status === 'open' || dungeon.status === 'in_progress') && <button type="button" className="rpg-action-button danger" disabled={busyThisDungeon} onClick={() => void changeStatus(dungeon, 'failed')}>Abandon</button>}
                                    <button type="button" className="rpg-action-button dungeon-clear-button" disabled={dungeon.status !== 'in_progress' || busyThisDungeon} onClick={() => void handleClear(dungeon)} aria-label={`Clear ${dungeon.name}`}>
                                        {busyThisDungeon && dungeon.status === 'in_progress' ? 'Clearing...' : 'Clear'}
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
                )
            )}

            <dialog className="manage-dialog" ref={dialogRef} aria-labelledby="dungeon-form-title" onClose={() => { setEditingId(null); setForm(defaultForm) }}>
                <form className="manage-form" onSubmit={(event) => void handleSubmit(event)}>
                    <header className="manage-dialog-header">
                        <div>
                            <p className="eyebrow">DUNGEON RECORD</p>
                            <h2 id="dungeon-form-title">{editingId ? 'Edit dungeon' : 'New dungeon'}</h2>
                        </div>
                        <button type="button" className="dialog-close-button" aria-label="Close dungeon form" onClick={closeForm}><X size={19} aria-hidden="true" /></button>
                    </header>
                    <label className="field-group">Name<input className="field-input" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <div className="inline-grid two-up">
                        <label className="field-group">Dungeon rank<select className="field-input" value={form.dungeon_rank} onChange={(event) => setForm({ ...form, dungeon_rank: event.target.value as Rank })}>{rankOptions.map((rank) => <option key={rank} value={rank}>{rank}</option>)}</select></label>
                        <label className="field-group">Deadline<input className="field-input" type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
                    </div>
                    <div className="inline-grid two-up">
                        <label className="field-group">XP reward<input className="field-input" type="number" min="0" step="1" value={form.xp_reward} onChange={(event) => setForm({ ...form, xp_reward: Number(event.target.value) })} /></label>
                        <label className="field-group">Gold reward<input className="field-input" type="number" min="0" step="1" value={form.gold_reward} onChange={(event) => setForm({ ...form, gold_reward: Number(event.target.value) })} /></label>
                    </div>
                    {error && <p className="status-error" role="alert">{error}</p>}
                    <footer className="manage-form-actions">
                        <button type="button" className="secondary-button" onClick={closeForm}>Cancel</button>
                        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save Dungeon' : 'Create Dungeon'}</button>
                    </footer>
                </form>
            </dialog>
        </section>
    )
}
