import { useCallback, useEffect, useMemo, useState } from 'react'
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
    const [editingId, setEditingId] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | SkillType>('all')
    const [form, setForm] = useState(defaultForm)
    const [busy, setBusy] = useState(false)

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
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')

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
            setError('Skill name is required.')
            setBusy(false)
            return
        }

        const result = editingId
            ? await updateSkill(editingId, payload)
            : await createSkill({ ...payload, user_id: userId })
        if (result.error) {
            setError(result.error.message || 'The skill could not be saved.')
            setBusy(false)
            return
        }

        setBusy(false)
        resetForm()
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
        <section className="screen-page">
            <div className="screen-header">
                <div>
                    <p className="eyebrow">SKILLS</p>
                    <h2>Skill manager</h2>
                </div>
            </div>

            <div className="controls-row">
                <select className="field-input" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | SkillType)}>
                    <option value="all">All skill types</option>
                    <option value="active">Active</option>
                    <option value="passive">Passive</option>
                </select>
            </div>

            <div className="content-grid">
                <div className="panel-block">
                    <h3>{editingId ? 'Edit skill' : 'Create skill'}</h3>
                    <form className="entity-form" onSubmit={handleSubmit}>
                        <div className="field-group">
                            <label>Name</label>
                            <input className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                        </div>
                        <div className="field-group">
                            <label>Description</label>
                            <textarea className="field-input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Skill type</label>
                                <select className="field-input" value={form.skill_type} onChange={(event) => setForm({ ...form, skill_type: event.target.value as SkillType })}>
                                    <option value="active">Active</option>
                                    <option value="passive">Passive</option>
                                </select>
                            </div>
                            <div>
                                <label>Level</label>
                                <input className="field-input" type="number" min="1" value={form.skill_level} onChange={(event) => setForm({ ...form, skill_level: Number(event.target.value) })} />
                            </div>
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label>Linked stat</label>
                                <select className="field-input" value={form.linked_stat} onChange={(event) => setForm({ ...form, linked_stat: event.target.value as StatName })}>
                                    <option value="strength">Strength</option>
                                    <option value="agility">Agility</option>
                                    <option value="sense">Sense</option>
                                    <option value="vitality">Vitality</option>
                                    <option value="intelligence">Intelligence</option>
                                </select>
                            </div>
                            <div>
                                <label>MP cost</label>
                                <input className="field-input" type="number" value={form.mp_cost} onChange={(event) => setForm({ ...form, mp_cost: Number(event.target.value) })} />
                            </div>
                        </div>
                        <div className="field-group">
                            <label>Cooldown (minutes)</label>
                            <input className="field-input" type="number" value={form.cooldown_minutes} onChange={(event) => setForm({ ...form, cooldown_minutes: Number(event.target.value) })} />
                        </div>

                        {error && <p className="status-error">{error}</p>}

                        <div className="action-row">
                            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save skill' : 'Create skill'}</button>
                            {editingId && <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>}
                        </div>
                    </form>
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
            </div>
        </section>
    )
}
