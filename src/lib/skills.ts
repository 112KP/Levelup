import { supabase } from './supabaseClient'
import type { Database } from '../types/database'

export async function fetchSkills(userId: string) {
    return supabase.from('skills').select('*').eq('user_id', userId).order('created_at', { ascending: false })
}

export async function createSkill(payload: Database['public']['Tables']['skills']['Insert']) {
    return supabase.from('skills').insert(payload)
}

export async function updateSkill(id: string, updates: Database['public']['Tables']['skills']['Update']) {
    return supabase.from('skills').update(updates).eq('id', id)
}

export async function deleteSkill(id: string) {
    return supabase.from('skills').delete().eq('id', id)
}
