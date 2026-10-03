import { supabase } from './supabaseClient'
import type { Database } from '../types/database'

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
