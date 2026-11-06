import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Plus, SkipForward, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchDungeons, getDaysRemaining } from '../lib/dungeons'
import {
    addQuestToToday,
    completeQuest,
    failQuest,
    fetchQuests,
    fetchQuestBoardLogs,
    getQuestVitalPenalties,
    getQuestVitalRewards,
    generateDailyQuestLogs,
} from '../lib/quests'
import { getAbilityLabel } from '../lib/abilities'
import { fetchStreakMilestones, getStreakMilestoneMessages } from '../lib/streaks'
import { useAbilityStreaks } from '../auth/useAbilityStreaks'
import type { QuestBoardEntry } from '../lib/quests'
import type {
    DungeonRow,
    QuestLogStatus,
    QuestPrahar,
    QuestRow,
} from '../types/database.types'
import { RankBadge } from '../components/status/RankBadge'
import { formatDateInTimeZone, getDateKey, getWeekStartDateKey } from '../lib/dateTime'
import { useTimezone } from '../auth/useTimezone'

const tabs: Array<{ status: QuestLogStatus; label: string }> = [
    { status: 'pending', label: 'To-Do' },
    { status: 'completed', label: 'Done' },
    { status: 'failed', label: 'Skipped' },
]

const praharOrder: Record<QuestPrahar, number> = {
    Morning: 0,
    Afternoon: 1,
    Evening: 2,
    Night: 3,
}

function recurrenceLabel(recurrence: string) {
    if (recurrence === 'one_time') return 'One-time'
    return recurrence.charAt(0).toUpperCase() + recurrence.slice(1)
}

function getQuestGoalLabel(targetValue: number | null, unitValue: string | null) {
    const target = targetValue ?? 1
    const unit = unitValue?.trim() ?? ''
    const duplicatedNumericUnit = /^\d+(?:\.\d+)?$/.test(unit) && Number(unit) === target
    const displayUnit = duplicatedNumericUnit ? '' : unit

    if (target <= 1 && !displayUnit) return null

    const separator = /^[A-Za-z]{1,2}$/.test(displayUnit) ? '' : ' '
    return `Goal: ${target}${displayUnit ? `${separator}${displayUnit}` : ''}`
}

type HomePageProps = {
    onRefreshReady: (refresh: (() => Promise<void>) | null) => void
}

