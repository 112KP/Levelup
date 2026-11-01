import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import type { AbilityStreakRefreshRow } from '../../types/database.types'

type StatCardProps = {
    label: string
    value: number
    icon: LucideIcon
    canAllocate: boolean
    allocating: boolean
    onAllocate?: () => void
    streak?: AbilityStreakRefreshRow
}

export function StatCard({
    label,
    value,
    icon: Icon,
    canAllocate,
    allocating,
    onAllocate,
    streak,
}: StatCardProps) {
    const progress = streak?.next_milestone
        ? Math.min(100, (streak.current_streak / streak.next_milestone) * 100)
        : streak
            ? 100
            : 0

    return (
        <article className="stat-card">
            <div className="stat-card-top">
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <span className="system-label">{label}</span>
            <div className="stat-value-row">
                <strong className="stat-number">{value}</strong>
                {canAllocate && (
                    <button
                        className="stat-add"
                        type="button"
                        aria-label={`Allocate one point to ${label}`}
                        title={`Add 1 ${label} point`}
                        disabled={allocating}
                        onClick={onAllocate}
                    >
                        <Plus size={17} aria-hidden="true" />
                    </button>
                )}
            </div>
            {streak && (
                <div className="stat-card-streak">
                    <div className="streak-summary">
                        <span>{streak.current_streak}-day streak</span>
                        <span>{streak.hit_today ? 'Hit secured' : 'Hit not secured'}</span>
                    </div>
                    <div
                        className="streak-progress"
                        role="progressbar"
                        aria-label={`${label} streak progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                    >
                        <span style={{ width: `${progress}%` }} />
                    </div>
                    <span className="streak-next">
                        {streak.next_milestone !== null
                            ? `Next: ${streak.next_milestone} days, +${streak.next_points}`
                            : 'No upcoming milestone'}
                    </span>
                </div>
            )}
        </article>
    )
}