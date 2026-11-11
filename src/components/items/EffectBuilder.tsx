import { ValueStepper } from '../ValueStepper'
import { formatItemEffectSummary } from '../../lib/items'
import type { ItemEffects } from '../../lib/items'
import type { ItemType } from '../../types/database.types'
import { VITAL_LABELS } from '../../lib/vitals'
import { GAME_RULES } from '../../lib/gameRules'

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

export function EffectBuilder({ itemType, effects, onChange }: EffectBuilderProps) {
    function changeVital(key: typeof effectSteppers[number]['key'], value: number) {
        onChange({ ...effects, [key]: value })
    }

    const summary = formatItemEffectSummary(effects, itemType)

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
                            min={GAME_RULES.itemEffects.minimum}
                            max={GAME_RULES.itemEffects.maximum}
                        />
                    ))}
                </div>
            )}

            <p className={`effect-summary${summary ? '' : ' is-empty'}`} role="status">
                {summary
                    ? `${itemType === 'equipment' ? 'While equipped, this item grants:' : 'Using this item will:'} ${summary}.`
                    : itemType === 'equipment' ? 'This item has no passive effect while equipped.' : 'This item has no effect when used.'}
            </p>
        </section>
    )
}