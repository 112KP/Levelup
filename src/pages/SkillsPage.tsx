import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { createSkill, deleteSkill, fetchSkills, updateSkill } from '../lib/skills'
import type { SkillRow, SkillType, StatName } from '../types/database'

const defaultForm = {
    name: '',
    description: '',
    skill_type: 'active' as SkillType,
    skill_level: 1,
    linked_stat: 'strength' as StatName,
    mp_cost: 0,
    cooldown_minutes: 0,
}

export function SkillsPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [skills, setSkills] = useState<SkillRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [formError, setFormError] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | SkillType>('all')
    const [form, setForm] = useState(defaultForm)
    const [busy, setBusy] = useState(false)
    const dialogRef = useRef<HTMLDialogElement | null>(null)

    const loadSkills = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        const { data, error: queryError } = await fetchSkills(userId)
        if (queryError) {
            setError(queryError.message || 'Unable to load skills.')
            setLoading(false)
            return
        }
        setSkills(data ?? [])
        setError('')
        setLoading(false)
    }, [userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadSkills()
    }, [loadSkills])

    const filteredSkills = useMemo(() => {
        return filter === 'all' ? skills : skills.filter((skill) => skill.skill_type === filter)
    }, [skills, filter])

    function resetForm() {
        setForm(defaultForm)
        setEditingId(null)
        setFormError('')
    }

    function openCreateForm() {
        resetForm()
        setError('')
        dialogRef.current?.showModal()
    }

    function handleEdit(skill: SkillRow) {
        setEditingId(skill.id)
        setForm({
            name: skill.name,
            description: skill.description ?? '',
            skill_type: skill.skill_type,
            skill_level: skill.skill_level,
            linked_stat: skill.linked_stat ?? 'strength',
            mp_cost: skill.mp_cost,
            cooldown_minutes: skill.cooldown_minutes,
        })
        setError('')
        setFormError('')
        dialogRef.current?.showModal()
    }

    function closeForm() {
        dialogRef.current?.close()
        resetForm()
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setFormError('')

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            skill_type: form.skill_type,
            skill_level: Number(form.skill_level) || 1,
            linked_stat: form.linked_stat,
            mp_cost: Number(form.mp_cost) || 0,
            cooldown_minutes: Number(form.cooldown_minutes) || 0,
        }

        if (!payload.name) {
            setFormError('Skill name is required.')
            setBusy(false)
            return
        }

        const result = editingId
            ? await updateSkill(editingId, payload)
            : await createSkill({ ...payload, user_id: userId })
        if (result.error) {
            setFormError(result.error.message || 'The skill could not be saved.')
            setBusy(false)
            return
        }

        setBusy(false)
        closeForm()
        await loadSkills()
    }

    async function handleDelete(id: string) {
        const confirmed = window.confirm('Delete this skill?')
        if (!confirmed) return
        const { error: deleteError } = await deleteSkill(id)
        if (deleteError) {
            setError(deleteError.message || 'Unable to delete skill.')
            return
        }
        await loadSkills()
    }

    return (
        <section className="screen-page manage-screen" aria-labelledby="skills-title">
            <header className="screen-header">
                <div>
                    <p className="eyebrow">SKILLS</p>
                    <h2 id="skills-title">Skill manager</h2>
                </div>
                <button type="button" className="primary-button manage-create-button" onClick={openCreateForm}>
                    <Plus size={17} aria-hidden="true" /> New Skill
                </button>
            </header>

            {error && <p className="status-error" role="alert">{error}</p>}

            <div className="controls-row">
                <select className="field-input" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | SkillType)}>
                    <option value="all">All skill types</option>
                    <option value="active">Active</option>
                    <option value="passive">Passive</option>
                </select>
            </div>

            <div className="panel-block stretch">
                <h3>Skill list</h3>
                {loading ? (
                    <p className="status-empty">Loading skills...</p>
                ) : filteredSkills.length === 0 ? (
                    <p className="status-empty">No skills match this filter.</p>
                ) : (
                    <div className="table-shell">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Level</th>
                                    <th>Linked stat</th>
                                    <th>MP / CD</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSkills.map((skill) => (
                                    <tr key={skill.id}>
                                        <td>
                                            <strong>{skill.name}</strong>
                                            {skill.description && <div className="muted-copy">{skill.description}</div>}
                                        </td>
                                        <td>{skill.skill_type}</td>
                                        <td>{skill.skill_level}</td>
                                        <td>{skill.linked_stat ?? '—'}</td>
                                        <td>{skill.mp_cost} / {skill.cooldown_minutes}m</td>
                                        <td>
                                            <div className="inline-actions">
                                                <button type="button" className="link-button" onClick={() => handleEdit(skill)}>Edit</button>
                                                <button type="button" className="link-button danger" onClick={() => void handleDelete(skill.id)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <dialog className="manage-dialog" ref={dialogRef} aria-labelledby="skill-form-title" onClose={resetForm}>
                <form className="manage-form entity-form" onSubmit={handleSubmit}>
                    <header className="manage-dialog-header">
                        <div>
                            <p className="eyebrow">SKILL RECORD</p>
                            <h2 id="skill-form-title">{editingId ? 'Edit skill' : 'New skill'}</h2>
                        </div>
                        <button type="button" className="dialog-close-button" aria-label="Close skill form" onClick={closeForm}><X size={19} aria-hidden="true" /></button>
                    </header>
                    <label className="field-group" htmlFor="skill-name">Name<input id="skill-name" className="field-input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <label className="field-group" htmlFor="skill-description">Description<textarea id="skill-description" className="field-input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                    <div className="inline-grid two-up">
                        <label className="field-group" htmlFor="skill-type">Skill type<select id="skill-type" className="field-input" value={form.skill_type} onChange={(event) => setForm({ ...form, skill_type: event.target.value as SkillType })}>
                            <option value="active">Active</option>
                            <option value="passive">Passive</option>
                        </select></label>
                        <label className="field-group" htmlFor="skill-level">Level<input id="skill-level" className="field-input" type="number" min="1" value={form.skill_level} onChange={(event) => setForm({ ...form, skill_level: Number(event.target.value) })} /></label>
                    </div>
                    <div className="inline-grid two-up">
                        <label className="field-group" htmlFor="skill-linked-stat">Linked stat<select id="skill-linked-stat" className="field-input" value={form.linked_stat} onChange={(event) => setForm({ ...form, linked_stat: event.target.value as StatName })}>
                            <option value="strength">Strength</option>
                            <option value="agility">Agility</option>
                            <option value="sense">Sense</option>
                            <option value="vitality">Vitality</option>
                            <option value="intelligence">Intelligence</option>
                        </select></label>
                        <label className="field-group" htmlFor="skill-mp-cost">MP cost<input id="skill-mp-cost" className="field-input" type="number" min="0" value={form.mp_cost} onChange={(event) => setForm({ ...form, mp_cost: Number(event.target.value) })} /></label>
                    </div>
                    <label className="field-group" htmlFor="skill-cooldown">Cooldown (minutes)<input id="skill-cooldown" className="field-input" type="number" min="0" value={form.cooldown_minutes} onChange={(event) => setForm({ ...form, cooldown_minutes: Number(event.target.value) })} /></label>
                    {formError && <p className="status-error" role="alert">{formError}</p>}
                    <footer className="manage-form-actions">
                        <button type="button" className="secondary-button" onClick={closeForm}>Cancel</button>
                        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save skill' : 'Create skill'}</button>
                    </footer>
                </form>
            </dialog>
        </section>
    )
}
