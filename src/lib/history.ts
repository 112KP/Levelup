import { supabase } from './supabaseClient'
import { GAME_RULES } from './gameRules'
import {
    decryptActivitySnapshot,
    decryptEmbeddedPersonalText,
    normalizePersonalDataError,
} from './personalDataEncryption'

export async function fetchActivityHistory(userId: string, page: number, pageSize = GAME_RULES.history.pageSize) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const result = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to)
    if (result.error || !result.data) return result
    try {
        return {
            ...result,
            data: await Promise.all(result.data.map(async (entry) => ({
                ...entry,
                description: entry.description
                    ? await decryptEmbeddedPersonalText(entry.description, userId)
                    : entry.description,
                snapshot: await decryptActivitySnapshot(entry.snapshot, userId),
            }))),
        }
    } catch (decryptionError) {
        return { ...result, data: null, error: normalizePersonalDataError(decryptionError) }
    }
}
