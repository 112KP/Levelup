import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { createQuest, deleteQuest, fetchQuests, updateQuest } from '../lib/quests'
import type { QuestRecurrence, QuestRow, StatName } from '../types/database'

const recurrenceOptions: Array<{ value: QuestRecurrence | 'all'; label: string }> = [
    { value: 'all', label: 'All recurrences' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'one_time', label: 'One-time' },
]

const defaultForm = {
    name: '',
    description: '',
    recurrence: 'daily' as QuestRecurrence,
    target_value: 1,
    unit: '',
    xp_reward: 0,
    gold_reward: 0,
    stat_reward: 'none' as StatName | 'none',
    stat_reward_amount: 0,
    penalty_hp: 0,
    penalty_gold: 0,
    is_active: true,
}

function getRecurrenceLabel(recurrence: QuestRecurrence) {
    if (recurrence === 'one_time') return 'One-time'
    return recurrence.charAt(0).toUpperCase() + recurrence.slice(1)
}

export function QuestsPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [quests, setQuests] = useState<QuestRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [recurrenceFilter, setRecurrenceFilter] = useState<QuestRecurrence | 'all'>('all')
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(defaultForm)
    const [busy, setBusy] = useState(false)

    const loadQuests = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        const { data, error: queryError } = await fetchQuests(userId)
        if (queryError) {
            setError('Unable to load quests right now.')
            setLoading(false)
            return
        }
        setQuests(data ?? [])
        setError('')
        setLoading(false)
    }, [userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadQuests()
    }, [loadQuests])

    const filteredQuests = useMemo(() => {
        return quests.filter((quest) => {
            const matchesSearch = quest.name.toLowerCase().includes(search.toLowerCase())
            const matchesRecurrence = recurrenceFilter === 'all' || quest.recurrence === recurrenceFilter
            const matchesActive =
                activeFilter === 'all' ||
                (activeFilter === 'active' && quest.is_active) ||
                (activeFilter === 'inactive' && !quest.is_active)
            return matchesSearch && matchesRecurrence && matchesActive
        })
    }, [quests, search, recurrenceFilter, activeFilter])

    const groupedQuests = useMemo(() => {
        return {
            daily: filteredQuests.filter((quest) => quest.recurrence === 'daily'),
            weekly: filteredQuests.filter((quest) => quest.recurrence === 'weekly'),
            one_time: filteredQuests.filter((quest) => quest.recurrence === 'one_time'),
        }
    }, [filteredQuests])

    function resetForm() {
        setForm(defaultForm)
        setEditingId(null)
    }

    function handleEdit(quest: QuestRow) {
        setEditingId(quest.id)
        setForm({
            name: quest.name,
            description: quest.description ?? '',
            recurrence: quest.recurrence,
            target_value: quest.target_value,
            unit: quest.unit ?? '',
            xp_reward: quest.xp_reward,
            gold_reward: quest.gold_reward,
            stat_reward: quest.stat_reward ?? 'none',
            stat_reward_amount: quest.stat_reward_amount,
            penalty_hp: quest.penalty_hp,
            penalty_gold: quest.penalty_gold,
            is_active: quest.is_active,
        })
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            recurrence: form.recurrence,
            target_value: Number(form.target_value) || 1,
            unit: form.unit.trim() || null,
            xp_reward: Number(form.xp_reward) || 0,
            gold_reward: Number(form.gold_reward) || 0,
            stat_reward: form.stat_reward === 'none' ? null : form.stat_reward,
            stat_reward_amount: Number(form.stat_reward_amount) || 0,
            penalty_hp: Number(form.penalty_hp) || 0,
            penalty_gold: Number(form.penalty_gold) || 0,
            is_active: form.is_active,
        }

        if (!payload.name) {
            setError('Quest name is required.')
            setBusy(false)
            return
        }

        const result = editingId
            ? await updateQuest(editingId, payload)
            : await createQuest({ ...payload, user_id: userId })

        if (result.error) {
            setError(result.error.message || 'The quest could not be saved.')
            setBusy(false)
            return
        }

        setBusy(false)
        resetForm()
        await loadQuests()
    }

    async function handleDelete(questId: string) {
        const confirmed = window.confirm('Delete this quest? This action cannot be undone.')
        if (!confirmed) return

        const { error: deleteError } = await deleteQuest(questId)
        if (deleteError) {
            setError(deleteError.message || 'Unable to delete the quest.')
            return
        }
        await loadQuests()
    }

    async function toggleQuestActive(quest: QuestRow) {
        const { error: toggleError } = await updateQuest(quest.id, { is_active: !quest.is_active })
        if (toggleError) {
            setError(toggleError.message || 'Unable to update the quest status.')
            return
        }
        await loadQuests()
    }

    return (
        <section className="screen-page">
            <div className="screen-header">
                <div>
                    <p className="eyebrow">QUESTS</p>
                    <h2>Quest manager</h2>
                </div>
            </div>

            <div className="controls-row controls-stack">
                <input
                    className="field-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search quests"
                    aria-label="Search quests"
                />
                <select
                    className="field-input"
                    value={recurrenceFilter}
                    onChange={(event) => setRecurrenceFilter(event.target.value as QuestRecurrence | 'all')}
                >
                    {recurrenceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <select
                    className="field-input"
                    value={activeFilter}
                    onChange={(event) => setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')}
                >
                    <option value="all">All active states</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            <div className="content-grid">
                <div className="panel-block">
                    <h3>{editingId ? 'Edit quest' : 'Create quest'}</h3>
                    <form className="entity-form" onSubmit={handleSubmit}>
                        <div className="field-group">
                            <label>Name</label>
                            <input className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                        </div>
                        <div className="field-group">
                            <label>Description</label>
                            <textarea className="field-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Recurrence</label>
                                <select className="field-input" value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as QuestRecurrence })}>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="one_time">One-time</option>
                                </select>
                            </div>
                            <div>
                                <label>Target value</label>
                                <input className="field-input" type="number" min="1" value={form.target_value} onChange={(event) => setForm({ ...form, target_value: Number(event.target.value) })} />
                            </div>
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Unit</label>
                                <input className="field-input" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
                            </div>
                            <div>
                                <label>XP reward</label>
                                <input className="field-input" type="number" value={form.xp_reward} onChange={(event) => setForm({ ...form, xp_reward: Number(event.target.value) })} />
                            </div>
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Gold reward</label>
                                <input className="field-input" type="number" value={form.gold_reward} onChange={(event) => setForm({ ...form, gold_reward: Number(event.target.value) })} />
                            </div>
                            <div>
                                <label>Stat reward</label>
                                <select className="field-input" value={form.stat_reward} onChange={(event) => setForm({ ...form, stat_reward: event.target.value as StatName | 'none' })}>
                                    <option value="none">None</option>
                                    <option value="strength">Strength</option>
                                    <option value="agility">Agility</option>
                                    <option value="sense">Sense</option>
                                    <option value="vitality">Vitality</option>
                                    <option value="intelligence">Intelligence</option>
                                </select>
                            </div>
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Stat amount</label>
                                <input className="field-input" type="number" value={form.stat_reward_amount} onChange={(event) => setForm({ ...form, stat_reward_amount: Number(event.target.value) })} />
                            </div>
                            <div>
                                <label>Penalty HP</label>
                                <input className="field-input" type="number" value={form.penalty_hp} onChange={(event) => setForm({ ...form, penalty_hp: Number(event.target.value) })} />
                            </div>
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Penalty gold</label>
                                <input className="field-input" type="number" value={form.penalty_gold} onChange={(event) => setForm({ ...form, penalty_gold: Number(event.target.value) })} />
                            </div>
                            <div className="checkbox-row">
                                <label><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
                            </div>
                        </div>

                        {error && <p className="status-error">{error}</p>}

                        <div className="action-row">
                            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save quest' : 'Create quest'}</button>
                            {editingId && <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>}
                        </div>
                    </form>
                </div>

                <div className="panel-block stretch">
                    <h3>Quest list</h3>
                    {loading ? (
                        <p className="status-empty">Loading quests...</p>
                    ) : filteredQuests.length === 0 ? (
                        <p className="status-empty">No quests match this view.</p>
                    ) : (
                        <div className="quest-groups">
                            {(['daily', 'weekly', 'one_time'] as const).map((groupKey) => {
                                const items = groupedQuests[groupKey]
                                if (items.length === 0) return null

                                return (
                                    <div key={groupKey} className="recurrence-group">
                                        <h4>{groupKey === 'one_time' ? 'One-time' : getRecurrenceLabel(groupKey)}</h4>
                                        <div className="table-shell">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Target</th>
                                                        <th>Rewards</th>
                                                        <th>Active</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((quest) => (
                                                        <tr key={quest.id}>
                                                            <td>
                                                                <strong>{quest.name}</strong>
                                                                {quest.description && <div className="muted-copy">{quest.description}</div>}
                                                            </td>
                                                            <td>{quest.target_value} {quest.unit || 'x'}</td>
                                                            <td>{quest.xp_reward} XP / {quest.gold_reward} gold</td>
                                                            <td>
                                                                <button type="button" className={`toggle-pill ${quest.is_active ? 'on' : 'off'}`} onClick={() => void toggleQuestActive(quest)}>
                                                                    {quest.is_active ? 'Active' : 'Inactive'}
                                                                </button>
                                                            </td>
                                                            <td>
                                                                <div className="inline-actions">
                                                                    <button type="button" className="link-button" onClick={() => handleEdit(quest)}>Edit</button>
                                                                    <button type="button" className="link-button danger" onClick={() => void handleDelete(quest.id)}>Delete</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
