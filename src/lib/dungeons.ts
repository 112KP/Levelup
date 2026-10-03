import { supabase } from './supabaseClient'
import type { Database, DungeonStatus } from '../types/database'

export function getDaysRemaining(deadline: string | null) {
    if (!deadline) return null
    const today = new Date()
    const todayValue = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    const [year, month, day] = deadline.split('-').map(Number)
    const dueValue = Date.UTC(year, month - 1, day)
    return Math.round((dueValue - todayValue) / 86_400_000)
}

export async function fetchDungeons(userId: string) {
    return supabase
        .from('dungeons')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true, nullsFirst: false })
}

export async function createDungeon(payload: Database['public']['Tables']['dungeons']['Insert']) {
    return supabase.from('dungeons').insert(payload)
}

export async function updateDungeon(id: string, updates: Database['public']['Tables']['dungeons']['Update']) {
    return supabase.from('dungeons').update(updates).eq('id', id)
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
