export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type StatName =
    | 'strength'
    | 'agility'
    | 'sense'
    | 'vitality'
    | 'intelligence'

export type QuestRecurrence = 'daily' | 'weekly' | 'one_time'
export type QuestDifficulty = 'easy' | 'medium' | 'hard'
export type QuestLogStatus = 'pending' | 'completed' | 'failed'
export type SkillType = 'active' | 'passive'
export type ItemType = 'equipment' | 'consumable' | 'material'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
export type DungeonStatus = 'open' | 'in_progress' | 'cleared' | 'failed'
export type EventType =
    | 'xp_gain'
    | 'level_up'
    | 'stat_change'
    | 'penalty'
    | 'purchase'
    | 'quest_complete'
    | 'dungeon_clear'

export type ProfileRow = {
    id: string
    user_id: string
    display_name: string | null
    job: string
    rank: Rank
    active_title_id: string | null
    level: number
    hp_current: number
    hp_max: number
    mp_current: number
    mp_max: number
    fatigue: number
    xp: number
    xp_to_next: number
    strength: number
    agility: number
    sense: number
    vitality: number
    intelligence: number
    available_points: number
    gold: number
    created_at: string
    updated_at: string
}

export type TitleRow = {
    id: string
    user_id: string
    created_at: string
    updated_at: string
    name: string
    description: string | null
    unlock_condition: string | null
    bonus_stat: StatName | null
    bonus_amount: number
    unlocked_at: string | null
    is_active: boolean
}

export type QuestRow = {
    id: string
    user_id: string
    name: string
    description: string | null
    recurrence: QuestRecurrence
    difficulty: QuestDifficulty
    target_value: number
    unit: string | null
    xp_reward: number
    gold_reward: number
    stat_reward: StatName | null
    stat_reward_amount: number
    penalty_hp: number
    penalty_gold: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export type QuestStatRewardRow = {
    user_id: string
    quest_id: string
    stat_name: StatName
    amount: number
    created_at: string
}

export type QuestLogRow = {
    id: string
    user_id: string
    quest_id: string
    quest_date: string
    progress_value: number
    status: QuestLogStatus
    completed_at: string | null
    penalty_applied: boolean
    created_at: string
    updated_at: string
}

export type SkillRow = {
    id: string
    user_id: string
    name: string
    description: string | null
    skill_type: SkillType
    skill_level: number
    linked_stat: StatName | null
    mp_cost: number
    cooldown_minutes: number
    unlocked_at: string | null
    created_at: string
    updated_at: string
}

export type ItemRow = {
    id: string
    user_id: string
    name: string
    description: string | null
    item_type: ItemType
    rarity: Rarity
    quantity: number
    is_equipped: boolean
    stat_bonus: Json
    created_at: string
    updated_at: string
}

export type DungeonRow = {
    id: string
    user_id: string
    name: string
    dungeon_rank: Rank
    status: DungeonStatus
    xp_reward: number
    gold_reward: number
    deadline: string | null
    cleared_at: string | null
    created_at: string
    updated_at: string
}

export type ActivityLogRow = {
    id: string
    user_id: string
    event_type: EventType
    description: string | null
    amount: number
    snapshot: Json | null
    created_at: string
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: ProfileRow
                Insert: never
                Update: { display_name?: string | null; job?: string }
                Relationships: []
            }
            titles: {
                Row: TitleRow
                Insert: never
                Update: never
                Relationships: []
            }
            quests: {
                Row: QuestRow
                Insert: {
                    id?: string
                    user_id?: string
                    name: string
                    description?: string | null
                    recurrence?: QuestRecurrence
                    difficulty?: QuestDifficulty
                    target_value?: number
                    unit?: string | null
                    xp_reward?: number
                    gold_reward?: number
                    stat_reward?: StatName | null
                    stat_reward_amount?: number
                    penalty_hp?: number
                    penalty_gold?: number
                    is_active?: boolean
                }
                Update: Partial<Database['public']['Tables']['quests']['Insert']>
                Relationships: []
            }
            quest_stat_rewards: {
                Row: QuestStatRewardRow
                Insert: never
                Update: never
                Relationships: []
            }
            quest_logs: {
                Row: QuestLogRow
                Insert: never
                Update: { progress_value?: number }
                Relationships: []
            }
            skills: {
                Row: SkillRow
                Insert: {
                    id?: string
                    user_id?: string
                    name: string
                    description?: string | null
                    skill_type?: SkillType
                    skill_level?: number
                    linked_stat?: StatName | null
                    mp_cost?: number
                    cooldown_minutes?: number
                    unlocked_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['skills']['Insert']>
                Relationships: []
            }
            items: {
                Row: ItemRow
                Insert: {
                    id?: string
                    user_id?: string
                    name: string
                    description?: string | null
                    item_type?: ItemType
                    rarity?: Rarity
                    quantity?: number
                    is_equipped?: boolean
                    stat_bonus?: Json
                }
                Update: Partial<Database['public']['Tables']['items']['Insert']>
                Relationships: []
            }
            dungeons: {
                Row: DungeonRow
                Insert: {
                    id?: string
                    user_id?: string
                    name: string
                    dungeon_rank?: Rank
                    xp_reward?: number
                    gold_reward?: number
                    deadline?: string | null
                }
                Update: Partial<Omit<Database['public']['Tables']['dungeons']['Insert'], 'id' | 'user_id'>>
                Relationships: []
            }
            activity_log: {
                Row: ActivityLogRow
                Insert: never
                Update: never
                Relationships: []
            }
        }
        Views: Record<string, never>
        Functions: {
            allocate_points: {
                Args: { p_stat: StatName; p_points?: number }
                Returns: void
            }
            generate_daily_quest_logs: {
                Args: Record<string, never>
                Returns: number
            }
            complete_quest: {
                Args: { p_log_id: string }
                Returns: void
            }
            fail_quest: {
                Args: { p_log_id: string }
                Returns: void
            }
            set_quest_stat_rewards: {
                Args: { p_quest_id: string; p_stat_rewards: Json }
                Returns: void
            }
            set_dungeon_status: {
                Args: { p_dungeon_id: string; p_status: DungeonStatus }
                Returns: void
            }
            clear_dungeon: {
                Args: { p_dungeon_id: string }
                Returns: Json
            }
            set_active_title: {
                Args: { p_title_id: string | null }
                Returns: void
            }
            recheck_my_titles: {
                Args: Record<string, never>
                Returns: void
            }
        }
        Enums: Record<string, never>
        CompositeTypes: Record<string, never>
    }
}

export type Profile = ProfileRow