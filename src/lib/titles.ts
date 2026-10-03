import { supabase } from './supabaseClient'

export async function fetchTitles(_userId: string) {
    return supabase
        .from('titles')
        .select('*')
        .eq('user_id', _userId)
        .order('name', { ascending: true })
}

export async function fetchActiveTitleId(userId: string) {
    return supabase
        .from('profiles')
        .select('active_title_id')
        .eq('user_id', userId)
        .maybeSingle()
}

export async function setActiveTitle(titleId: string | null) {
    return supabase.rpc('set_active_title', { p_title_id: titleId })
}

export async function recheckMyTitles() {
    return supabase.rpc('recheck_my_titles')
}
