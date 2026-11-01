import type { AbilityName } from '../types/database.types'

export const ABILITY_OPTIONS: Array<{ value: AbilityName; label: string }> = [
    { value: 'strength', label: 'Strength' },
    { value: 'agility', label: 'Agility' },
    { value: 'sense', label: 'Sense' },
    { value: 'vitality', label: 'Vitality' },
    { value: 'intelligence', label: 'Intelligence' },
    { value: 'career', label: 'Career' },
]

export const MAX_ABILITIES_PER_QUEST = ABILITY_OPTIONS.length

export function getAbilityLabel(ability: AbilityName) {
    return ABILITY_OPTIONS.find((option) => option.value === ability)?.label ?? ability
}
