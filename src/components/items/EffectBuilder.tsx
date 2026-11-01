import { useState } from 'react'
import {
    BrainCircuit,
    BriefcaseBusiness,
    Dumbbell,
    Eye,
    HeartPulse,
    Wind,
} from 'lucide-react'
import { ValueStepper } from '../ValueStepper'
import {
    formatItemEffectSummary,
    itemAttributeKeys,
} from '../../lib/items'
import type { ItemAttributeKey, ItemEffects } from '../../lib/items'
import type { ItemType } from '../../types/database.types'
import { VITAL_LABELS } from '../../lib/vitals'

const attributes: Array<{ key: ItemAttributeKey; label: string; icon: typeof Dumbbell }> = [
    { key: 'strength', label: 'Strength', icon: Dumbbell },
    { key: 'agility', label: 'Agility', icon: Wind },
    { key: 'sense', label: 'Sense', icon: Eye },
    { key: 'vitality', label: 'Vitality', icon: HeartPulse },
    { key: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
    { key: 'career', label: 'Career', icon: BriefcaseBusiness },
]

const effectSteppers = [
    { key: 'hp', label: VITAL_LABELS.body },
    { key: 'mp', label: VITAL_LABELS.mind },
    { key: 'emotion', label: VITAL_LABELS.emotion },
    { key: 'energy', label: VITAL_LABELS.energy },
    { key: 'fatigue', label: VITAL_LABELS.fatigue },
    { key: 'gold', label: 'Gold' },
] as const

type EffectBuilderProps = {
    itemType: Exclude<ItemType, 'material'>
    effects: ItemEffects
    onChange: (effects: ItemEffects) => void
}

function initialAttributeMode(effects: ItemEffects): 'same' | 'individual' {
    const values = itemAttributeKeys.map((key) => effects[key] ?? 0)
    return values.every((value) => value === values[0]) ? 'same' : 'individual'
}

export function EffectBuilder({ itemType, effects, onChange }: EffectBuilderProps) {
    const [attributeMode, setAttributeMode] = useState(() => initialAttributeMode(effects))

    function changeVital(key: typeof effectSteppers[number]['key'], value: number) {
        onChange({ ...effects, [key]: value })
    }

    function changeAttributeMode(mode: 'same' | 'individual') {
        if (mode === attributeMode) return
        setAttributeMode(mode)
        onChange({
            ...effects,
            strength: 0,
            agility: 0,
            sense: 0,
            vitality: 0,
            intelligence: 0,
            career: 0,
        })
    }

    function changeAllAttributes(value: number) {
        onChange({
            ...effects,
            strength: value,
            agility: value,
            sense: value,
            vitality: value,
            intelligence: value,
            career: value,
        })
    }

    function changeAttribute(key: ItemAttributeKey, value: number) {
        onChange({ ...effects, [key]: value })
    }

    const summary = formatItemEffectSummary(effects)

    return (
        <section className="effect-builder" aria-labelledby="effect-builder-title">
            <header className="effect-builder-heading">
                <div>
                    <p className="eyebrow">ITEM EFFECTS</p>
                    <h4 id="effect-builder-title">Effect Builder</h4>
                </div>
            </header>

            {itemType === 'consumable' && (
                <div className="effect-vitals-grid">
                    {effectSteppers.map(({ key, label }) => (
                        <ValueStepper
                            key={key}
                            label={label}
                            value={effects[key] ?? 0}
                            onChange={(value) => changeVital(key, value)}
                            min={-100}
                            max={100}
                        />
                    ))}
                </div>
            )}

            <section className="effect-attributes" aria-labelledby="effect-attributes-title">
                <div className="effect-subheading">
                    <h5 id="effect-attributes-title">Attributes</h5>
                    <div className="effect-mode-control" role="group" aria-label="Attribute effect mode">
                        <button
                            type="button"
                            aria-pressed={attributeMode === 'same'}
                            className={attributeMode === 'same' ? 'is-active' : ''}
                            onClick={() => changeAttributeMode('same')}
                        >
                            Same value for all attributes
                        </button>
                        <button
                            type="button"
                            aria-pressed={attributeMode === 'individual'}
                            className={attributeMode === 'individual' ? 'is-active' : ''}
                            onClick={() => changeAttributeMode('individual')}
                        >
                            Set individually
                        </button>
                    </div>
                </div>

                {attributeMode === 'same' ? (
                    <>
                        <ValueStepper
                            label="All Attributes"
                            value={effects.strength ?? 0}
                            onChange={changeAllAttributes}
                            min={0}
                            max={100}
                        />
                        <p className="effect-mode-note">
                            Applies equally to all six abilities.
                        </p>
                    </>
                ) : (
                    <div className="effect-attributes-grid">
                        {attributes.map(({ key, label, icon: Icon }) => (
                            <div className="effect-attribute-item" key={key}>
                                <Icon size={17} aria-hidden="true" />
                                <ValueStepper
                                    label={label}
                                    value={effects[key] ?? 0}
                                    onChange={(value) => changeAttribute(key, value)}
                                    min={0}
                                    max={100}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <p className={`effect-summary${summary ? '' : ' is-empty'}`} role="status">
                {summary
                    ? `${itemType === 'equipment' ? 'While equipped, this item grants:' : 'Using this item will:'} ${summary}.`
                    : 'This item has no effect when used.'}
            </p>
        </section>
    )
}