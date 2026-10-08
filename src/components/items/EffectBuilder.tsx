import { useState } from 'react'
import {
    BrainCircuit,
    Dumbbell,
    Eye,
    HeartPulse,
    Minus,
    Plus,
    Wind,
} from 'lucide-react'
import {
    formatItemEffectSummary,
    itemAttributeKeys,
} from '../../lib/items'
import type { ItemAttributeKey, ItemEffects } from '../../lib/items'
import type { ItemType } from '../../types/database'

const attributes: Array<{ key: ItemAttributeKey; label: string; icon: typeof Dumbbell }> = [
    { key: 'strength', label: 'Strength', icon: Dumbbell },
    { key: 'agility', label: 'Agility', icon: Wind },
    { key: 'sense', label: 'Sense', icon: Eye },
    { key: 'vitality', label: 'Vitality', icon: HeartPulse },
    { key: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
]

const effectSteppers = [
    { key: 'hp', label: 'HP' },
    { key: 'fatigue', label: 'Fatigue' },
    { key: 'gold', label: 'Gold' },
    { key: 'mp', label: 'MP' },
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

function Stepper({
    label,
    value,
    onChange,
}: {
    label: string
    value: number
    onChange: (value: number) => void
}) {
    const amount = Math.max(-100, Math.min(100, Math.trunc(value)))
    return (
        <div className="effect-stepper" role="group" aria-label={`${label} effect`}>
            <span className="effect-stepper-label">{label}</span>
            <div className="effect-stepper-controls">
                <button
                    type="button"
                    className="effect-stepper-button"
                    aria-label={`Decrease ${label}; current value ${amount}`}
                    disabled={amount <= -100}
                    onClick={() => onChange(Math.max(-100, amount - 1))}
                >
                    <Minus size={15} aria-hidden="true" />
                </button>
                <output className="effect-stepper-value" aria-live="polite">{amount}</output>
                <button
                    type="button"
                    className="effect-stepper-button"
                    aria-label={`Increase ${label}; current value ${amount}`}
                    disabled={amount >= 100}
                    onClick={() => onChange(Math.min(100, amount + 1))}
                >
                    <Plus size={15} aria-hidden="true" />
                </button>
            </div>
        </div>
    )
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
                        <Stepper
                            key={key}
                            label={label}
                            value={effects[key] ?? 0}
                            onChange={(value) => changeVital(key, value)}
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
                        <Stepper
                            label="All Attributes"
                            value={effects.strength ?? 0}
                            onChange={changeAllAttributes}
                        />
                        <p className="effect-mode-note">
                            Applies to Strength, Agility, Sense, Vitality, and Intelligence equally.
                        </p>
                    </>
                ) : (
                    <div className="effect-attributes-grid">
                        {attributes.map(({ key, label, icon: Icon }) => (
                            <div className="effect-attribute-item" key={key}>
                                <Icon size={17} aria-hidden="true" />
                                <Stepper
                                    label={label}
                                    value={effects[key] ?? 0}
                                    onChange={(value) => changeAttribute(key, value)}
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