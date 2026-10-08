import { supabase } from './supabaseClient'
import type { Database, QuestLogRow, QuestRow, QuestStatRewardRow } from '../types/database'

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

export async function fetchQuestStatRewards(userId: string) {
    return supabase
        .from('quest_stat_rewards')
        .select('*')
        .eq('user_id', userId)
}

export async function setQuestStatRewards(
    questId: string,
    rewards: Array<Pick<QuestStatRewardRow, 'stat_name' | 'amount'>>,
) {
    return supabase.rpc('set_quest_stat_rewards', {
        p_quest_id: questId,
        p_stat_rewards: rewards,
    })
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
            'id, user_id, quest_id, quest_date, progress_value, status, completed_at, penalty_applied, created_at, updated_at, quests:quest_id (id, name, description, xp_reward, gold_reward, penalty_hp, penalty_gold, stat_reward, stat_reward_amount, recurrence, prahar, difficulty, target_value, unit)',
        )
        .eq('user_id', userId)
        .eq('quest_date', day)
        .order('created_at', { ascending: false })
}

export async function completeQuest(pLogId: string) {
    return supabase.rpc('complete_quest', { p_log_id: pLogId })
}

export async function failQuest(pLogId: string) {
    return supabase.rpc('fail_quest', { p_log_id: pLogId })
}

export type QuestBoardEntry = QuestLogRow & {
    quests: {
        id: string
        name: string
        description: string | null
        xp_reward: number
        gold_reward: number
        penalty_hp: number
        penalty_gold: number
        stat_reward: QuestRow['stat_reward']
        stat_reward_amount: number
        recurrence: string
        prahar: QuestRow['prahar']
        difficulty: QuestRow['difficulty']
        target_value: number
        unit: string | null
    } | null
}
