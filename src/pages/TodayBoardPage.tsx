import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useAbilityStreaks } from '../auth/useAbilityStreaks'
import {
    completeQuest,
    failQuest,
    fetchTodayQuestLogs,
    generateDailyQuestLogs,
    getQuestVitalPenalties,
    getQuestVitalRewards,
} from '../lib/quests'
import { fetchStreakMilestones, getStreakMilestoneMessages } from '../lib/streaks'
import type { QuestBoardEntry } from '../lib/quests'
import { getDateKey } from '../lib/dateTime'
import { useTimezone } from '../auth/useTimezone'

function formatOutcomeLabel(status: string, data: {
    questName?: string
    xp?: number
    gold?: number
    vitalRewards?: string[]
    vitalPenalties?: string[]
    penaltyGold?: number
}) {
    if (status === 'complete') {
        const rewards = [`${data.xp ?? 0} XP`, `${data.gold ?? 0} gold`, ...(data.vitalRewards ?? [])].join(', ')
        return `Completed ${data.questName ?? 'quest'} for ${rewards}.`
    }
    const penalties = [...(data.vitalPenalties ?? []), data.penaltyGold ? `−${data.penaltyGold} gold` : ''].filter(Boolean)
    return `Failed ${data.questName ?? 'quest'}${penalties.length ? `: ${penalties.join(', ')}` : ' with no penalty'}.`
}

export function TodayBoardPage() {
    const { session } = useAuth()
    const { streaks, refresh: refreshStreaks } = useAbilityStreaks()
    const { timeZone, loading: timezoneLoading } = useTimezone()
    const userId = session?.user.id ?? ''
    const [entries, setEntries] = useState<QuestBoardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState<string | null>(null)
    const [toast, setToast] = useState('')

    const [clock, setClock] = useState(() => Date.now())
    const today = getDateKey(new Date(clock), timeZone)

    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 60_000)
        return () => window.clearInterval(timer)
    }, [])

    const loadTodayBoard = useCallback(async () => {
        if (!userId || timezoneLoading) return
        setLoading(true)
        const { error: generateError } = await generateDailyQuestLogs()
        if (generateError) {
            setError(generateError.message || 'Unable to generate today\'s quest board.')
            setLoading(false)
            return
        }

        const { data, error: logError } = await fetchTodayQuestLogs(userId, today)
        if (logError) {
            setError(logError.message || 'Unable to fetch today\'s quest logs.')
            setLoading(false)
            return
        }

        setEntries((data ?? []) as QuestBoardEntry[])
        setError('')
        setLoading(false)
    }, [today, timezoneLoading, userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadTodayBoard()
    }, [loadTodayBoard])

    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(''), 2600)
        return () => window.clearTimeout(timer)
    }, [toast])

    async function handleQuest(action: 'complete' | 'fail', entry: QuestBoardEntry) {
        const quest = entry.quests
        if (!quest) return
        setBusyId(entry.id)
        setError('')

        let previousStreaks = streaks
        if (action === 'complete' && previousStreaks.length === 0) {
            const previousResult = await refreshStreaks()
            if (previousResult.error) {
                setError(`Quest completion may succeed, but streak history could not be loaded: ${previousResult.error.message}`)
            } else {
                previousStreaks = previousResult.data ?? []
            }
        }

        const result = action === 'complete' ? await completeQuest(entry.id) : await failQuest(entry.id)
        if (result.error) {
            setError(result.error.message || `The quest could not be marked as ${action}.`)
            setBusyId(null)
            return
        }

        let milestoneMessages: string[] = []
        if (action === 'complete') {
            const streaksResult = await refreshStreaks()
            if (streaksResult.error) {
                setError(`Quest completed, but streaks could not be refreshed: ${streaksResult.error.message}`)
            } else {
                const updatedStreaks = streaksResult.data ?? []
                const newlyPaid = updatedStreaks.some((streak) =>
                    streak.highest_milestone_paid
                    > (previousStreaks.find((previous) => previous.ability === streak.ability)?.highest_milestone_paid ?? 0),
                )
                if (newlyPaid && previousStreaks.length > 0) {
                    const milestonesResult = await fetchStreakMilestones()
                    if (milestonesResult.error) {
                        setError(`Quest completed, but milestone details could not be loaded: ${milestonesResult.error.message}`)
                    } else {
                        milestoneMessages = getStreakMilestoneMessages(
                            previousStreaks,
                            updatedStreaks,
                            milestonesResult.data ?? [],
                        )
                    }
                }
            }
        }

        setToast(formatOutcomeLabel(action === 'complete' ? 'complete' : 'fail', {
            questName: quest.name,
            xp: quest.xp_reward,
            gold: quest.gold_reward,
            vitalRewards: getQuestVitalRewards(quest),
            vitalPenalties: getQuestVitalPenalties(quest),
            penaltyGold: quest.penalty_gold,
        }) + (milestoneMessages.length ? ` ${milestoneMessages.join('. ')}.` : ''))
        setBusyId(null)
        await loadTodayBoard()
    }

    const pendingEntries = entries.filter((entry) => entry.status === 'pending')
    const doneEntries = entries.filter((entry) => entry.status !== 'pending')

    return (
        <section className="screen-page">
            <div className="screen-header">
                <div>
                    <p className="eyebrow">TODAY</p>
                    <h2>Quest board</h2>
                </div>
            </div>

            {toast && <div className="toast-banner">{toast}</div>}
            {error && <p className="status-error">{error}</p>}

            {loading ? (
                <p className="status-empty">Generating today&apos;s board...</p>
            ) : pendingEntries.length === 0 && doneEntries.length === 0 ? (
                <p className="status-empty">No quest logs are available for today yet.</p>
            ) : (
                <>
                    <div className="quest-board-list">
                        {pendingEntries.length > 0 ? (
                            pendingEntries.map((entry) => {
                                const quest = entry.quests
                                if (!quest) return null
                                return (
                                    <div key={entry.id} className={`quest-card pending prahar-${quest.prahar.toLowerCase()}`}>
                                        <div>
                                            <h3>{quest.name}</h3>
                                            <div className="meta-row">
                                                <span>{quest.xp_reward} XP</span>
                                                <span>{quest.gold_reward} gold</span>
                                                {getQuestVitalRewards(quest).map((reward) => <span key={reward}>{reward}</span>)}
                                                {getQuestVitalPenalties(quest).map((penalty) => <span key={`penalty-${penalty}`}>On skip: {penalty}</span>)}
                                                <span>{quest.target_value} {quest.unit || 'goal'}</span>
                                            </div>
                                        </div>
                                        <div className="action-row compact">
                                            <button type="button" className="primary-button" disabled={busyId === entry.id} onClick={() => void handleQuest('complete', entry)}>
                                                {busyId === entry.id ? 'Working...' : 'Complete'}
                                            </button>
                                            <button type="button" className="secondary-button" disabled={busyId === entry.id} onClick={() => void handleQuest('fail', entry)}>
                                                Fail
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="status-empty">No pending quest logs left for today.</p>
                        )}
                    </div>

                    {doneEntries.length > 0 && (
                        <div className="done-section">
                            <h3>Done today</h3>
                            <div className="quest-board-list collapsed">
                                {doneEntries.map((entry) => {
                                    const quest = entry.quests
                                    if (!quest) return null
                                    return (
                                        <div key={entry.id} className={`quest-card done prahar-${quest.prahar.toLowerCase()}`}>
                                            <div>
                                                <h4>{quest.name}</h4>
                                                <p>{entry.status === 'completed' ? 'Completed' : 'Failed'}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
