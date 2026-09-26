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

export type ProfileRow = {
    id: string
    user_id: string
    display_name: string | null
    job: string | null
    rank: string | null
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
    name: string
    description: string | null
    created_at: string
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: ProfileRow
                Insert: Partial<ProfileRow> & Pick<ProfileRow, 'user_id'>
                Update: Partial<ProfileRow>
                Relationships: []
            }
            titles: {
                Row: TitleRow
                Insert: Partial<TitleRow> & Pick<TitleRow, 'name'>
                Update: Partial<TitleRow>
                Relationships: []
            }
        }
        Views: Record<string, never>
        Functions: {
            allocate_points: {
                Args: { stat_name: StatName; points: number }
                Returns: undefined
            }
        }
        Enums: Record<string, never>
        CompositeTypes: Record<string, never>
    }
}

export type Profile = ProfileRow