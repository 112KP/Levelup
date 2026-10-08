import { supabase } from './supabaseClient'
import type { Database, Json } from '../types/database'

export const itemEffectKeys = [
    'hp',
    'mp',
    'fatigue',
    'gold',
    'strength',
    'agility',
    'sense',
    'vitality',
    'intelligence',
] as const

export const itemAttributeKeys = [
    'strength',
    'agility',
    'sense',
    'vitality',
    'intelligence',
] as const

export type ItemEffectKey = typeof itemEffectKeys[number]
export type ItemAttributeKey = typeof itemAttributeKeys[number]
export type ItemEffects = Partial<Record<ItemEffectKey, number>>

export function normalizeItemEffects(value: unknown): ItemEffects {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}

    const source = value as Record<string, unknown>
    const effects: ItemEffects = {}
    for (const key of itemEffectKeys) {
        const amount = source[key]
        if (typeof amount === 'number' && Number.isFinite(amount) && amount !== 0) {
            effects[key] = amount
        }
    }
    return effects
}

export function buildItemEffectJson(effects: ItemEffects): Json {
    const result: Record<string, number> = {}
    for (const key of itemEffectKeys) {
        const amount = effects[key]
        if (typeof amount === 'number' && Number.isFinite(amount)) {
            const normalizedAmount = Math.max(-100, Math.min(100, Math.trunc(amount)))
            if (normalizedAmount !== 0) result[key] = normalizedAmount
        }
    }
    return result
}

function formatEffectAmount(amount: number) {
    return `${amount < 0 ? '\u2212' : '+'}${Math.abs(amount)}`
}

export function formatItemEffectSummary(value: unknown) {
    const effects = normalizeItemEffects(value)
    const summary: string[] = []

    for (const key of ['hp', 'mp', 'fatigue', 'gold'] as const) {
        const amount = effects[key]
        if (amount) {
            const label = key === 'hp' ? 'HP' : key === 'mp' ? 'MP' : key === 'gold' ? 'Gold' : 'Fatigue'
            summary.push(`${formatEffectAmount(amount)} ${label}`)
        }
    }

    const attributeValues = itemAttributeKeys.map((key) => effects[key] ?? 0)
    if (attributeValues.every((amount) => amount === attributeValues[0]) && attributeValues[0] !== 0) {
        summary.push(`${formatEffectAmount(attributeValues[0])} all stats`)
    } else {
        for (const key of itemAttributeKeys) {
            const amount = effects[key]
            if (amount) {
                summary.push(`${formatEffectAmount(amount)} ${key[0].toUpperCase()}${key.slice(1)}`)
            }
        }
    }

    return summary.join(', ')
}

export async function fetchItems(userId: string) {
    return supabase.from('items').select('*').eq('user_id', userId).order('created_at', { ascending: false })
}

export async function createItem(payload: Database['public']['Tables']['items']['Insert']) {
    return supabase.from('items').insert(payload)
}

export async function updateItem(id: string, updates: Database['public']['Tables']['items']['Update']) {
    return supabase.from('items').update(updates).eq('id', id)
}

export async function deleteItem(id: string) {
    return supabase.from('items').delete().eq('id', id)
}

export async function consumeItem(itemId: string) {
    return supabase.rpc('use_item', { p_item_id: itemId })
}

export async function toggleEquip(itemId: string, equipped: boolean) {
    return supabase.rpc('toggle_equip', { p_item_id: itemId, p_equipped: equipped })
}
