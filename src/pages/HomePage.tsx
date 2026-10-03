import { useCallback, useEffect, useState } from 'react'
import { Check, SkipForward } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchDungeons, getDaysRemaining } from '../lib/dungeons'
import {
    completeQuest,
    failQuest,
    fetchQuestStatRewards,
    fetchTodayQuestLogs,
    generateDailyQuestLogs,
} from '../lib/quests'
import type { QuestBoardEntry } from '../lib/quests'
import type { DungeonRow, QuestLogStatus, QuestStatRewardRow } from '../types/database'
import { RankBadge } from '../components/status/RankBadge'

const tabs: Array<{ status: QuestLogStatus; label: string }> = [
    { status: 'pending', label: 'To-Do' },
    { status: 'completed', label: 'Done' },
    { status: 'failed', label: 'Skipped' },
]

function todayKey() {
    const today = new Date()
    const offset = today.getTimezoneOffset() * 60_000
    return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

function recurrenceLabel(recurrence: string) {
    if (recurrence === 'one_time') return 'One-time'
    return recurrence.charAt(0).toUpperCase() + recurrence.slice(1)
}

type HomePageProps = {
    onRefreshReady: (refresh: (() => Promise<void>) | null) => void
}

export function HomePage({ onRefreshReady }: HomePageProps) {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [entries, setEntries] = useState<QuestBoardEntry[]>([])
    const [dungeons, setDungeons] = useState<DungeonRow[]>([])
    const [statRewardsByQuestId, setStatRewardsByQuestId] = useState<Record<string, QuestStatRewardRow[]>>({})
    const [activeTab, setActiveTab] = useState<QuestLogStatus>('pending')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState<string | null>(null)
    const [toast, setToast] = useState('')
    const today = todayKey()
    const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date())

    const loadHome = useCallback(async () => {
        if (!userId) return
        setLoading(true)
        setError('')
        const { error: generationError } = await generateDailyQuestLogs()
        const [logsResult, dungeonsResult, rewardsResult] = await Promise.all([
            fetchTodayQuestLogs(userId, today),
            fetchDungeons(userId),
            fetchQuestStatRewards(userId),
        ])

        if (logsResult.error || dungeonsResult.error || rewardsResult.error) {
            setError(logsResult.error?.message || dungeonsResult.error?.message || rewardsResult.error?.message || 'Unable to load your board.')
            setLoading(false)
            return
        }

        setEntries((logsResult.data ?? []) as QuestBoardEntry[])
        setDungeons(dungeonsResult.data ?? [])
        const rewardsByQuestId: Record<string, QuestStatRewardRow[]> = {}
        for (const reward of rewardsResult.data ?? []) {
            rewardsByQuestId[reward.quest_id] ??= []
            rewardsByQuestId[reward.quest_id].push(reward)
        }
        setStatRewardsByQuestId(rewardsByQuestId)
        setError(generationError?.message ? `Daily quests could not be generated: ${generationError.message}` : '')
        setLoading(false)
    }, [today, userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadHome()
    }, [loadHome])

    useEffect(() => {
        onRefreshReady(loadHome)
        return () => onRefreshReady(null)
    }, [loadHome, onRefreshReady])

    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(''), 3000)
        return () => window.clearTimeout(timer)
    }, [toast])

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
            const savedRewards = statRewardsByQuestId[quest.id]
            const rewards = savedRewards?.length
                ? savedRewards
                : quest.stat_reward
                    ? [{ stat_name: quest.stat_reward, amount: quest.stat_reward_amount }]
                    : []
            const stat = rewards.length
                ? `, ${rewards.map((reward) => `+${reward.amount} ${reward.stat_name}`).join(', ')}`
                : ''
            setToast(`${quest.name}: +${quest.xp_reward} XP, +${quest.gold_reward} gold${stat}.`)
        } else if (quest) {
            const penalties = [
                quest.penalty_hp ? `-${quest.penalty_hp} HP` : '',
                quest.penalty_gold ? `-${quest.penalty_gold} gold` : '',
            ].filter(Boolean)
            setToast(`${quest.name} skipped${penalties.length ? `: ${penalties.join(', ')}` : ' with no penalty'}.`)
        }
        setBusyId(null)
    }

    const visibleEntries = entries.filter((entry) => entry.status === activeTab)
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
                </div>
            </div>

            {toast && <div className="toast-banner" role="status">{toast}</div>}
            {error && <p className="status-error" role="alert">{error}</p>}

            {activeDungeons.length > 0 && (
                <section className="active-dungeon-strip" aria-label="Active dungeons">
                    {activeDungeons.map((dungeon) => {
                        const remaining = getDaysRemaining(dungeon.deadline)
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
                            onClick={() => setActiveTab(status)}
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
                    {activeTab === 'pending' ? 'No quests to do today.' : activeTab === 'completed' ? 'No quests completed yet today.' : 'No quests skipped today — nice.'}
                </p>
            ) : (
                <div className="quest-board-list" role="tabpanel">
                    {visibleEntries.map((entry) => {
                        const quest = entry.quests
                        if (!quest) return null
                        const pending = entry.status === 'pending'
                        const savedRewards = statRewardsByQuestId[quest.id]
                        const rewards = savedRewards?.length
                            ? savedRewards
                            : quest.stat_reward
                                ? [{ stat_name: quest.stat_reward, amount: quest.stat_reward_amount }]
                                : []
                        return (
                            <article className={`home-quest-card${pending ? '' : ' is-settled'}`} key={entry.id}>
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
                                    <p className="home-quest-recurrence">{recurrenceLabel(quest.recurrence)}</p>
                                    {quest.description && <p className="home-quest-description">{quest.description}</p>}
                                    {quest.unit && <p className="home-quest-progress">0 / {quest.target_value} {quest.unit}</p>}
                                    <div className="home-quest-rewards">
                                        <span>+{quest.xp_reward} XP</span>
                                        <span>+{quest.gold_reward} gold</span>
                                        {rewards.map((reward) => <span key={reward.stat_name}>+{reward.amount} {reward.stat_name}</span>)}
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
