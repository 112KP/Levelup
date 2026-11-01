import { supabase } from './supabaseClient'

export function refreshAbilityStreaks() {
    return supabase.rpc('refresh_ability_streaks')
}
