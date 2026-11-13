import { supabase } from './supabaseClient'
import type { AbilityName, Database, ItemType, Json } from '../types/database.types'
import { formatVitalEffect } from './vitals'
import { GAME_RULES } from './gameRules'
import {
    decryptPersonalText,
    encryptPersonalTextForActiveSession,
    normalizePersonalDataError,
} from './personalDataEncryption'

export const itemEffectKeys = [
    'hp',
    'mp',
    'emotion',
    'energy',
    'fatigue',
    'gold',
    'strength',
    'agility',
    'sense',
    'vitality',
    'intelligence',
] as const

export type ItemEffectKey = typeof itemEffectKeys[number] | AbilityName
export type ItemEffects = Partial<Record<ItemEffectKey, number>>
const abilityEffectKeys = ['strength', 'agility', 'sense', 'vitality', 'intelligence'] as const

export function normalizeItemEffects(value: unknown): ItemEffects {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}

    const source = value as Record<string, unknown>
    const effects: ItemEffects = {}
    for (const key of itemEffectKeys) {
        const amount = source[key]
        const isAbility = abilityEffectKeys.includes(key as typeof abilityEffectKeys[number])
        if (
            typeof amount === 'number'
            && Number.isFinite(amount)
            && (isAbility ? Math.trunc(amount) > 0 : amount !== 0)
        ) {
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
            if (abilityEffectKeys.includes(key as typeof abilityEffectKeys[number])) {
                const normalizedAmount = Math.min(GAME_RULES.itemEffects.maximum, Math.trunc(amount))
                if (normalizedAmount > 0) result[key] = normalizedAmount
                continue
            }

            const normalizedAmount = Math.max(GAME_RULES.itemEffects.minimum, Math.min(GAME_RULES.itemEffects.maximum, Math.trunc(amount)))
            if (normalizedAmount !== 0) result[key] = normalizedAmount
        }
    }
    return result
}

function formatEffectAmount(amount: number) {
    return `${amount < 0 ? '\u2212' : '+'}${Math.abs(amount)}`
}

export function formatItemEffectSummary(value: unknown, itemType: ItemType) {
    const effects = normalizeItemEffects(value)
    const summary: string[] = []

    for (const key of ['hp', 'mp', 'emotion', 'energy', 'fatigue', 'gold'] as const) {
        const amount = effects[key]
        if (amount) {
            const label = key === 'hp'
                ? formatVitalEffect('body', amount)
                : key === 'mp'
                    ? formatVitalEffect('mind', amount)
                    : key === 'emotion'
                        ? formatVitalEffect('emotion', amount)
                        : key === 'energy'
                            ? formatVitalEffect('energy', amount)
                            : key === 'fatigue'
                                ? formatVitalEffect('fatigue', amount)
                                : `${formatEffectAmount(amount)} Gold`
            summary.push(label)
        }
    }

    if (itemType === 'equipment') {
        for (const key of abilityEffectKeys) {
            const amount = effects[key]
            if (amount) {
                const label = `${key.charAt(0).toUpperCase()}${key.slice(1)}`
                summary.push(`${formatEffectAmount(amount)} ${label}`)
            }
        }
    }

    return summary.join(', ')
}

export async function fetchItems(userId: string) {
    const result = await supabase.from('items').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (result.error || !result.data) return result
    try {
        return {
            ...result,
            data: await Promise.all(result.data.map(async (item) => ({
                ...item,
                name: await decryptPersonalText(item.name, userId, 'items.name'),
                description: await decryptPersonalText(item.description, userId, 'items.description'),
            }))),
        }
    } catch (decryptionError) {
        return { ...result, data: null, error: normalizePersonalDataError(decryptionError) }
    }
}

export async function createItem(payload: Database['public']['Tables']['items']['Insert']) {
    const encryptedPayload = {
        ...payload,
        name: await encryptPersonalTextForActiveSession(payload.name, 'items.name'),
    }
    if (payload.description !== undefined) {
        encryptedPayload.description = await encryptPersonalTextForActiveSession(payload.description, 'items.description')
    }
    return supabase.from('items').insert(encryptedPayload)
}

export async function updateItem(id: string, updates: Database['public']['Tables']['items']['Update']) {
    const encryptedUpdates = { ...updates }
    if (updates.name !== undefined) {
        encryptedUpdates.name = await encryptPersonalTextForActiveSession(updates.name, 'items.name')
    }
    if (updates.description !== undefined) {
        encryptedUpdates.description = await encryptPersonalTextForActiveSession(updates.description, 'items.description')
    }
    return supabase.from('items').update(encryptedUpdates).eq('id', id)
}

export async function deleteItem(id: string) {
    return supabase.from('items').delete().eq('id', id)
}

export async function executeItemUse(itemId: string) {
    return supabase.rpc('use_item', { p_item_id: itemId })
}

export async function toggleEquip(itemId: string, equipped: boolean) {
    return supabase.rpc('toggle_equip', { p_item_id: itemId, p_equipped: equipped })
}
