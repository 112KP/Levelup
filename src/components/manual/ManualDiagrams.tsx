import type { StreakMilestoneRow } from '../../types/database.types'

type ManualDiagramProps = {
    name: 'big-picture' | 'streak-timeline' | 'shield-decision' | 'vital-bar' | 'ability-map'
    milestones: StreakMilestoneRow[]
}

function DiagramNode({ x, y, width, title, detail }: {
    x: number
    y: number
    width: number
    title: string
    detail?: string
}) {
    return (
        <g>
            <rect x={x} y={y} width={width} height="48" rx="8" />
            <text x={x + width / 2} y={y + 21} textAnchor="middle" className="diagram-title">{title}</text>
            {detail && <text x={x + width / 2} y={y + 37} textAnchor="middle" className="diagram-detail">{detail}</text>}
        </g>
    )
}

export function ManualDiagrams({ name, milestones }: ManualDiagramProps) {
    const first = milestones[0]
    const next = milestones[1] ?? first

    if (name === 'big-picture') {
        return (
            <svg className="manual-diagram" viewBox="0 0 640 264" role="img" aria-labelledby="big-picture-title big-picture-desc">
                <title id="big-picture-title">How progress connects</title>
                <desc id="big-picture-desc">Quests award experience, gold, and vital effects. Ability tags lead to streaks, which award ability points that raise vital ceilings. Dungeon clears and consumables change current vitals.</desc>
                <defs><marker id="manual-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" /></marker></defs>
                <g className="diagram-arrows" markerEnd="url(#manual-arrow)">
                    <path d="M125 39 H174" /><path d="M264 39 H314" /><path d="M404 39 H454" />
                    <path d="M70 63 V102" /><path d="M125 126 H174" /><path d="M264 126 H314" /><path d="M404 126 H454" />
                    <path d="M509 150 V184" /><path d="M229 208 H314" /><path d="M454 208 H404" />
                </g>
                <g className="diagram-nodes">
                    <DiagramNode x={15} y={15} width={110} title="Quests" detail="complete" />
                    <DiagramNode x={174} y={15} width={90} title="XP" detail="and gold" />
                    <DiagramNode x={314} y={15} width={90} title="Level" detail="and Rank" />
                    <DiagramNode x={454} y={15} width={132} title="Titles" detail="display only" />
                    <DiagramNode x={15} y={102} width={110} title="Ability tags" detail="choose streaks" />
                    <DiagramNode x={174} y={102} width={90} title="Streaks" detail="by ability" />
                    <DiagramNode x={314} y={102} width={90} title="Milestones" detail="award points" />
                    <DiagramNode x={454} y={102} width={132} title="Abilities" detail="raise ceilings" />
                    <DiagramNode x={15} y={184} width={214} title="Quest effects, items" detail="and dungeon clears" />
                    <DiagramNode x={314} y={184} width={90} title="Current vitals" />
                    <DiagramNode x={454} y={184} width={132} title="Vital ceilings" />
                </g>
            </svg>
        )
    }

    if (name === 'streak-timeline') {
        const firstDay = first ? `${first.days} days` : 'Milestone'
        const secondDay = next ? `${next.days} days` : 'Next milestone'
        const fallback = first ? `${first.days} paid` : '0 if none paid'
        return (
            <svg className="manual-diagram" viewBox="0 0 640 204" role="img" aria-labelledby="streak-title streak-desc">
                <title id="streak-title">Streak milestones and a missed day</title>
                <desc id="streak-desc">A streak earns its first milestone, continues toward the next one, then a missed day returns the current count to the last paid milestone.</desc>
                <path className="diagram-timeline" d="M60 92 H578" />
                <g className="diagram-milestone">
                    <circle cx="120" cy="92" r="13" /><text x="120" y="49" textAnchor="middle">{firstDay}</text>
                    <text x="120" y="133" textAnchor="middle" className="diagram-detail">paid</text>
                    <circle cx="320" cy="92" r="13" /><text x="320" y="49" textAnchor="middle">{secondDay}</text>
                    <text x="320" y="133" textAnchor="middle" className="diagram-detail">next reward</text>
                    <circle cx="500" cy="92" r="13" className="diagram-miss" /><text x="500" y="49" textAnchor="middle">Missed day</text>
                    <text x="500" y="133" textAnchor="middle" className="diagram-detail">count falls back</text>
                </g>
                <path className="diagram-fallback" d="M500 111 C500 176 120 176 120 111" />
                <text x="310" y="193" textAnchor="middle" className="diagram-caption">Returns to the last paid milestone: {fallback}</text>
            </svg>
        )
    }

    if (name === 'shield-decision') {
        return (
            <svg className="manual-diagram" viewBox="0 0 640 216" role="img" aria-labelledby="shield-title shield-desc">
                <title id="shield-title">What happens when the game day ends</title>
                <desc id="shield-desc">If an ability gets a quest-completion hit, its streak advances. If it gets no hit, it falls back to the last paid milestone. Shields are not implemented.</desc>
                <g className="diagram-nodes">
                    <DiagramNode x={228} y={15} width={184} title="At least one hit?" detail="for this ability today" />
                    <DiagramNode x={42} y={112} width={216} title="Yes: streak advances" detail="one hit per ability per day" />
                    <DiagramNode x={382} y={112} width={216} title="No: streak falls back" detail="to last paid milestone" />
                </g>
                <g className="diagram-arrows">
                    <path d="M272 63 L165 110" /><path d="M368 63 L475 110" />
                </g>
                <text x="188" y="82" className="diagram-caption">Hit</text>
                <text x="440" y="82" className="diagram-caption">No hit</text>
                <text x="320" y="195" textAnchor="middle" className="diagram-warning">Shields are not implemented in the current app.</text>
            </svg>
        )
    }

    if (name === 'vital-bar') {
        return (
            <svg className="manual-diagram" viewBox="0 0 640 150" role="img" aria-labelledby="vital-title vital-desc">
                <title id="vital-title">Current vital value and ceiling</title>
                <desc id="vital-desc">A vital bar shows current value compared with its ceiling. An ability point can raise the ceiling without refilling current value.</desc>
                <text x="38" y="38" className="diagram-title">Current</text>
                <text x="600" y="38" textAnchor="end" className="diagram-title">Ceiling</text>
                <rect className="diagram-bar-track" x="38" y="58" width="562" height="28" rx="14" />
                <rect className="diagram-bar-fill" x="38" y="58" width="365" height="28" rx="14" />
                <line className="diagram-bar-marker" x1="600" y1="48" x2="600" y2="100" />
                <text x="38" y="124" className="diagram-detail">Effects change current value.</text>
                <text x="600" y="124" textAnchor="end" className="diagram-detail">Ability points raise the ceiling only.</text>
            </svg>
        )
    }

    return (
        <svg className="manual-diagram" viewBox="0 0 640 256" role="img" aria-labelledby="ability-map-title ability-map-desc">
            <title id="ability-map-title">Ability to vital ceiling connections</title>
            <desc id="ability-map-desc">Strength and Agility raise Body and Mind. Intelligence raises Mind. Sense raises Emotion. Vitality raises Energy.</desc>
            <defs><marker id="ability-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" /></marker></defs>
            <g className="diagram-arrows" markerEnd="url(#ability-arrow)">
                <path d="M150 40 C190 40 190 51 228 51" /><path d="M150 40 C187 40 190 99 228 99" />
                <path d="M150 80 C190 80 190 51 228 51" /><path d="M150 80 H228" />
                <path d="M150 120 C300 120 335 147 460 147" />
                <path d="M150 160 C300 160 335 195 460 195" />
                <path d="M150 200 C190 200 190 99 228 99" />
            </g>
            <g className="diagram-nodes">
                <DiagramNode x={25} y={16} width={125} title="Strength" />
                <DiagramNode x={25} y={56} width={125} title="Agility" />
                <DiagramNode x={25} y={96} width={125} title="Sense" />
                <DiagramNode x={25} y={136} width={125} title="Vitality" />
                <DiagramNode x={25} y={176} width={125} title="Intelligence" />
                <DiagramNode x={228} y={27} width={146} title="Body ceiling" />
                <DiagramNode x={228} y={75} width={146} title="Mind ceiling" />
                <DiagramNode x={460} y={123} width={146} title="Emotion ceiling" />
                <DiagramNode x={460} y={171} width={146} title="Energy ceiling" />
            </g>
        </svg>
    )
}
