import { Minus, Plus } from 'lucide-react'

type ValueStepperProps = {
    label: string
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
}

export function ValueStepper({
    label,
    value,
    onChange,
    min = 0,
    max = 2_147_483_647,
}: ValueStepperProps) {
    const amount = Math.max(min, Math.min(max, Math.trunc(value)))

    return (
        <div className="effect-stepper" role="group" aria-label={`${label} effect`}>
            <span className="effect-stepper-label">{label}</span>
            <div className="effect-stepper-controls">
                <button
                    type="button"
                    className="effect-stepper-button"
                    aria-label={`Decrease ${label}; current value ${amount}`}
                    disabled={amount <= min}
                    onClick={() => onChange(Math.max(min, amount - 1))}
                >
                    <Minus size={15} aria-hidden="true" />
                </button>
                <output className="effect-stepper-value" aria-live="polite">{amount}</output>
                <button
                    type="button"
                    className="effect-stepper-button"
                    aria-label={`Increase ${label}; current value ${amount}`}
                    disabled={amount >= max}
                    onClick={() => onChange(Math.min(max, amount + 1))}
                >
                    <Plus size={15} aria-hidden="true" />
                </button>
            </div>
        </div>
    )
}
