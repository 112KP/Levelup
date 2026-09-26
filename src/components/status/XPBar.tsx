type XPBarProps = {
    level: number
    xp: number
    xpToNext: number
    levelUp: boolean
}

export function XPBar({ level, xp, xpToNext, levelUp }: XPBarProps) {
    const safeTarget = Math.max(xpToNext, 0)
    const value = Math.min(Math.max(xp, 0), safeTarget)
    const percentage = safeTarget === 0 ? 0 : (value / safeTarget) * 100

    return (
        <section className={`xp-block ${levelUp ? 'level-up' : ''}`} aria-label="Experience">
            <div className="level-number">
                <span className="system-label">LEVEL</span>
                <strong key={level}>{level}</strong>
            </div>
            <div className="xp-progress">
                <div className="xp-heading">
                    <span className="system-label">EXPERIENCE</span>
                    <span className="mono-value" key={`${xp}-${xpToNext}`}>
                        {xp.toLocaleString()} <span>/</span> {xpToNext.toLocaleString()} XP
                    </span>
                </div>
                <div
                    className="xp-track"
                    role="progressbar"
                    aria-label="Experience progress"
                    aria-valuemin={0}
                    aria-valuemax={safeTarget}
                    aria-valuenow={value}
                >
                    <span className="xp-fill" style={{ width: `${percentage}%` }} />
                </div>
                {levelUp && <span className="level-up-label">LEVEL INCREASED</span>}
            </div>
        </section>
    )
}