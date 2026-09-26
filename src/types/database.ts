export type StatName =
    | 'strength'
    | 'agility'
    | 'sense'
    | 'vitality'
    | 'intelligence'

export interface Profile {
    id: string
    display_name: string | null
    job: string | null
    rank: string | null
    active_title: string | null
    level: number
    hp: number
    max_hp: number
    mp: number
    max_mp: number
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
}