export function HomePage({ onRefreshReady }: HomePageProps) {
    const { session } = useAuth()
    const { timeZone, loading: timezoneLoading, error: timezoneError } = useTimezone()
    const { streaks, refresh: refreshStreaks } = useAbilityStreaks()
    const userId = session?.user.id ?? ''
    const [entries, setEntries] = useState<QuestBoardEntry[]>([])
    const [quests, setQuests] = useState<QuestRow[]>([])
    const [dungeons, setDungeons] = useState<DungeonRow[]>([])
    const [selectedTab, setSelectedTab] = useState<{ day: string; status: QuestLogStatus }>(() => ({
        day: getDateKey(new Date(), timeZone),
        status: 'pending',
    }))
    const [clock, setClock] = useState(() => Date.now())
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState<string | null>(null)
    const [toast, setToast] = useState('')
    const [busyAddId, setBusyAddId] = useState<string | null>(null)
    const [milestoneToasts, setMilestoneToasts] = useState<string[]>([])
    const today = getDateKey(new Date(clock), timeZone)
    const weekStart = getWeekStartDateKey(today)
    const activeTab = selectedTab.day === today ? selectedTab.status : 'pending'
    const addQuestDialogRef = useRef<HTMLDialogElement | null>(null)
    const shortDate = formatDateInTimeZone(new Date(), { day: 'numeric', month: 'short' }, 'en-GB', timeZone)

    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 60_000)
        return () => window.clearInterval(timer)
    }, [])

    const loadHome = useCallback(async () => {
        if (!userId || timezoneLoading) return
        setLoading(true)
        setError('')
        if (timezoneError) {
            setError(`Timezone is unavailable: ${timezoneError}`)
            setLoading(false)
            return
        }
        const { error: generationError } = await generateDailyQuestLogs()
        const streaksResult = await refreshStreaks()
        const [logsResult, dungeonsResult, questsResult] = await Promise.all([
            fetchQuestBoardLogs(userId, today, weekStart),
            fetchDungeons(userId),
            fetchQuests(userId),
        ])

        if (logsResult.error || dungeonsResult.error || questsResult.error || streaksResult.error) {
            setError(logsResult.error?.message || dungeonsResult.error?.message || questsResult.error?.message || streaksResult.error?.message || 'Unable to load your board.')
            setLoading(false)
            return
        }

        setEntries((logsResult.data ?? []) as QuestBoardEntry[])
        setQuests(questsResult.data ?? [])
        setDungeons(dungeonsResult.data ?? [])
        setError(generationError?.message ? `Daily quests could not be generated: ${generationError.message}` : '')
        setLoading(false)
    }, [refreshStreaks, today, weekStart, timezoneError, timezoneLoading, userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadHome()
    }, [loadHome])

    useEffect(() => {
        onRefreshReady(loadHome)
        return () => onRefreshReady(null)
    }, [loadHome, onRefreshReady])

    useEffect(() => {
        if (!toast && milestoneToasts.length === 0) return
        const timer = window.setTimeout(() => {
            setToast('')
            setMilestoneToasts([])
        }, 3000)
        return () => window.clearTimeout(timer)
    }, [milestoneToasts, toast])

    async function changeQuestStatus(entry: QuestBoardEntry, status: 'completed' | 'failed') {
        setBusyId(entry.id)
        setError('')
        const result = status === 'completed' ? await completeQuest(entry.id) : await failQuest(entry.id)
        if (result.error) {
            setError(result.error.message || 'The quest status could not be updated.')
            setBusyId(null)
            return
        }

        const quest = entry.quests
        setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status } : item))
        if (quest && status === 'completed') {
            const previousStreaks = new Map(streaks.map((streak) => [streak.ability, streak]))
            const streaksResult = await refreshStreaks()
            const milestoneMessages: string[] = []
            let streakSummary: string

            if (streaksResult.error) {
                setError(`Quest completed, but streaks could not be refreshed: ${streaksResult.error.message}`)
                streakSummary = 'Streak status unavailable'
            } else {
                const updatedStreaks = streaksResult.data ?? []
                const updatedByAbility = new Map(updatedStreaks.map((streak) => [streak.ability, streak]))
                const taggedStreaks = [...new Set(quest.abilities)]
                    .map((ability) => updatedByAbility.get(ability))
                    .filter((streak) => streak !== undefined)
                streakSummary = taggedStreaks.length
                    ? taggedStreaks
                        .map((streak) => `${getAbilityLabel(streak.ability)} ${streak.current_streak}-day streak`)
                        .join(', ')
                    : 'No ability streak credited'

                const newlyPaid = previousStreaks.size > 0
                    ? updatedStreaks.filter((streak) =>
                        streak.highest_milestone_paid
                        > (previousStreaks.get(streak.ability)?.highest_milestone_paid ?? 0),
                    )
                    : []

                if (newlyPaid.length > 0) {
                    const milestonesResult = await fetchStreakMilestones()
                    if (milestonesResult.error) {
                        setError(`Quest completed, but milestone details could not be loaded: ${milestonesResult.error.message}`)
                    } else {
                        milestoneMessages.push(...getStreakMilestoneMessages(
                            [...previousStreaks.values()],
                            updatedStreaks,
                            milestonesResult.data ?? [],
                        ))
                    }
                }
            }

            setMilestoneToasts(milestoneMessages)
            const rewards = [
                `+${quest.xp_reward} XP`,
                `+${quest.career_xp_reward} Career XP`,
                `+${quest.gold_reward} gold`,
                ...getQuestVitalRewards(quest),
            ]
            setToast(`${quest.name}: ${rewards.join(', ')}. ${streakSummary}.`)
        } else if (quest) {
            setMilestoneToasts([])
            const penalties = [
                ...getQuestVitalPenalties(quest),
                quest.penalty_gold ? `-${quest.penalty_gold} gold` : '',
            ].filter(Boolean)
            setToast(`${quest.name} skipped${penalties.length ? `: ${penalties.join(', ')}` : ' with no penalty'}.`)
        }
        setBusyId(null)
    }

    async function handleAddQuest(quest: QuestRow) {
        setBusyAddId(quest.id)
        setError('')
        const result = await addQuestToToday(quest.id)
        if (result.error) {
            addQuestDialogRef.current?.close()
            setError(result.error.message || 'The quest could not be added to today.')
            setBusyAddId(null)
            return
        }

        addQuestDialogRef.current?.close()
        setToast(`${quest.name} added to ${quest.recurrence === 'weekly' ? 'this week' : 'today'}'s To-Do list.`)
        setBusyAddId(null)
        await loadHome()
    }

    const visibleEntries = entries
        .filter((entry) => entry.status === activeTab)
        .sort((a, b) => {
            const aOrder = a.quests ? praharOrder[a.quests.prahar] : Number.MAX_SAFE_INTEGER
            const bOrder = b.quests ? praharOrder[b.quests.prahar] : Number.MAX_SAFE_INTEGER
            return aOrder - bOrder
        })
    const availableQuests = quests
        .filter((quest) =>
            quest.is_active
            && quest.recurrence !== 'daily'
            && !entries.some((entry) => entry.quest_id === quest.id),
        )
        .sort((a, b) => praharOrder[a.prahar] - praharOrder[b.prahar])
    const activeDungeons = dungeons.filter((dungeon) => dungeon.status === 'open' || dungeon.status === 'in_progress')

    return (
        <section className="screen-page home-screen" aria-labelledby="home-title">
            <header className="home-topbar">
                <p className="home-date">{shortDate}</p>
            </header>

            <div className="screen-header home-heading">
                <div>
                    <p className="eyebrow">DAILY QUEST BOARD</p>
                    <h2 id="home-title">Today&apos;s quests</h2>
                    <p className="home-quest-recurrence">Weekly quests stay here through Sunday. Unfinished quests are skipped the next time your board loads after the week ends.</p>
                </div>
                <button
                    type="button"
                    className="primary-button manage-create-button"
                    disabled={loading}
                    onClick={() => addQuestDialogRef.current?.showModal()}
                >
                    <Plus size={17} aria-hidden="true" /> Add quest
                </button>
            </div>

            <dialog className="manage-dialog" ref={addQuestDialogRef} aria-labelledby="add-today-quest-title">
                <div className="manage-form">
                    <header className="manage-dialog-header">
                        <div>
                            <p className="eyebrow">TODAY&apos;S QUESTS</p>
                            <h2 id="add-today-quest-title">Add quest to today</h2>
                        </div>
                        <button type="button" className="dialog-close-button" aria-label="Close quest list" onClick={() => addQuestDialogRef.current?.close()}>
                            <X size={19} aria-hidden="true" />
                        </button>
                    </header>
                    {availableQuests.length === 0 ? (
                        <p className="status-empty">No active weekly or one-time quests are available to add today.</p>
                    ) : (
                        <div className="today-quest-picker-list">
                            {availableQuests.map((quest) => (
                                <button
                                    className="today-quest-picker-item"
                                    key={quest.id}
                                    type="button"
                                    disabled={busyAddId !== null}
                                    onClick={() => void handleAddQuest(quest)}
                                >
                                    <span className="today-quest-picker-copy">
                                        <strong>{quest.name}</strong>
                                        <span>{recurrenceLabel(quest.recurrence)} · {quest.prahar}</span>
                                    </span>
                                    <Plus size={18} aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </dialog>

            {toast && <div className="toast-banner" role="status">{toast}</div>}
            {milestoneToasts.map((message) => (
                <div className="streak-milestone-highlight" role="status" key={message}>{message}</div>
            ))}
            {error && <p className="status-error" role="alert">{error}</p>}

            {activeDungeons.length > 0 && (
                <section className="active-dungeon-strip" aria-label="Active dungeons">
                    {activeDungeons.map((dungeon) => {
                        const remaining = getDaysRemaining(dungeon.deadline, timeZone)
                        return (
                            <Link
                                className="active-dungeon-card"
                                key={dungeon.id}
                                to={`/dungeons/manage?focus=${encodeURIComponent(dungeon.id)}`}
                            >
                                <span className="active-dungeon-rank"><RankBadge rank={dungeon.dungeon_rank} /></span>
                                <span className="active-dungeon-info">
                                    <strong>{dungeon.name}</strong>
                                    <span className={remaining !== null && remaining < 0 ? 'overdue' : ''}>
                                        {remaining === null ? 'No deadline' : remaining < 0 ? 'Overdue' : `${remaining} ${remaining === 1 ? 'day' : 'days'} left`}
                                    </span>
                                </span>
                            </Link>
                        )
                    })}
                </section>
            )}

            <div className="quest-tabs" role="tablist" aria-label="Quest status">
                {tabs.map(({ status, label }) => {
                    const count = entries.filter((entry) => entry.status === status).length
                    return (
                        <button
                            key={status}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === status}
                            className={`quest-tab${activeTab === status ? ' is-active' : ''}`}
                            onClick={() => setSelectedTab({ day: today, status })}
                        >
                            {label}<span className="quest-tab-count">{count}</span>
                        </button>
                    )
                })}
            </div>

            {loading ? (
                <div className="quest-board-list" aria-label="Loading quests" aria-busy="true">
                    {[0, 1, 2].map((item) => <div className="quest-skeleton" key={item}><span /><span /><span /></div>)}
                </div>
            ) : visibleEntries.length === 0 ? (
                <p className="home-empty-state">
                    {activeTab === 'pending' ? 'No quests to do today or this week.' : activeTab === 'completed' ? 'No quests completed today or this week.' : 'No quests skipped today or this week — nice.'}
                </p>
            ) : (
                <div className="quest-board-list" role="tabpanel">
                    {visibleEntries.map((entry) => {
                        const quest = entry.quests
                        if (!quest) return null
                        const pending = entry.status === 'pending'
                        const goalLabel = getQuestGoalLabel(quest.target_value, quest.unit)
                        return (
                            <article className={`home-quest-card prahar-${quest.prahar.toLowerCase()}${pending ? '' : ' is-settled'}`} key={entry.id}>
                                {pending && (
                                    <button
                                        className="quest-complete-button"
                                        type="button"
                                        aria-label={`Complete ${quest.name}`}
                                        disabled={busyId === entry.id}
                                        onClick={() => void changeQuestStatus(entry, 'completed')}
                                    >
                                        <Check size={19} aria-hidden="true" />
                                    </button>
                                )}
                                <div className="home-quest-copy">
                                    <div className="home-quest-heading">
                                        <h3>{quest.name}</h3>
                                        <span className={`difficulty-tag ${quest.difficulty}`}>{quest.difficulty}</span>
                                    </div>
                                    <p className="home-quest-recurrence">
                                        {recurrenceLabel(quest.recurrence)}
                                        {quest.recurrence === 'weekly' && ` · Added ${formatDateInTimeZone(entry.quest_date, { dateStyle: 'medium' }, undefined, timeZone)}`}
                                    </p>
                                    {goalLabel && <p className="home-quest-goal">{goalLabel}</p>}
                                    <div className="home-quest-abilities" aria-label="Quest abilities">
                                        {quest.abilities.length > 0
                                            ? quest.abilities.map((ability) => (
                                                <span className="ability-chip" key={ability}>{getAbilityLabel(ability)}</span>
                                            ))
                                            : <span className="ability-chip no-ability">No ability</span>}
                                    </div>
                                    <div className="home-quest-rewards">
                                        <span>+{quest.xp_reward} XP</span>
                                        <span>+{quest.career_xp_reward} Career XP</span>
                                        <span>+{quest.gold_reward} gold</span>
                                        {getQuestVitalRewards(quest).map((reward) => <span key={reward}>{reward}</span>)}
                                        {getQuestVitalPenalties(quest).map((penalty) => <span key={`penalty-${penalty}`}>On skip: {penalty}</span>)}
                                    </div>
                                </div>
                                {pending ? (
                                    <button
                                        className="quest-skip-button"
                                        type="button"
                                        disabled={busyId === entry.id}
                                        onClick={() => void changeQuestStatus(entry, 'failed')}
                                    >
                                        <SkipForward size={14} aria-hidden="true" /> Skip
                                    </button>
                                ) : (
                                    <span className="quest-result-label">{entry.status === 'completed' ? 'Done' : 'Skipped'}</span>
                                )}
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
