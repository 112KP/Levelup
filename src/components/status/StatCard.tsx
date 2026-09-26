import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import type { StatName } from '../../types/database'

type StatCardProps = {
    name: StatName
    label: string
    value: number
    icon: LucideIcon
    canAllocate: boolean
    allocating: boolean
    onAllocate: (stat: StatName) => void
}

export function StatCard({
    name,
    label,
    value,
    icon: Icon,
    canAllocate,
    allocating,
    onAllocate,
}: StatCardProps) {
    return (
        <article className="stat-card">
            <div className="stat-card-top">
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <span className="system-label">{label}</span>
            <div className="stat-value-row">
                <strong className="stat-number" key={value}>{value}</strong>
                {canAllocate && (
                    <button
                        className="stat-add"
                        type="button"
                        aria-label={`Allocate one point to ${label}`}
                        title={`Add 1 ${label} point`}
                        disabled={allocating}
                        onClick={() => onAllocate(name)}
                    >
                        <Plus size={17} aria-hidden="true" />
                    </button>
                )}
            </div>
        </article>
    )
}