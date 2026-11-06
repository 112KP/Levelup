import type { AbilityName } from '../types/database.types'

export type VitalName = 'body' | 'mind' | 'emotion' | 'energy' | 'fatigue'

export const VITAL_LABELS: Record<VitalName, string> = {
    body: 'Body',
    mind: 'Mind',
    emotion: 'Emotion',
    energy: 'Energy',
    fatigue: 'Fatigue',
}

export const ABILITY_VITAL_CEILINGS: Record<AbilityName, readonly VitalName[]> = {
    strength: ['body', 'mind'],
    agility: ['body', 'mind'],
    sense: ['emotion'],
    vitality: ['energy'],
    intelligence: ['mind'],
}

export function formatVitalEffect(vital: VitalName, amount: number) {
    const sign = amount < 0 ? '\u2212' : '+'
    return `${sign}${Math.abs(amount)} ${VITAL_LABELS[vital]}`
}

export function formatVitalEffects(effects: Partial<Record<VitalName, number>>) {
    return (Object.keys(VITAL_LABELS) as VitalName[])
        .flatMap((vital) => {
            const amount = effects[vital]
            return amount ? [formatVitalEffect(vital, amount)] : []
        })
        .join(', ')
}

export function formatCeilingIncrease(ability: AbilityName, points: number) {
    return ABILITY_VITAL_CEILINGS[ability]
        .map((vital) => `${VITAL_LABELS[vital]} ceiling +${points}`)
        .join(', ')
}

export function replaceLegacyVitalLabels(value: string) {
    return value
        .replace(/\bHP\b/gi, VITAL_LABELS.body)
        .replace(/\bMP\b/gi, VITAL_LABELS.mind)
}
