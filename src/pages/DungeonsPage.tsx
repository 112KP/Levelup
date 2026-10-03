import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { createDungeon, deleteDungeon, fetchDungeons, updateDungeon } from '../lib/dungeons'
import type { DungeonRow, DungeonStatus, Rank } from '../types/database'

const rankOptions: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S']

const defaultForm = {
    name: '',
    dungeon_rank: 'E' as Rank,
    status: 'open' as DungeonStatus,
    xp_reward: 0,
    gold_reward: 0,
    deadline: '',
}

export function DungeonsPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [dungeons, setDungeons] = useState<DungeonRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(defaultForm)
    const [busy, setBusy] = useState(false)

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

    const sortedDungeons = useMemo(() => {
        return [...dungeons].sort((a, b) => {
            const left = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER
            const right = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER
            return left - right
        })
    }, [dungeons])

    function resetForm() {
        setForm(defaultForm)
        setEditingId(null)
    }

    function handleEdit(dungeon: DungeonRow) {
        setEditingId(dungeon.id)
        setForm({
            name: dungeon.name,
            dungeon_rank: dungeon.dungeon_rank,
            status: dungeon.status,
            xp_reward: dungeon.xp_reward,
            gold_reward: dungeon.gold_reward,
            deadline: dungeon.deadline ?? '',
        })
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')

        const payload = {
            name: form.name.trim(),
            dungeon_rank: form.dungeon_rank,
            ...(editingId && form.status === 'cleared' ? {} : { status: form.status }),
            xp_reward: Number(form.xp_reward) || 0,
            gold_reward: Number(form.gold_reward) || 0,
            deadline: form.deadline || null,
        }

        if (!payload.name) {
            setError('Dungeon name is required.')
            setBusy(false)
            return
        }

        const result = editingId
            ? await updateDungeon(editingId, payload)
            : await createDungeon({ ...payload, user_id: userId })
        if (result.error) {
            setError(result.error.message || 'The dungeon could not be saved.')
            setBusy(false)
            return
        }

        setBusy(false)
        resetForm()
        await loadDungeons()
    }

    async function handleDelete(id: string) {
        const confirmed = window.confirm('Delete this dungeon?')
        if (!confirmed) return
        const { error: deleteError } = await deleteDungeon(id)
        if (deleteError) {
            setError(deleteError.message || 'Unable to delete dungeon.')
            return
        }
        await loadDungeons()
    }

    return (
        <section className="screen-page">
            <div className="screen-header">
                <div>
                    <p className="eyebrow">DUNGEONS</p>
                    <h2>Goals manager</h2>
                </div>
            </div>

            <div className="content-grid">
                <div className="panel-block">
                    <h3>{editingId ? 'Edit dungeon' : 'Create dungeon'}</h3>
                    <form className="entity-form" onSubmit={handleSubmit}>
                        <div className="field-group">
                            <label>Name</label>
                            <input className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Rank</label>
                                <select className="field-input" value={form.dungeon_rank} onChange={(event) => setForm({ ...form, dungeon_rank: event.target.value as Rank })}>
                                    {rankOptions.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                                </select>
                            </div>
                            <div>
                                <label>Status</label>
                                <select className="field-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DungeonStatus })}>
                                    <option value="open">Open</option>
                                    <option value="in_progress">In progress</option>
                                    {form.status === 'cleared' && <option value="cleared" disabled>Cleared</option>}
                                    <option value="failed">Failed</option>
                                </select>
                            </div>
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>XP reward</label>
                                <input className="field-input" type="number" value={form.xp_reward} onChange={(event) => setForm({ ...form, xp_reward: Number(event.target.value) })} />
                            </div>
                            <div>
                                <label>Gold reward</label>
                                <input className="field-input" type="number" value={form.gold_reward} onChange={(event) => setForm({ ...form, gold_reward: Number(event.target.value) })} />
                            </div>
                        </div>
                        <div className="field-group">
                            <label>Deadline</label>
                            <input className="field-input" type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
                        </div>

                        {error && <p className="status-error">{error}</p>}

                        <div className="action-row">
                            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save dungeon' : 'Create dungeon'}</button>
                            {editingId && <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>}
                        </div>
                    </form>
                </div>

                <div className="panel-block stretch">
                    <h3>Dungeon list</h3>
                    {loading ? (
                        <p className="status-empty">Loading dungeons...</p>
                    ) : sortedDungeons.length === 0 ? (
                        <p className="status-empty">No dungeons yet.</p>
                    ) : (
                        <div className="table-shell">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Rank</th>
                                        <th>Status</th>
                                        <th>Rewards</th>
                                        <th>Deadline</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDungeons.map((dungeon) => (
                                        <tr key={dungeon.id}>
                                            <td><strong>{dungeon.name}</strong></td>
                                            <td>{dungeon.dungeon_rank}</td>
                                            <td><span className={`status-pill ${dungeon.status}`}>{dungeon.status}</span></td>
                                            <td>{dungeon.xp_reward} XP / {dungeon.gold_reward} gold</td>
                                            <td>{dungeon.deadline ? new Date(`${dungeon.deadline}T00:00:00`).toLocaleDateString() : '—'}</td>
                                            <td>
                                                <div className="inline-actions">
                                                    <button type="button" className="link-button" onClick={() => handleEdit(dungeon)}>Edit</button>
                                                    <button type="button" className="link-button danger" onClick={() => void handleDelete(dungeon.id)}>Delete</button>
                                                    <button type="button" className="link-button" onClick={() => { /* TODO: add database function for clear_dungeon rewards before wiring this action */ }}>Clear</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
