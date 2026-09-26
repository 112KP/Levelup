const rankColors: Record<string, string> = {
    E: 'rank-e',
    D: 'rank-d',
    C: 'rank-c',
    B: 'rank-b',
    A: 'rank-a',
    S: 'rank-s',
}

export function RankBadge({ rank }: { rank: string | null }) {
    const normalizedRank = rank?.toUpperCase() ?? 'E'

    return (
        <span
            className={`rank-badge ${rankColors[normalizedRank] ?? 'rank-e'}`}
            aria-label={`Rank ${normalizedRank}`}
            title={`Rank ${normalizedRank}`}
        >
            {normalizedRank}
        </span>
    )
}