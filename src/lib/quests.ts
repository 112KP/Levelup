import { supabase } from './supabaseClient'
import type { Database, QuestLogRow, QuestRow } from '../types/database.types'
import { formatVitalEffect } from './vitals'
import { GAME_RULES } from './gameRules'

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
    return supabase
        .from('quests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
}

export async function createQuest(payload: Database['public']['Tables']['quests']['Insert']) {
    return supabase.from('quests').insert(payload).select('id').single()
}

export async function updateQuest(id: string, updates: Database['public']['Tables']['quests']['Update']) {
    return supabase.from('quests').update(updates).eq('id', id)
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
    return supabase
        .from('quest_logs')
        .select(
            'id, user_id, quest_id, quest_date, status, completed_at, penalty_applied, created_at, updated_at, quests:quest_id (id, name, description, abilities, xp_reward, gold_reward, hp_reward, mp_reward, emotion_reward, energy_reward, penalty_hp, penalty_mp, penalty_emotion, penalty_energy, penalty_gold, fatigue_restore, recurrence, prahar, difficulty, target_value, unit)',
        )
        .eq('user_id', userId)
        .eq('quest_date', day)
        .order('created_at', { ascending: false })
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

    const questsById = new Map((quests ?? []).map((quest) => [quest.id, quest]))
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

    const questsById = new Map((quests ?? []).map((quest) => [quest.id, quest]))
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
