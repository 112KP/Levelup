import { supabase } from './supabaseClient'
import type { Database } from '../types/database'

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
