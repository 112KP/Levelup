type XPBarProps = {
    level: number
    xp: number
    xpToNext: number
    careerXp: number
    xpCareerLinked: boolean
    linkingProgress: boolean
    onSetProgressLinked: (linked: boolean) => void
    levelUp: boolean
}

export function XPBar({
    level,
    xp,
    xpToNext,
    careerXp,
    xpCareerLinked,
    linkingProgress,
    onSetProgressLinked,
    levelUp,
}: XPBarProps) {
    const safeTarget = Math.max(xpToNext, 0)
    const value = Math.min(Math.max(xp, 0), safeTarget)
    const percentage = safeTarget === 0 ? 0 : (value / safeTarget) * 100
    const careerValue = Math.min(Math.max(careerXp, 0), safeTarget)
    const careerPercentage = safeTarget === 0 ? 0 : (careerValue / safeTarget) * 100

    return (
        <section className={`xp-block ${levelUp ? 'level-up' : ''}`} aria-label="Progress">
            <div className="xp-progress-stack">
                <div className="xp-progress">
                    <div className="xp-heading">
                        <div className="xp-heading-title">
                            <span className="system-label">EXPERIENCE</span>
                            <span className="level-number">
                                <span className="system-label">LEVEL</span>
                                <strong key={level}>{level}</strong>
                            </span>
                        </div>
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
                </div>
                <div className="xp-progress career-progress">
                    <div className="xp-heading">
                        <span className="system-label">CAREER EXPERIENCE</span>
                        <span className="mono-value" key={`${careerXp}-${xpToNext}`}>
                            {careerXp.toLocaleString()} <span>/</span> {xpToNext.toLocaleString()} XP
                        </span>
                    </div>
                    <div
                        className="xp-track"
                        role="progressbar"
                        aria-label="Career experience progress"
                        aria-valuemin={0}
                        aria-valuemax={safeTarget}
                        aria-valuenow={careerValue}
                    >
                        <span className="career-xp-fill" style={{ width: `${careerPercentage}%` }} />
                    </div>
                </div>
                <div className="progress-link-control" data-profile-share-exclude>
                    <label htmlFor="xp-career-linked">Link XP and Career</label>
                    <button
                        id="xp-career-linked"
                        className={`toggle-pill ${xpCareerLinked ? 'on' : 'off'}`}
                        type="button"
                        role="switch"
                        aria-checked={xpCareerLinked}
                        disabled={linkingProgress}
                        onClick={() => onSetProgressLinked(!xpCareerLinked)}
                    >
                        {linkingProgress ? 'Updating...' : xpCareerLinked ? 'Linked' : 'Unlinked'}
                    </button>
                </div>
                {levelUp && <span className="level-up-label">LEVEL INCREASED</span>}
            </div>
        </section>
    )
}