import { supabase } from './supabaseClient'
import type { AbilityStreakRefreshRow, StreakMilestoneRow } from '../types/database.types'
import { getAbilityLabel } from './abilities'
import { formatCeilingIncrease } from './vitals'

export function refreshAbilityStreaks() {
    return supabase.rpc('refresh_ability_streaks')
}

export function fetchStreakMilestones() {
    return supabase
        .from('streak_milestones')
        .select('days, points')
        .order('days', { ascending: true })
}

export function getStreakMilestoneMessages(
    previousStreaks: AbilityStreakRefreshRow[],
    updatedStreaks: AbilityStreakRefreshRow[],
    milestones: StreakMilestoneRow[],
) {
    const previousByAbility = new Map(previousStreaks.map((streak) => [streak.ability, streak]))

    return updatedStreaks.flatMap((streak) => {
        const previousHighest = previousByAbility.get(streak.ability)?.highest_milestone_paid ?? 0
        return milestones
            .filter((milestone) => milestone.days > previousHighest && milestone.days <= streak.highest_milestone_paid)
            .map((milestone) =>
                `+${milestone.points} ${getAbilityLabel(streak.ability)}: ${formatCeilingIncrease(streak.ability, milestone.points)}`,
            )
    })
}
