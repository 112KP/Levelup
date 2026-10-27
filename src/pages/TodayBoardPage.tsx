import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { completeQuest, failQuest, fetchTodayQuestLogs, generateDailyQuestLogs } from '../lib/quests'
import type { QuestBoardEntry } from '../lib/quests'
import { getEasternDateKey } from '../lib/dateTime'

function formatOutcomeLabel(status: string, data: { questName?: string; xp?: number; gold?: number; hp?: number; mp?: number; careerAbility?: number; penaltyHp?: number; penaltyGold?: number; fatigueRestore?: number }) {
    if (status === 'complete') {
        const otherRewards = [data.hp ? `+${data.hp} HP` : '', data.mp ? `+${data.mp} MP` : '', data.careerAbility ? `+${data.careerAbility} Career Ability` : '', data.fatigueRestore ? `−${data.fatigueRestore} Fatigue` : ''].filter(Boolean)
        const rewards = [`${data.xp ?? 0} XP`, `${data.gold ?? 0} gold`, ...otherRewards].join(', ')
        return `Completed ${data.questName ?? 'quest'} for ${rewards}.`
    }
    return `Failed ${data.questName ?? 'quest'} for ${data.penaltyHp ?? 0} HP and ${data.penaltyGold ?? 0} gold.`
}

export function TodayBoardPage() {
    const { session } = useAuth()
    const userId = session?.user.id ?? ''
    const [entries, setEntries] = useState<QuestBoardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState<string | null>(null)
    const [toast, setToast] = useState('')

    const [today, setToday] = useState(getEasternDateKey)

    useEffect(() => {
        const timer = window.setInterval(() => {
            const currentDay = getEasternDateKey()
            if (today !== currentDay) setToday(currentDay)
        }, 60_000)
        return () => window.clearInterval(timer)
    }, [today])

    const loadTodayBoard = useCallback(async () => {
        if (!userId) return
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
    }, [today, userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadTodayBoard()
    }, [loadTodayBoard])

    useEffect(() => {
        if (!toast) return
        const timer = window.setTimeout(() => setToast(''), 2600)
        return () => window.clearTimeout(timer)
    }, [toast])

    async function handleQuest(action: 'complete' | 'fail', logId: string, questName: string, xpReward: number, goldReward: number, hpReward: number, mpReward: number, careerAbilityReward: number, penaltyHp: number, penaltyGold: number, fatigueRestore: number) {
        setBusyId(logId)
        setError('')

        const result = action === 'complete' ? await completeQuest(logId) : await failQuest(logId)
        if (result.error) {
            setError(result.error.message || `The quest could not be marked as ${action}.`)
            setBusyId(null)
            return
        }

        setToast(formatOutcomeLabel(action === 'complete' ? 'complete' : 'fail', {
            questName,
            xp: xpReward,
            gold: goldReward,
            hp: hpReward,
            mp: mpReward,
            careerAbility: careerAbilityReward,
            penaltyHp,
            penaltyGold,
            fatigueRestore,
        }))
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
                                            {quest.description && <p>{quest.description}</p>}
                                            <div className="meta-row">
                                                <span>{quest.xp_reward} XP</span>
                                                <span>{quest.gold_reward} gold</span>
                                                {quest.hp_reward > 0 && <span>+{quest.hp_reward} HP</span>}
                                                {quest.mp_reward > 0 && <span>+{quest.mp_reward} MP</span>}
                                                {quest.career_ability_reward > 0 && <span>+{quest.career_ability_reward} Career</span>}
                                                {quest.fatigue_restore > 0 && <span>−{quest.fatigue_restore} Fatigue</span>}
                                                <span>{quest.target_value} {quest.unit || 'goal'}</span>
                                            </div>
                                        </div>
                                        <div className="action-row compact">
                                            <button type="button" className="primary-button" disabled={busyId === entry.id} onClick={() => void handleQuest('complete', entry.id, quest.name, quest.xp_reward, quest.gold_reward, quest.hp_reward, quest.mp_reward, quest.career_ability_reward, quest.penalty_hp, quest.penalty_gold, quest.fatigue_restore)}>
                                                {busyId === entry.id ? 'Working...' : 'Complete'}
                                            </button>
                                            <button type="button" className="secondary-button" disabled={busyId === entry.id} onClick={() => void handleQuest('fail', entry.id, quest.name, quest.xp_reward, quest.gold_reward, quest.hp_reward, quest.mp_reward, quest.career_ability_reward, quest.penalty_hp, quest.penalty_gold, quest.fatigue_restore)}>
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
