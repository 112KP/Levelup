import { supabase } from './supabaseClient'
import type { Database } from '../types/database.types'
import {
    decryptPersonalText,
    encryptPersonalTextForActiveSession,
    normalizePersonalDataError,
} from './personalDataEncryption'

export async function fetchSkills(userId: string) {
    const result = await supabase.from('skills').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (result.error || !result.data) return result
    try {
        return {
            ...result,
            data: await Promise.all(result.data.map(async (skill) => ({
                ...skill,
                name: await decryptPersonalText(skill.name, userId, 'skills.name'),
                description: await decryptPersonalText(skill.description, userId, 'skills.description'),
            }))),
        }
    } catch (decryptionError) {
        return { ...result, data: null, error: normalizePersonalDataError(decryptionError) }
    }
}

export async function createSkill(payload: Database['public']['Tables']['skills']['Insert']) {
    const encryptedPayload = {
        ...payload,
        name: await encryptPersonalTextForActiveSession(payload.name, 'skills.name'),
    }
    if (payload.description !== undefined) {
        encryptedPayload.description = await encryptPersonalTextForActiveSession(payload.description, 'skills.description')
    }
    return supabase.from('skills').insert(encryptedPayload)
}

export async function updateSkill(id: string, updates: Database['public']['Tables']['skills']['Update']) {
    const encryptedUpdates = { ...updates }
    if (updates.name !== undefined) {
        encryptedUpdates.name = await encryptPersonalTextForActiveSession(updates.name, 'skills.name')
    }
    if (updates.description !== undefined) {
        encryptedUpdates.description = await encryptPersonalTextForActiveSession(updates.description, 'skills.description')
    }
    return supabase.from('skills').update(encryptedUpdates).eq('id', id)
}

export async function deleteSkill(id: string) {
    return supabase.from('skills').delete().eq('id', id)
}
