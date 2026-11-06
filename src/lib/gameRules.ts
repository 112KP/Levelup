export const GAME_RULES = {
    // SQL source: public.handle_new_user and public.reset_my_progress set the starting values.
    progression: {
        startingLevel: 1,
        startingXp: 0,
        startingXpToNext: 100,
        xpMultiplier: 100,
        xpExponent: 1.5,
        exampleRewardBonus: 20,
        rankThresholds: [
            { rank: 'S', level: 70 },
            { rank: 'A', level: 50 },
            { rank: 'B', level: 35 },
            { rank: 'C', level: 20 },
            { rank: 'D', level: 10 },
        ],
    },
    // SQL source: public.handle_new_user, public.reset_my_progress, and public.vital_caps.
    abilities: {
        startingValue: 10,
        baseAllocationCost: 1,
        names: ['Strength', 'Agility', 'Sense', 'Vitality', 'Intelligence'],
    },
    // SQL source: public.vital_caps, public.sync_profile_vital_caps, and the profiles table checks.
    vitals: {
        startingCeiling: 100,
        ceilingPerAbilityPoint: 1,
        fatigueMinimum: 0,
        fatigueMaximum: 100,
        fatigueColorThresholds: {
            medium: 45,
            high: 75,
        },
    },
    // SQL source: public.fail_quest, public.clear_dungeon, and public.use_item enforce this floor.
    gold: {
        minimum: 0,
        exampleStartingBalance: 8,
        examplePenalty: 12,
    },
    // SQL source: public.use_item clamps each configured effect to this range.
    itemEffects: {
        minimum: -100,
        maximum: 100,
    },
    history: {
        pageSize: 20,
    },
    profile: {
        displayNameMaxLength: 50,
    },
    quests: {
        manualAddableRecurrences: ['weekly', 'one_time'],
        completionPerAbilityPerDay: 1,
        nameMaxLength: 120,
    },
    examples: {
        skillMindCost: 5,
        itemQuantity: 2,
    },
    dungeons: {
        ranks: ['E', 'D', 'C', 'B', 'A', 'S'],
        nameMaxLength: 120,
    },
    // SQL source: public.check_title_unlocks defines these unlocks and displayed bonus values.
    titles: {
        levelUnlocks: [
            { name: 'Rising Hunter', level: 10, bonus: null },
            { name: 'Veteran Hunter', level: 25, bonus: null },
            { name: 'Elite Hunter', level: 50, bonus: { ability: 'Vitality', amount: 3 } },
            { name: 'Monarch', level: 75, bonus: { ability: 'Intelligence', amount: 5 } },
        ],
        streakUnlock: {
            name: 'Iron Will',
            days: 7,
            bonus: { ability: 'Vitality', amount: 2 },
        },
    },
} as const

export function getXpNeededAtLevel(level: number) {
    return Math.round(GAME_RULES.progression.xpMultiplier * level ** GAME_RULES.progression.xpExponent)
}

// SQL source: public.apply_rewards computes each next-level threshold with this formula.
export function getXpFormulaLabel() {
    return `${GAME_RULES.progression.xpMultiplier} × level^${GAME_RULES.progression.xpExponent}, rounded to the nearest whole XP`
}

// SQL source: public.compute_rank uses these thresholds, with E below the first threshold.
export function getRankForLevel(level: number) {
    return GAME_RULES.progression.rankThresholds.find((threshold) => level >= threshold.level)?.rank ?? 'E'
}

// SQL source: public.vital_caps defines the base, starting ability, and ceiling increase.
export function getVitalCeilingIncrease(points: number) {
    return points * GAME_RULES.vitals.ceilingPerAbilityPoint
}
