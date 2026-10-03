import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { createQuest, deleteQuest, fetchQuests, updateQuest } from '../lib/quests'
import type { QuestDifficulty, QuestRecurrence, QuestRow, StatName } from '../types/database'

const recurrenceOptions: Array<{ value: QuestRecurrence | 'all'; label: string }> = [
    { value: 'all', label: 'All recurrences' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'one_time', label: 'One-time' },
]

const difficultyOptions: Array<{ value: QuestDifficulty | 'all'; label: string }> = [
    { value: 'all', label: 'All difficulties' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
]

const defaultForm = {
    name: '',
    description: '',
    recurrence: 'daily' as QuestRecurrence,
    difficulty: 'medium' as QuestDifficulty,
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

function recurrenceLabel(recurrence: QuestRecurrence) {
    return recurrence === 'one_time' ? 'One-time' : recurrence.charAt(0).toUpperCase() + recurrence.slice(1)
}

export function ManageQuestsPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [quests, setQuests] = useState<QuestRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [recurrenceFilter, setRecurrenceFilter] = useState<QuestRecurrence | 'all'>('all')
    const [difficultyFilter, setDifficultyFilter] = useState<QuestDifficulty | 'all'>('all')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(defaultForm)
    const [busy, setBusy] = useState(false)
    const [busyToggleId, setBusyToggleId] = useState<string | null>(null)
    const [toast, setToast] = useState('')
    const dialogRef = useRef<HTMLDialogElement | null>(null)

    const loadQuests = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        const { data, error: queryError } = await fetchQuests(userId)
        if (queryError) {
            setError(queryError.message || 'Unable to load quests.')
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

    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(''), 2600)
        return () => window.clearTimeout(timer)
    }, [toast])

    const filteredQuests = useMemo(() => quests.filter((quest) => {
        const matchesName = quest.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
        const matchesRecurrence = recurrenceFilter === 'all' || quest.recurrence === recurrenceFilter
        const matchesDifficulty = difficultyFilter === 'all' || quest.difficulty === difficultyFilter
        return matchesName && matchesRecurrence && matchesDifficulty
    }), [difficultyFilter, quests, recurrenceFilter, search])

    function openCreateForm() {
        setForm(defaultForm)
        setEditingId(null)
        setError('')
        dialogRef.current?.showModal()
    }

    function openEditForm(quest: QuestRow) {
        setEditingId(quest.id)
        setForm({
            name: quest.name,
            description: quest.description ?? '',
            recurrence: quest.recurrence,
            difficulty: quest.difficulty,
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
            setError('Quest name is required.')
            return
        }

        setBusy(true)
        setError('')
        const payload = {
            name,
            description: form.description.trim() || null,
            recurrence: form.recurrence,
            difficulty: form.difficulty,
            target_value: Math.max(1, Number(form.target_value) || 1),
            unit: form.unit.trim() || null,
            xp_reward: Math.max(0, Number(form.xp_reward) || 0),
            gold_reward: Math.max(0, Number(form.gold_reward) || 0),
            stat_reward: form.stat_reward === 'none' ? null : form.stat_reward,
            stat_reward_amount: Math.max(0, Number(form.stat_reward_amount) || 0),
            penalty_hp: Math.max(0, Number(form.penalty_hp) || 0),
            penalty_gold: Math.max(0, Number(form.penalty_gold) || 0),
            is_active: form.is_active,
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
        closeForm()
        setToast(editingId ? 'Quest updated.' : 'Quest created.')
        await loadQuests()
    }

    async function handleDelete(quest: QuestRow) {
        const confirmed = window.confirm(`Delete "${quest.name}"? All quest_logs for this quest will also be cascade-deleted. This cannot be undone.`)
        if (!confirmed) return
        const { error: deleteError } = await deleteQuest(quest.id)
        if (deleteError) {
            setError(deleteError.message || 'Unable to delete the quest.')
            return
        }
        setToast('Quest deleted.')
        await loadQuests()
    }

    async function toggleEnrolled(quest: QuestRow) {
        setBusyToggleId(quest.id)
        const { error: toggleError } = await updateQuest(quest.id, { is_active: !quest.is_active })
        if (toggleError) {
            setError(toggleError.message || 'Unable to update enrollment.')
        } else {
            setQuests((current) => current.map((item) => item.id === quest.id ? { ...item, is_active: !item.is_active } : item))
        }
        setBusyToggleId(null)
    }

    return (
        <section className="screen-page manage-screen" aria-labelledby="manage-quests-title">
            <header className="screen-header">
                <div>
                    <p className="eyebrow">QUESTS / CONFIGURATION</p>
                    <h2 id="manage-quests-title">Manage quests</h2>
                </div>
                <button type="button" className="primary-button manage-create-button" onClick={openCreateForm}>
                    <Plus size={17} aria-hidden="true" /> New Quest
                </button>
            </header>

            {toast && <div className="toast-banner" role="status">{toast}</div>}
            {error && (
                <div className="manage-error" role="alert">
                    <p>{error}</p>
                    {!loading && quests.length === 0 && <button type="button" className="rpg-action-button" onClick={() => void loadQuests()}>Retry</button>}
                </div>
            )}

            <div className="manage-filters">
                <label className="manage-search">
                    <Search size={17} aria-hidden="true" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" aria-label="Search quests by name" />
                </label>
                <select className="field-input" value={recurrenceFilter} onChange={(event) => setRecurrenceFilter(event.target.value as QuestRecurrence | 'all')} aria-label="Filter by recurrence">
                    {recurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select className="field-input" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value as QuestDifficulty | 'all')} aria-label="Filter by difficulty">
                    {difficultyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="manage-loading" role="status" aria-live="polite">Loading quests...</div>
            ) : error && quests.length === 0 ? null : (
                quests.length === 0 ? (
                <div className="manage-empty"><h3>No quests yet</h3><p>Create your first quest to start filling the daily board.</p></div>
                ) : filteredQuests.length === 0 ? (
                <div className="manage-empty"><h3>No matching quests</h3><p>Try another search or filter.</p></div>
                ) : (
                <div className="manage-list">
                    {filteredQuests.map((quest) => (
                        <article className="manage-row quest-manage-row" key={quest.id}>
                            <div className="manage-row-main">
                                <h3>{quest.name}</h3>
                                {quest.description && <p>{quest.description}</p>}
                                <div className="manage-row-tags">
                                    <span>{recurrenceLabel(quest.recurrence)}</span>
                                    <span className={`difficulty-tag ${quest.difficulty}`}>{quest.difficulty}</span>
                                    <span className="reward-text">+{quest.xp_reward} XP</span>
                                    <span className="reward-text">+{quest.gold_reward} gold</span>
                                </div>
                            </div>
                            <div className="manage-row-actions">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={quest.is_active}
                                    aria-label={`${quest.name} enrolled`}
                                    className={`enrolled-switch${quest.is_active ? ' is-on' : ''}`}
                                    disabled={busyToggleId === quest.id}
                                    onClick={() => void toggleEnrolled(quest)}
                                >
                                    <span className="switch-thumb" aria-hidden="true" />
                                    <span>{quest.is_active ? 'Enrolled' : 'Not enrolled'}</span>
                                </button>
                                <button type="button" className="rpg-action-button" onClick={() => openEditForm(quest)}>Edit</button>
                                <button type="button" className="rpg-action-button danger" onClick={() => void handleDelete(quest)}>Delete</button>
                            </div>
                        </article>
                    ))}
                </div>
                )
            )}

            <dialog className="manage-dialog" ref={dialogRef} aria-labelledby="quest-form-title" onClose={() => { setEditingId(null); setForm(defaultForm) }}>
                <form className="manage-form" onSubmit={(event) => void handleSubmit(event)}>
                    <header className="manage-dialog-header">
                        <div>
                            <p className="eyebrow">QUEST RECORD</p>
                            <h2 id="quest-form-title">{editingId ? 'Edit quest' : 'New quest'}</h2>
                        </div>
                        <button type="button" className="dialog-close-button" aria-label="Close quest form" onClick={closeForm}><X size={19} aria-hidden="true" /></button>
                    </header>
                    <label className="field-group">Name<input className="field-input" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <label className="field-group">Description<textarea className="field-input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                    <div className="inline-grid two-up">
                        <label className="field-group">Recurrence<select className="field-input" value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as QuestRecurrence })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="one_time">One-time</option></select></label>
                        <label className="field-group">Difficulty<select className="field-input" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as QuestDifficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
                    </div>
                    <div className="inline-grid two-up">
                        <label className="field-group">Target value<input className="field-input" type="number" min="1" step="1" value={form.target_value} onChange={(event) => setForm({ ...form, target_value: Number(event.target.value) })} /></label>
                        <label className="field-group">Unit<input className="field-input" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label>
                    </div>
                    <div className="inline-grid two-up">
                        <label className="field-group">XP reward<input className="field-input" type="number" min="0" step="1" value={form.xp_reward} onChange={(event) => setForm({ ...form, xp_reward: Number(event.target.value) })} /></label>
                        <label className="field-group">Gold reward<input className="field-input" type="number" min="0" step="1" value={form.gold_reward} onChange={(event) => setForm({ ...form, gold_reward: Number(event.target.value) })} /></label>
                    </div>
                    <div className="inline-grid two-up">
                        <label className="field-group">Stat reward<select className="field-input" value={form.stat_reward} onChange={(event) => setForm({ ...form, stat_reward: event.target.value as StatName | 'none' })}><option value="none">None</option><option value="strength">Strength</option><option value="agility">Agility</option><option value="sense">Sense</option><option value="vitality">Vitality</option><option value="intelligence">Intelligence</option></select></label>
                        <label className="field-group">Stat amount<input className="field-input" type="number" min="0" step="1" value={form.stat_reward_amount} onChange={(event) => setForm({ ...form, stat_reward_amount: Number(event.target.value) })} /></label>
                    </div>
                    <div className="inline-grid two-up">
                        <label className="field-group">HP penalty<input className="field-input" type="number" min="0" step="1" value={form.penalty_hp} onChange={(event) => setForm({ ...form, penalty_hp: Number(event.target.value) })} /></label>
                        <label className="field-group">Gold penalty<input className="field-input" type="number" min="0" step="1" value={form.penalty_gold} onChange={(event) => setForm({ ...form, penalty_gold: Number(event.target.value) })} /></label>
                    </div>
                    <label className="manage-checkbox"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Enrolled and active</label>
                    {error && <p className="status-error" role="alert">{error}</p>}
                    <footer className="manage-form-actions">
                        <button type="button" className="secondary-button" onClick={closeForm}>Cancel</button>
                        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save Quest' : 'Create Quest'}</button>
                    </footer>
                </form>
            </dialog>
        </section>
    )
}
