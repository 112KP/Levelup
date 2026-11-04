import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { ValueStepper } from '../components/ValueStepper'
import { useAuth } from '../auth/useAuth'
import {
    createQuest,
    deleteQuest,
    fetchQuests,
    getQuestVitalPenalties,
    getQuestVitalRewards,
    updateQuest,
} from '../lib/quests'
import { ABILITY_OPTIONS, MAX_ABILITIES_PER_QUEST, getAbilityLabel } from '../lib/abilities'
import { VITAL_LABELS } from '../lib/vitals'
import { GAME_RULES } from '../lib/gameRules'
import type { AbilityName, QuestDifficulty, QuestPrahar, QuestRecurrence, QuestRow } from '../types/database.types'

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
    prahar: 'Night' as QuestPrahar,
    difficulty: 'medium' as QuestDifficulty,
    target_value: 1,
    unit: '',
    xp_reward: '',
    gold_reward: '',
    hp_reward: '',
    mp_reward: '',
    emotion_reward: '',
    energy_reward: '',
    abilities: [] as AbilityName[],
    penalty_hp: '',
    penalty_mp: '',
    penalty_emotion: '',
    penalty_energy: '',
    penalty_gold: '',
    fatigue_restore: '0',
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
        const questsResult = await fetchQuests(userId)
        if (questsResult.error) {
            setError(questsResult.error.message || 'Unable to load quests.')
            setLoading(false)
            return
        }
        const loadedQuests = questsResult.data ?? []
        setQuests(loadedQuests)
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
            prahar: quest.prahar,
            difficulty: quest.difficulty,
            target_value: quest.target_value,
            unit: quest.unit ?? '',
            xp_reward: String(quest.xp_reward),
            gold_reward: String(quest.gold_reward),
            hp_reward: String(quest.hp_reward),
            mp_reward: String(quest.mp_reward),
            emotion_reward: String(quest.emotion_reward),
            energy_reward: String(quest.energy_reward),
            abilities: quest.abilities ?? [],
            penalty_hp: String(quest.penalty_hp),
            penalty_mp: String(quest.penalty_mp),
            penalty_emotion: String(quest.penalty_emotion),
            penalty_energy: String(quest.penalty_energy),
            penalty_gold: String(quest.penalty_gold),
            fatigue_restore: String(quest.fatigue_restore),
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
        if (form.abilities.length < 1 || form.abilities.length > MAX_ABILITIES_PER_QUEST) {
            setError('Choose at least one ability for this quest.')
            return
        }

        setBusy(true)
        setError('')
        const payload = {
            name,
            description: form.description.trim() || null,
            recurrence: form.recurrence,
            abilities: form.abilities,
            prahar: form.prahar,
            difficulty: form.difficulty,
            target_value: Math.max(1, Number(form.target_value) || 1),
            unit: form.unit.trim() || null,
            xp_reward: Math.max(0, Number(form.xp_reward) || 0),
            gold_reward: Math.max(0, Number(form.gold_reward) || 0),
            hp_reward: Math.max(0, Math.trunc(Number(form.hp_reward) || 0)),
            mp_reward: Math.max(0, Math.trunc(Number(form.mp_reward) || 0)),
            emotion_reward: Math.max(0, Math.trunc(Number(form.emotion_reward) || 0)),
            energy_reward: Math.max(0, Math.trunc(Number(form.energy_reward) || 0)),
            penalty_hp: Math.max(0, Math.trunc(Number(form.penalty_hp) || 0)),
            penalty_mp: Math.max(0, Math.trunc(Number(form.penalty_mp) || 0)),
            penalty_emotion: Math.max(0, Math.trunc(Number(form.penalty_emotion) || 0)),
            penalty_energy: Math.max(0, Math.trunc(Number(form.penalty_energy) || 0)),
            penalty_gold: Math.max(0, Number(form.penalty_gold) || 0),
            fatigue_restore: Math.min(100, Math.max(0, Math.trunc(Number(form.fatigue_restore) || 0))),
            is_active: form.is_active,
        }
        const wasEditing = Boolean(editingId)
        let savedQuestId = editingId

        if (editingId) {
            const result = await updateQuest(editingId, payload)
            if (result.error) {
                setError(result.error.message || 'The quest could not be saved.')
                setBusy(false)
                return
            }
        } else {
            const result = await createQuest({ ...payload, user_id: userId })
            if (result.error) {
                setError(result.error.message || 'The quest could not be saved.')
                setBusy(false)
                return
            }
            savedQuestId = result.data.id
        }

        if (!savedQuestId) {
            setError('The saved quest ID could not be resolved.')
            setBusy(false)
            return
        }

        setBusy(false)
        closeForm()
        setToast(wasEditing ? 'Quest updated.' : 'Quest created.')
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

    function setVitalAmount(
        field: 'hp_reward' | 'mp_reward' | 'emotion_reward' | 'energy_reward'
            | 'penalty_hp' | 'penalty_mp' | 'penalty_emotion' | 'penalty_energy' | 'fatigue_restore',
        value: number,
    ) {
        setForm((current) => ({ ...current, [field]: String(value) }))
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
                                        {quest.abilities.length > 0
                                            ? quest.abilities.map((ability) => (
                                                <span className="ability-chip" key={ability}>{getAbilityLabel(ability)}</span>
                                            ))
                                            : <span className="ability-chip no-ability">No ability</span>}
                                        <span className="reward-text">+{quest.xp_reward} XP</span>
                                        <span className="reward-text">+{quest.gold_reward} gold</span>
                                        {getQuestVitalRewards(quest).map((reward) => <span className="reward-text" key={reward}>{reward}</span>)}
                                        {getQuestVitalPenalties(quest).map((penalty) => <span className="reward-text" key={`penalty-${penalty}`}>On skip: {penalty}</span>)}
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
                    <label className="field-group">Name<input className="field-input" required maxLength={GAME_RULES.quests.nameMaxLength} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <label className="field-group">Description<textarea className="field-input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                    <div className="inline-grid two-up">
                        <label className="field-group">Recurrence<select className="field-input" value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as QuestRecurrence })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="one_time">One-time</option></select></label>
                        <label className="field-group">Prahar<select className="field-input" value={form.prahar} onChange={(event) => setForm({ ...form, prahar: event.target.value as QuestPrahar })}><option value="Morning">Morning</option><option value="Afternoon">Afternoon</option><option value="Evening">Evening</option><option value="Night">Night</option></select></label>
                    </div>
                    <fieldset className="ability-fieldset">
                        <legend>Abilities</legend>
                        <p className="field-help">Choose at least one ability. A completed quest counts once per tagged ability each day.</p>
                        <div className="ability-options">
                            {ABILITY_OPTIONS.map(({ value, label }) => {
                                const selected = form.abilities.includes(value)
                                return (
                                    <label className="ability-option" key={value}>
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            disabled={!selected && form.abilities.length >= MAX_ABILITIES_PER_QUEST}
                                            onChange={(event) => setForm({
                                                ...form,
                                                abilities: event.target.checked
                                                    ? [...form.abilities, value]
                                                    : form.abilities.filter((ability) => ability !== value),
                                            })}
                                        />
                                        <span>{label}</span>
                                    </label>
                                )
                            })}
                        </div>
                    </fieldset>
                    <div className="inline-grid two-up">
                        <label className="field-group">Difficulty<select className="field-input" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as QuestDifficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
                        <label className="field-group">Target value<input className="field-input" type="number" min="1" step="1" value={form.target_value} onChange={(event) => setForm({ ...form, target_value: Number(event.target.value) })} /></label>
                    </div>
                    <small className="field-help">Target and unit are for reference only; they do not affect rewards.</small>
                    <div className="inline-grid two-up">
                        <label className="field-group">
                            Unit
                            <input
                                className="field-input"
                                value={form.unit}
                                placeholder="e.g. L, pages, sessions"
                                aria-describedby="quest-unit-help"
                                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                            />
                            <small id="quest-unit-help">Optional — leave blank for simple pass/fail quests.</small>
                        </label>
                        <label className="field-group">XP reward<input className="field-input" type="number" min="0" step="1" value={form.xp_reward} onChange={(event) => setForm({ ...form, xp_reward: event.target.value })} /></label>
                    </div>
                    <label className="field-group">Gold reward<input className="field-input" type="number" min="0" step="1" value={form.gold_reward} onChange={(event) => setForm({ ...form, gold_reward: event.target.value })} /></label>
                    <div className="effect-vitals-grid">
                        <ValueStepper label={VITAL_LABELS.body} value={Number(form.hp_reward) || 0} onChange={(value) => setVitalAmount('hp_reward', value)} />
                        <ValueStepper label={VITAL_LABELS.mind} value={Number(form.mp_reward) || 0} onChange={(value) => setVitalAmount('mp_reward', value)} />
                        <ValueStepper label={VITAL_LABELS.emotion} value={Number(form.emotion_reward) || 0} onChange={(value) => setVitalAmount('emotion_reward', value)} />
                        <ValueStepper label={VITAL_LABELS.energy} value={Number(form.energy_reward) || 0} onChange={(value) => setVitalAmount('energy_reward', value)} />
                    </div>
                    <div className="inline-grid two-up">
                        <ValueStepper label={`${VITAL_LABELS.body} penalty`} value={Number(form.penalty_hp) || 0} onChange={(value) => setVitalAmount('penalty_hp', value)} />
                        <ValueStepper label={`${VITAL_LABELS.mind} penalty`} value={Number(form.penalty_mp) || 0} onChange={(value) => setVitalAmount('penalty_mp', value)} />
                        <ValueStepper label={`${VITAL_LABELS.emotion} penalty`} value={Number(form.penalty_emotion) || 0} onChange={(value) => setVitalAmount('penalty_emotion', value)} />
                        <ValueStepper label={`${VITAL_LABELS.energy} penalty`} value={Number(form.penalty_energy) || 0} onChange={(value) => setVitalAmount('penalty_energy', value)} />
                        <label className="field-group">Gold penalty<input className="field-input" type="number" min="0" step="1" value={form.penalty_gold} onChange={(event) => setForm({ ...form, penalty_gold: event.target.value })} /></label>
                    </div>
                    <ValueStepper
                        label={`${VITAL_LABELS.fatigue} restored on completion`}
                        value={Number(form.fatigue_restore) || 0}
                        onChange={(value) => setVitalAmount('fatigue_restore', value)}
                        max={GAME_RULES.vitals.fatigueMaximum}
                    />
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
