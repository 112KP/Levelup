import type { ItemRow, ItemType } from '../types/database.types'
import type { ItemEffects } from './items'

export function getInventoryItems(items: ItemRow[], type: ItemType) {
    return items.filter((item) => {
        if (type === 'consumable') return item.item_type === type && item.quantity >= 1
        return item.item_type === type && item.is_equipped
    })
}

export function getInventoryItemCounts(items: ItemRow[]): Record<ItemType, number> {
    return {
        equipment: getInventoryItems(items, 'equipment').length,
        consumable: getInventoryItems(items, 'consumable').length,
        material: getInventoryItems(items, 'material').length,
    }
}

export function getVitalDecreaseConfirmation(effects: ItemEffects) {
    const decreases = ([
        ['hp', 'Body'],
        ['mp', 'Mind'],
        ['emotion', 'Emotion'],
        ['energy', 'Energy'],
    ] as const).flatMap(([key, label]) => {
        const amount = effects[key]
        return amount !== undefined && amount < 0 ? [`${label} by ${Math.abs(amount)}`] : []
    })

    if (decreases.length === 0) return null
    return `This will reduce ${decreases.join(' and ')}. Use anyway?`
}
