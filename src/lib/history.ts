import { supabase } from './supabaseClient'

export async function fetchActivityHistory(userId: string, page: number, pageSize = 20) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    return supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to)
}
