import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import {
    buildItemEffectJson,
    createItem,
    deleteItem,
    fetchItems,
    formatItemEffectSummary,
    normalizeItemEffects,
    toggleEquip,
    updateItem,
    consumeItem,
} from '../lib/items'
import type { ItemEffects } from '../lib/items'
import { EffectBuilder } from '../components/items/EffectBuilder'
import type { ItemRow, ItemType } from '../types/database'

const rarityColors: Record<string, string> = {
    common: 'gray',
    rare: 'blue',
    epic: 'purple',
    legendary: 'gold',
}

const defaultForm = {
    name: '',
    description: '',
    item_type: 'equipment' as ItemType,
    rarity: 'common' as ItemRow['rarity'],
    quantity: 1,
    is_equipped: false,
    stat_bonus: {} as ItemEffects,
}

export function ItemsPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [items, setItems] = useState<ItemRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | ItemType>('all')
    const [form, setForm] = useState(defaultForm)
    const [busy, setBusy] = useState(false)
    const [busyItemId, setBusyItemId] = useState<string | null>(null)

    useEffect(() => {
        const previousTitle = document.title
        document.title = 'Inventory | Levelup'
        return () => {
            document.title = previousTitle
        }
    }, [])

    const loadItems = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        const { data, error: queryError } = await fetchItems(userId)
        if (queryError) {
            setError(queryError.message || 'Unable to load items.')
            setLoading(false)
            return
        }
        setItems(data ?? [])
        setError('')
        setLoading(false)
    }, [userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadItems()
    }, [loadItems])

    const filteredItems = filter === 'all' ? items : items.filter((item) => item.item_type === filter)

    function resetForm() {
        setForm(defaultForm)
        setEditingId(null)
    }

    function handleEdit(item: ItemRow) {
        setEditingId(item.id)
        setForm({
            name: item.name,
            description: item.description ?? '',
            item_type: item.item_type,
            rarity: item.rarity,
            quantity: item.quantity,
            is_equipped: item.is_equipped,
            stat_bonus: normalizeItemEffects(item.stat_bonus),
        })
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            item_type: form.item_type,
            rarity: form.rarity,
            quantity: Number(form.quantity) || 0,
            is_equipped: form.is_equipped,
            stat_bonus: form.item_type === 'material' ? {} : buildItemEffectJson(form.stat_bonus),
        }

        if (!payload.name) {
            setError('Item name is required.')
            setBusy(false)
            return
        }

        const result = editingId
            ? await updateItem(editingId, payload)
            : await createItem({ ...payload, user_id: userId })
        if (result.error) {
            setError(result.error.message || 'The item could not be saved.')
            setBusy(false)
            return
        }

        setBusy(false)
        resetForm()
        await loadItems()
    }

    async function handleToggle(item: ItemRow) {
        setBusyItemId(item.id)
        const { error: toggleError } = await toggleEquip(item.id, !item.is_equipped)
        if (toggleError) {
            setError(toggleError.message || 'Unable to toggle equipped state.')
            setBusyItemId(null)
            return
        }
        setBusyItemId(null)
        await loadItems()
    }

    async function handleUse(item: ItemRow) {
        setBusyItemId(item.id)
        setError('')
        const { error: useError } = await consumeItem(item.id)
        if (useError) {
            setError(useError.message || 'Unable to use this item.')
            setBusyItemId(null)
            return
        }
        setBusyItemId(null)
        await loadItems()
    }

    async function handleDelete(id: string) {
        const confirmed = window.confirm('Delete this item?')
        if (!confirmed) return
        const { error: deleteError } = await deleteItem(id)
        if (deleteError) {
            setError(deleteError.message || 'Unable to delete item.')
            return
        }
        await loadItems()
    }

    return (
        <section className="screen-page">
            <div className="screen-header">
                <div>
                    <p className="eyebrow">INVENTORY</p>
                    <h2>Inventory</h2>
                </div>
            </div>

            <div className="controls-row">
                <select className="field-input" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | ItemType)}>
                    <option value="all">All item types</option>
                    <option value="equipment">Equipment</option>
                    <option value="consumable">Consumable</option>
                    <option value="material">Material</option>
                </select>
            </div>

            <div className="content-grid">
                <div className="panel-block">
                    <h3>{editingId ? 'Edit item' : 'Create item'}</h3>
                    <form className="entity-form" onSubmit={handleSubmit}>
                        <div className="field-group">
                            <label htmlFor="inventory-item-name">Name</label>
                            <input id="inventory-item-name" className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                        </div>
                        <div className="field-group">
                            <label htmlFor="inventory-item-description">Description</label>
                            <textarea id="inventory-item-description" className="field-input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label htmlFor="inventory-item-type">Type</label>
                                <select id="inventory-item-type" className="field-input" value={form.item_type} onChange={(event) => setForm({ ...form, item_type: event.target.value as ItemType })}>
                                    <option value="equipment">Equipment</option>
                                    <option value="consumable">Consumable</option>
                                    <option value="material">Material</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="inventory-item-rarity">Rarity</label>
                                <select id="inventory-item-rarity" className="field-input" value={form.rarity} onChange={(event) => setForm({ ...form, rarity: event.target.value as ItemRow['rarity'] })}>
                                    <option value="common">Common</option>
                                    <option value="rare">Rare</option>
                                    <option value="epic">Epic</option>
                                    <option value="legendary">Legendary</option>
                                </select>
                            </div>
                        </div>
                        <div className="field-group inline-grid two-up">
                            <div>
                                <label htmlFor="inventory-item-quantity">Quantity</label>
                                <input id="inventory-item-quantity" className="field-input" type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} />
                            </div>
                            <div className="checkbox-row">
                                <label><input type="checkbox" checked={form.is_equipped} onChange={(event) => setForm({ ...form, is_equipped: event.target.checked })} /> Equipped</label>
                            </div>
                        </div>
                        {form.item_type !== 'material' && (
                            <EffectBuilder
                                key={`${editingId ?? 'new'}-${form.item_type}`}
                                itemType={form.item_type}
                                effects={form.stat_bonus}
                                onChange={(stat_bonus) => setForm((current) => ({ ...current, stat_bonus }))}
                            />
                        )}

                        {error && <p className="status-error">{error}</p>}

                        <div className="action-row">
                            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save item' : 'Create item'}</button>
                            {editingId && <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>}
                        </div>
                    </form>
                </div>

                <div className="panel-block stretch">
                    <h3>Inventory</h3>
                    {loading ? (
                        <p className="status-empty">Loading inventory...</p>
                    ) : filteredItems.length === 0 ? (
                        <p className="status-empty">No items in this category.</p>
                    ) : (
                        <div className="grouped-list">
                            {(['equipment', 'consumable', 'material'] as const).map((groupKey) => {
                                const groupItems = filteredItems.filter((item) => item.item_type === groupKey)
                                if (groupItems.length === 0) return null
                                return (
                                    <div key={groupKey} className="recurrence-group">
                                        <h4>{groupKey}</h4>
                                        <div className="table-shell">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Rarity</th>
                                                        <th>Qty</th>
                                                        <th>State</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupItems.map((item) => (
                                                        <tr key={item.id}>
                                                            <td>
                                                                <strong>{item.name}</strong>
                                                                {formatItemEffectSummary(item.stat_bonus) && (
                                                                    <div className="item-effect-summary">{formatItemEffectSummary(item.stat_bonus)}</div>
                                                                )}
                                                                {item.description && <div className="muted-copy">{item.description}</div>}
                                                            </td>
                                                            <td><span className={`rarity-badge ${rarityColors[item.rarity]}`}>{item.rarity}</span></td>
                                                            <td>{item.quantity}</td>
                                                            <td>
                                                                {item.item_type === 'equipment' ? (
                                                                    <button type="button" className={`toggle-pill ${item.is_equipped ? 'on' : 'off'}`} disabled={busyItemId === item.id} onClick={() => void handleToggle(item)}>
                                                                        {item.is_equipped ? 'Equipped' : 'Unequipped'}
                                                                    </button>
                                                                ) : item.item_type === 'consumable' ? (
                                                                    <button type="button" className="primary-button inventory-use-button" disabled={busyItemId === item.id || item.quantity <= 0} onClick={() => void handleUse(item)}>
                                                                        {busyItemId === item.id ? 'Using...' : 'Use'}
                                                                    </button>
                                                                ) : <span className="muted-copy">Material</span>}
                                                            </td>
                                                            <td>
                                                                <div className="inline-actions">
                                                                    <button type="button" className="link-button" onClick={() => handleEdit(item)}>Edit</button>
                                                                    <button type="button" className="link-button danger" onClick={() => void handleDelete(item.id)}>Delete</button>
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
