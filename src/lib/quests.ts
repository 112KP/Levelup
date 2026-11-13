import { supabase } from './supabaseClient'
import type { Database, QuestLogRow, QuestRow } from '../types/database.types'
import { formatVitalEffect } from './vitals'
import { GAME_RULES } from './gameRules'
import {
    decryptPersonalText,
    encryptPersonalTextForActiveSession,
    normalizePersonalDataError,
} from './personalDataEncryption'

async function decryptQuest(quest: QuestRow, userId: string): Promise<QuestRow> {
    return {
        ...quest,
        name: await decryptPersonalText(quest.name, userId, 'quests.name'),
        description: await decryptPersonalText(quest.description, userId, 'quests.description'),
        unit: await decryptPersonalText(quest.unit, userId, 'quests.unit'),
    }
}

export function getQuestVitalRewards(quest: Pick<
    QuestRow,
    'hp_reward' | 'mp_reward' | 'emotion_reward' | 'energy_reward' | 'fatigue_restore'
>) {
    return [
        quest.hp_reward > 0 ? formatVitalEffect('body', quest.hp_reward) : '',
        quest.mp_reward > 0 ? formatVitalEffect('mind', quest.mp_reward) : '',
        quest.emotion_reward > 0 ? formatVitalEffect('emotion', quest.emotion_reward) : '',
        quest.energy_reward > 0 ? formatVitalEffect('energy', quest.energy_reward) : '',
        quest.fatigue_restore > 0 ? formatVitalEffect('fatigue', -quest.fatigue_restore) : '',
    ].filter(Boolean)
}

export function getQuestVitalPenalties(quest: Pick<
    QuestRow,
    'penalty_hp' | 'penalty_mp' | 'penalty_emotion' | 'penalty_energy'
>) {
    return [
        quest.penalty_hp > 0 ? formatVitalEffect('body', -quest.penalty_hp) : '',
        quest.penalty_mp > 0 ? formatVitalEffect('mind', -quest.penalty_mp) : '',
        quest.penalty_emotion > 0 ? formatVitalEffect('emotion', -quest.penalty_emotion) : '',
        quest.penalty_energy > 0 ? formatVitalEffect('energy', -quest.penalty_energy) : '',
    ].filter(Boolean)
}

export async function fetchQuests(userId: string) {
    const result = await supabase
        .from('quests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    if (result.error || !result.data) return result
    try {
        return { ...result, data: await Promise.all(result.data.map((quest) => decryptQuest(quest, userId))) }
    } catch (decryptionError) {
        return { ...result, data: null, error: normalizePersonalDataError(decryptionError) }
    }
}

export async function createQuest(payload: Database['public']['Tables']['quests']['Insert']) {
    const encryptedPayload = {
        ...payload,
        name: await encryptPersonalTextForActiveSession(payload.name, 'quests.name'),
    }
    if (payload.description !== undefined) {
        encryptedPayload.description = await encryptPersonalTextForActiveSession(payload.description, 'quests.description')
    }
    if (payload.unit !== undefined) {
        encryptedPayload.unit = await encryptPersonalTextForActiveSession(payload.unit, 'quests.unit')
    }
    return supabase.from('quests').insert(encryptedPayload).select('id').single()
}

export async function updateQuest(id: string, updates: Database['public']['Tables']['quests']['Update']) {
    const encryptedUpdates = { ...updates }
    if (updates.name !== undefined) {
        encryptedUpdates.name = await encryptPersonalTextForActiveSession(updates.name, 'quests.name')
    }
    if (updates.description !== undefined) {
        encryptedUpdates.description = await encryptPersonalTextForActiveSession(updates.description, 'quests.description')
    }
    if (updates.unit !== undefined) {
        encryptedUpdates.unit = await encryptPersonalTextForActiveSession(updates.unit, 'quests.unit')
    }
    return supabase.from('quests').update(encryptedUpdates).eq('id', id)
}

export async function deleteQuest(id: string) {
    return supabase.from('quests').delete().eq('id', id)
}

export async function generateDailyQuestLogs() {
    const { error } = await supabase.rpc('fail_expired_quest_logs')
    if (error) return { data: null, error }
    return supabase.rpc('generate_daily_quest_logs')
}

export async function addQuestToToday(questId: string) {
    return supabase.rpc('add_quest_to_today', { p_quest_id: questId })
}

export async function fetchTodayQuestLogs(userId: string, day: string) {
    return fetchQuestBoardLogs(userId, day, day)
}

export async function fetchQuestBoardLogs(userId: string, day: string, weekStart: string) {
    const { data: logs, error } = await supabase
        .from('quest_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('quest_date', weekStart)
        .lte('quest_date', day)
        .order('created_at', { ascending: false })

    if (error) return { data: null, error }
    if (!logs?.length) return { data: [], error: null }

    const questIds = [...new Set(logs.map((log) => log.quest_id))]
    const { data: quests, error: questError } = await supabase
        .from('quests')
        .select('*')
        .eq('user_id', userId)
        .in('id', questIds)

    if (questError) return { data: null, error: questError }

    let questsById: Map<string, QuestRow>
    try {
        questsById = new Map(await Promise.all(
            (quests ?? []).map(async (quest) => [quest.id, await decryptQuest(quest, userId)] as const),
        ))
    } catch (decryptionError) {
        return { data: null, error: normalizePersonalDataError(decryptionError) }
    }
    return {
        data: logs
            .map((log) => ({
                ...log,
                quests: questsById.get(log.quest_id) ?? null,
            }))
            .filter((entry) =>
                entry.quest_date === day || entry.quests?.recurrence === 'weekly',
            ),
        error: null,
    }
}

export type QuestHistoryEntry = {
    log: QuestLogRow
    quest: QuestRow | null
}

export async function fetchQuestHistory(userId: string, page: number, pageSize = GAME_RULES.history.pageSize) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data: logs, error, count } = await supabase
        .from('quest_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('quest_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) return { data: null, error, count }
    if (!logs?.length) return { data: [], error: null, count }

    const questIds = [...new Set(logs.map((log) => log.quest_id))]
    const { data: quests, error: questError } = await supabase
        .from('quests')
        .select('*')
        .eq('user_id', userId)
        .in('id', questIds)

    if (questError) return { data: null, error: questError, count }

    let questsById: Map<string, QuestRow>
    try {
        questsById = new Map(await Promise.all(
            (quests ?? []).map(async (quest) => [quest.id, await decryptQuest(quest, userId)] as const),
        ))
    } catch (decryptionError) {
        return { data: null, error: normalizePersonalDataError(decryptionError), count }
    }
    return {
        data: logs.map((log) => ({
            log,
            quest: questsById.get(log.quest_id) ?? null,
        })),
        error: null,
        count,
    }
}

export async function completeQuest(pLogId: string) {
    return supabase.rpc('complete_quest', { p_log_id: pLogId })
}

export async function failQuest(pLogId: string) {
    return supabase.rpc('fail_quest', { p_log_id: pLogId })
}

export type QuestBoardEntry = Omit<QuestLogRow, 'progress_value'> & {
    quests: {
        id: string
        name: string
        description: string | null
        abilities: QuestRow['abilities']
        xp_reward: number
        career_xp_reward: number
        gold_reward: number
        hp_reward: number
        mp_reward: number
        emotion_reward: number
        energy_reward: number
        penalty_hp: number
        penalty_mp: number
        penalty_emotion: number
        penalty_energy: number
        penalty_gold: number
        fatigue_restore: number
        recurrence: string
        prahar: QuestRow['prahar']
        difficulty: QuestRow['difficulty']
        target_value: number
        unit: string | null
    } | null
}
