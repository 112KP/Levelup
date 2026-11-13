import { supabase } from './supabaseClient'
import { getDateKey, DEFAULT_TIME_ZONE } from './dateTime'
import type { Database, DungeonStatus } from '../types/database.types'
import { formatVitalEffects } from './vitals'
import {
    decryptPersonalText,
    encryptPersonalTextForActiveSession,
    normalizePersonalDataError,
} from './personalDataEncryption'

export function getDaysRemaining(deadline: string | null, timeZone = DEFAULT_TIME_ZONE) {
    if (!deadline) return null
    const [todayYear, todayMonth, todayDay] = getDateKey(new Date(), timeZone).split('-').map(Number)
    const todayValue = Date.UTC(todayYear, todayMonth - 1, todayDay)
    const [year, month, day] = deadline.split('-').map(Number)
    const dueValue = Date.UTC(year, month - 1, day)
    return Math.round((dueValue - todayValue) / 86_400_000)
}

export async function fetchDungeons(userId: string) {
    const result = await supabase
        .from('dungeons')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true, nullsFirst: false })
    if (result.error || !result.data) return result
    try {
        return {
            ...result,
            data: await Promise.all(result.data.map(async (dungeon) => ({
                ...dungeon,
                name: await decryptPersonalText(dungeon.name, userId, 'dungeons.name'),
            }))),
        }
    } catch (decryptionError) {
        return { ...result, data: null, error: normalizePersonalDataError(decryptionError) }
    }
}

export function getDungeonVitalEffects(dungeon: Pick<
    Database['public']['Tables']['dungeons']['Row'],
    'body_effect' | 'mind_effect' | 'emotion_effect' | 'energy_effect' | 'fatigue_effect'
>) {
    return formatVitalEffects({
        body: dungeon.body_effect,
        mind: dungeon.mind_effect,
        emotion: dungeon.emotion_effect,
        energy: dungeon.energy_effect,
        fatigue: dungeon.fatigue_effect,
    })
}

export async function createDungeon(payload: Database['public']['Tables']['dungeons']['Insert']) {
    return supabase.from('dungeons').insert({
        ...payload,
        name: await encryptPersonalTextForActiveSession(payload.name, 'dungeons.name'),
    })
}

export async function updateDungeon(id: string, updates: Database['public']['Tables']['dungeons']['Update']) {
    const encryptedUpdates = { ...updates }
    if (updates.name !== undefined) {
        encryptedUpdates.name = await encryptPersonalTextForActiveSession(updates.name, 'dungeons.name')
    }
    return supabase.from('dungeons').update(encryptedUpdates).eq('id', id)
}

export async function deleteDungeon(id: string) {
    return supabase.from('dungeons').delete().eq('id', id)
}

export async function setDungeonStatus(id: string, status: DungeonStatus) {
    return supabase.rpc('set_dungeon_status', {
        p_dungeon_id: id,
        p_status: status,
    })
}

export async function clearDungeon(id: string) {
    return supabase.rpc('clear_dungeon', { p_dungeon_id: id })
}
