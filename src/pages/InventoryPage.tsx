import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { executeItemUse, fetchItems, formatItemEffectSummary, normalizeItemEffects } from '../lib/items'
import { getInventoryItemCounts, getInventoryItems, getVitalDecreaseConfirmation } from '../lib/itemInventory'
import type { ItemRow, ItemType } from '../types/database.types'

const rarityColors: Record<ItemRow['rarity'], string> = {
    common: 'gray',
    rare: 'blue',
    epic: 'purple',
    legendary: 'gold',
}

const tabs: Array<{ type: ItemType; label: string }> = [
    { type: 'equipment', label: 'Equipment' },
    { type: 'consumable', label: 'Consumables' },
    { type: 'material', label: 'Materials' },
]

const emptyMessages: Record<ItemType, string> = {
    equipment: 'No equipped gear.',
    consumable: 'No consumables available.',
    material: 'No equipped materials.',
}

export function InventoryPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [items, setItems] = useState<ItemRow[]>([])
    const [activeTab, setActiveTab] = useState<ItemType>('consumable')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyItemId, setBusyItemId] = useState<string | null>(null)
    const [toast, setToast] = useState('')
    const busyItemIds = useRef(new Set<string>())
    const counts = getInventoryItemCounts(items)
    const visibleItems = getInventoryItems(items, activeTab)

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
            setError(queryError.message || 'Unable to load inventory.')
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

    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(''), 3000)
        return () => window.clearTimeout(timer)
    }, [toast])

    async function handleUse(item: ItemRow) {
        if (busyItemIds.current.size > 0) return

        if (item.item_type === 'consumable') {
            const confirmation = getVitalDecreaseConfirmation(normalizeItemEffects(item.stat_bonus))
            if (confirmation && !window.confirm(confirmation)) return
        }

        busyItemIds.current.add(item.id)
        setBusyItemId(item.id)
        setError('')
        try {
            const { error: useError } = await executeItemUse(item.id)
            if (useError) {
                setError(useError.message || 'Unable to use this item.')
                return
            }

            setToast(`Used: ${item.name}`)
            await loadItems()
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to use this item.')
        } finally {
            busyItemIds.current.delete(item.id)
            setBusyItemId(null)
        }
    }

    return (
        <section className="screen-page inventory-screen" aria-labelledby="inventory-title">
            <header className="screen-header">
                <div>
                    <Link className="inventory-back-link" to="/">← Home</Link>
                    <p className="eyebrow">YOUR ITEMS</p>
                    <h2 id="inventory-title">Inventory</h2>
                </div>
                <Link className="secondary-button inventory-manage-link" to="/inventory/manage">Manage Inventory</Link>
            </header>

            {toast && <div className="toast-banner" role="status">{toast}</div>}
            {error && (
                <div className="inventory-error" role="alert">
                    <p>{error}</p>
                    <button type="button" className="secondary-button" disabled={loading} onClick={() => void loadItems()}>
                        {loading ? 'Loading...' : 'Try again'}
                    </button>
                </div>
            )}

            <div className="quest-tabs inventory-tabs" role="tablist" aria-label="Inventory category">
                {tabs.map(({ type, label }) => (
                    <button
                        key={type}
                        id={`inventory-tab-${type}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === type}
                        aria-controls="inventory-panel"
                        className={`quest-tab${activeTab === type ? ' is-active' : ''}`}
                        onClick={() => setActiveTab(type)}
                    >
                        {label}<span className="quest-tab-count">{counts[type]}</span>
                    </button>
                ))}
            </div>

            <div
                id="inventory-panel"
                className="inventory-panel"
                role="tabpanel"
                aria-labelledby={`inventory-tab-${activeTab}`}
                aria-busy={loading}
            >
                {loading ? (
                    <div className="inventory-card-grid" aria-label="Loading inventory">
                        {[0, 1, 2].map((skeleton) => (
                            <div className="inventory-card-skeleton" key={skeleton}>
                                <span />
                                <span />
                                <span />
                            </div>
                        ))}
                    </div>
                ) : visibleItems.length === 0 ? (
                    <p className="status-empty">
                        {emptyMessages[activeTab]}{' '}
                        <Link to="/inventory/manage">Equip or manage items in Manage Inventory.</Link>
                    </p>
                ) : (
                    <div className="inventory-card-grid">
                        {visibleItems.map((item) => {
                            const effectSummary = formatItemEffectSummary(item.stat_bonus, item.item_type)
                            return (
                                <article className="inventory-item-card" key={item.id}>
                                    <header className="inventory-item-header">
                                        <div>
                                            <h3>{item.name}</h3>
                                            <span className={`rarity-badge ${rarityColors[item.rarity]}`}>{item.rarity}</span>
                                        </div>
                                        {item.item_type !== 'equipment' && (
                                            <span className="inventory-item-quantity">Qty {item.quantity}</span>
                                        )}
                                    </header>
                                    {item.item_type === 'consumable' && item.is_equipped && (
                                        <span className="inventory-equipped-chip">Equipped</span>
                                    )}
                                    {item.description && <p className="inventory-item-description">{item.description}</p>}
                                    <p className="item-effect-summary">
                                        {item.item_type === 'equipment'
                                            ? effectSummary ? `While equipped: ${effectSummary}` : 'No passive effects.'
                                            : effectSummary || 'No stat effect.'}
                                    </p>
                                    <button
                                        type="button"
                                        className="primary-button inventory-use-button"
                                        disabled={busyItemId !== null}
                                        onClick={() => void handleUse(item)}
                                    >
                                        {busyItemId === item.id ? 'Using...' : 'Use'}
                                    </button>
                                </article>
                            )
                        })}
                    </div>
                )}
            </div>
        </section>
    )
}
