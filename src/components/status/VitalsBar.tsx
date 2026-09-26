type VitalsBarProps = {
    label: string
    current: number
    max: number
    kind: 'hp' | 'mp' | 'fatigue'
}

export function VitalsBar({ label, current, max, kind }: VitalsBarProps) {
    const safeMax = Math.max(max, 0)
    const value = Math.min(Math.max(current, 0), safeMax)
    const percentage = safeMax === 0 ? 0 : (value / safeMax) * 100
    const fatigueTone = current >= 75 ? 'fatigue-high' : current >= 45 ? 'fatigue-mid' : 'fatigue-low'

    return (
        <div className={`vital vital-${kind}`}>
            <div className="vital-heading">
                <span className="system-label">{label}</span>
                <span className="vital-value" key={`${current}-${max}`}>
                    {current}<span className="vital-separator"> / </span>{max}
                </span>
            </div>
            <div
                className={`vital-track ${kind === 'fatigue' ? fatigueTone : ''}`}
                role="progressbar"
                aria-label={`${label}: ${current} of ${max}`}
                aria-valuemin={0}
                aria-valuemax={safeMax}
                aria-valuenow={value}
            >
                <span className="vital-fill" style={{ width: `${percentage}%` }} />
            </div>
        </div>
    )
}