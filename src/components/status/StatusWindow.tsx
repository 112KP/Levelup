import { useEffect, useRef, useState } from 'react'
import {
    BrainCircuit,
    Dumbbell,
    Eye,
    HeartPulse,
    Share2,
    Sparkles,
    Wind,
    X,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { useAuth } from '../../auth/useAuth'
import { useAbilityStreaks } from '../../auth/useAbilityStreaks'
import { supabase } from '../../lib/supabaseClient'
import type { Profile, StatName } from '../../types/database.types'
import { CornerFrame } from './CornerFrame'
import { RankBadge } from './RankBadge'
import { StatCard } from './StatCard'
import { VitalsBar } from './VitalsBar'
import { XPBar } from './XPBar'
import './status-window.css'
import { VITAL_LABELS } from '../../lib/vitals'
import { GAME_RULES } from '../../lib/gameRules'
import { fetchQuestHistory, getQuestVitalPenalties, getQuestVitalRewards } from '../../lib/quests'
import type { QuestHistoryEntry } from '../../lib/quests'
import { getAbilityLabel } from '../../lib/abilities'
import { formatDateInTimeZone } from '../../lib/dateTime'
import { useTimezone } from '../../auth/useTimezone'
import type { QuestLogStatus, QuestRow } from '../../types/database.types'

const statDetails: {
    name: StatName
    label: string
    icon: typeof Dumbbell
}[] = [
        { name: 'strength', label: 'Strength', icon: Dumbbell },
        { name: 'agility', label: 'Agility', icon: Wind },
        { name: 'sense', label: 'Sense', icon: Eye },
        { name: 'vitality', label: 'Vitality', icon: HeartPulse },
        { name: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
    ]

const profileColumns = 'id,user_id,display_name,timezone,job,rank,active_title_id,level,hp_current,hp_max,mp_current,mp_max,emotion_current,emotion_max,energy_current,energy_max,fatigue,xp,xp_to_next,career_xp,xp_career_linked,strength,agility,sense,vitality,intelligence,career,career_ability,available_points,gold,created_at,updated_at' as const

async function imageToBase64(image: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error ?? new Error('Profile image could not be prepared for sharing.'))
        reader.onload = () => {
            if (typeof reader.result !== 'string') {
                reject(new Error('Profile image could not be prepared for sharing.'))
                return
            }
            resolve(reader.result.slice(reader.result.indexOf(',') + 1))
        }
        reader.readAsDataURL(image)
    })
}

export function StatusWindow() {
    const { session } = useAuth()
    const { timeZone } = useTimezone()
    const { streaks, error: streakError, refresh: refreshStreaks } = useAbilityStreaks()
    const userId = session?.user.id
    const profileImageRef = useRef<HTMLElement | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const profileRef = useRef<Profile | null>(null)
    const [activeTitle, setActiveTitle] = useState<string | null>(null)
    const questDialogRef = useRef<HTMLDialogElement | null>(null)
    const [questHistory, setQuestHistory] = useState<QuestHistoryEntry[]>([])
    const [questHistoryLoading, setQuestHistoryLoading] = useState(false)
    const [questHistoryError, setQuestHistoryError] = useState('')
    const [questHistoryPage, setQuestHistoryPage] = useState(1)
    const [questHistoryCount, setQuestHistoryCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [retryCount, setRetryCount] = useState(0)
    const [allocating, setAllocating] = useState(false)
    const [allocationMessage, setAllocationMessage] = useState('')
    const [levelUp, setLevelUp] = useState(false)
    const [sharingProfile, setSharingProfile] = useState(false)
    const [profileShareFeedback, setProfileShareFeedback] = useState<{ message: string; isError: boolean } | null>(null)
    const [linkingProgress, setLinkingProgress] = useState(false)

    useEffect(() => {
        const profileUserId = userId ?? ''
        if (!profileUserId) return

        let active = true
        let levelUpTimer: number | undefined
        void refreshStreaks()

        function commitProfile(nextProfile: Profile | null) {
            if (!active) return
            if (nextProfile && profileRef.current && nextProfile.level > profileRef.current.level) {
                setLevelUp(true)
                window.clearTimeout(levelUpTimer)
                levelUpTimer = window.setTimeout(() => setLevelUp(false), 3200)
            }
            profileRef.current = nextProfile
            setProfile(nextProfile)
            if (!nextProfile) setActiveTitle(null)
        }

        async function syncActiveTitle(titleId: string | null) {
            if (!titleId) {
                setActiveTitle(null)
                return
            }

            const { data } = await supabase
                .from('titles')
                .select('name')
                .eq('id', titleId)
                .maybeSingle()

            if (active && profileRef.current?.active_title_id === titleId) {
                setActiveTitle(data?.name ?? null)
            }
        }

        const channel = supabase
            .channel(`profile-status-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `user_id=eq.${profileUserId}`,
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        commitProfile(null)
                        setError('Your status record is no longer available.')
                        return
                    }
                    const nextProfile = payload.new as Profile
                    commitProfile(nextProfile)
                    void syncActiveTitle(nextProfile.active_title_id)
                    setError('')
                },
            )
            .subscribe()

        async function loadProfile() {
            const { data, error: queryError } = await supabase
                .from('profiles')
                .select(profileColumns)
                .eq('user_id', profileUserId)
                .maybeSingle()

            if (!active) return
            setLoading(false)
            if (queryError) {
                setError('We could not load your status right now. Please try again.')
                return
            }
            if (!data) {
                commitProfile(null)
                setError('Your status record has not been created yet.')
                return
            }
            commitProfile(data)
            void syncActiveTitle(data.active_title_id)
            setError('')
        }

        void loadProfile()

        return () => {
            active = false
            window.clearTimeout(levelUpTimer)
            void supabase.removeChannel(channel)
        }
    }, [refreshStreaks, retryCount, userId])

    const streaksByAbility = new Map(streaks.map((streak) => [streak.ability, streak]))

    async function loadQuestHistory(page: number) {
        if (!userId) {
            setQuestHistoryError('Your account could not be identified. Please sign in again.')
            return
        }
        setQuestHistoryLoading(true)
        setQuestHistoryError('')
        const result = await fetchQuestHistory(userId, page)
        if (result.error) {
            setQuestHistoryError('Quest records could not be loaded. Please try again.')
            setQuestHistoryLoading(false)
            return
        }
        setQuestHistory(result.data ?? [])
        setQuestHistoryCount(result.count ?? result.data?.length ?? 0)
        setQuestHistoryPage(page)
        setQuestHistoryLoading(false)
    }

    function openQuestLog() {
        setQuestHistoryPage(1)
        questDialogRef.current?.showModal()
        void loadQuestHistory(1)
    }

    async function allocatePoint(stat: StatName) {
        if (!profile || allocating || profile.available_points < 1) return

        const previousProfile = profile
        const optimisticProfile = {
            ...profile,
            [stat]: profile[stat] + 1,
            available_points: profile.available_points - 1,
        }
        profileRef.current = optimisticProfile
        setProfile(optimisticProfile)
        setAllocating(true)
        setAllocationMessage('')

        const { error: rpcError } = await supabase.rpc('allocate_points', {
            p_stat: stat,
            p_points: 1,
        })

        if (rpcError) {
            profileRef.current = previousProfile
            setProfile(previousProfile)
            setAllocationMessage('Point allocation failed. Your status was restored.')
            setAllocating(false)
            return
        }

        const { data, error: refreshError } = await supabase
            .from('profiles')
            .select(profileColumns)
            .eq('user_id', previousProfile.user_id)
            .maybeSingle()

        if (data && !refreshError) {
            profileRef.current = data
            setProfile(data)
        }
        setAllocationMessage(`${statDetails.find((item) => item.name === stat)?.label} increased.`)
        setAllocating(false)
    }

    async function setProgressLinked(linked: boolean) {
        if (!profile || linkingProgress) return
        setLinkingProgress(true)
        setAllocationMessage('')

        const { error: linkError } = await supabase.rpc('set_xp_career_linked', { p_linked: linked })
        if (linkError) {
            setAllocationMessage(`Progress linking could not be updated: ${linkError.message}`)
            setLinkingProgress(false)
            return
        }

        const { data, error: refreshError } = await supabase
            .from('profiles')
            .select(profileColumns)
            .eq('user_id', profile.user_id)
            .maybeSingle()

        if (refreshError || !data) {
            setAllocationMessage(`Progress linking was updated, but profile status could not be refreshed${refreshError ? `: ${refreshError.message}` : '.'}`)
            setLinkingProgress(false)
            return
        }

        profileRef.current = data
        setProfile(data)
        setAllocationMessage(linked
            ? 'XP and Career are linked. Level-ups wait for both bars to reach the target.'
            : 'XP and Career are unlinked. XP controls level-ups.')
        setLinkingProgress(false)
    }

    async function shareProfileImage() {
        const profileFrame = profileImageRef.current
        if (!profileFrame || sharingProfile) return

        setSharingProfile(true)
        setProfileShareFeedback(null)
        try {
            await document.fonts.ready
            const { toBlob } = await import('html-to-image')
            const image = await toBlob(profileFrame, {
                pixelRatio: 2,
                backgroundColor: '#0a1224',
                filter: (node) => !(node instanceof Element && node.hasAttribute('data-profile-share-exclude')),
            })
            if (!image) throw new Error('Profile image could not be rendered.')

            const fileName = `levelup-profile-${Date.now()}.png`
            if (Capacitor.isNativePlatform()) {
                const { Directory, Filesystem } = await import('@capacitor/filesystem')
                const { uri } = await Filesystem.writeFile({
                    path: fileName,
                    data: await imageToBase64(image),
                    directory: Directory.Cache,
                })
                await Share.share({
                    title: 'My Levelup profile',
                    text: 'Check out my Levelup achievements!',
                    files: [uri],
                    dialogTitle: 'Share profile image',
                })
                setProfileShareFeedback({ message: 'Profile image shared.', isError: false })
                return
            }

            const imageFile = new File([image], fileName, { type: 'image/png' })
            if (navigator.share && navigator.canShare?.({ files: [imageFile] })) {
                await navigator.share({
                    title: 'My Levelup profile',
                    text: 'Check out my Levelup achievements!',
                    files: [imageFile],
                })
                setProfileShareFeedback({ message: 'Profile image shared.', isError: false })
                return
            }

            const imageUrl = URL.createObjectURL(image)
            const downloadLink = document.createElement('a')
            downloadLink.href = imageUrl
            downloadLink.download = fileName
            document.body.appendChild(downloadLink)
            downloadLink.click()
            downloadLink.remove()
            window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000)
            setProfileShareFeedback({
                message: 'Profile image downloaded. You can share it from your device.',
                isError: false,
            })
        } catch (shareError) {
            if (shareError instanceof Error && shareError.name === 'AbortError') return
            setProfileShareFeedback({
                message: 'Unable to create or share your profile image. Please try again.',
                isError: true,
            })
        } finally {
            setSharingProfile(false)
        }
    }

    if (loading) {
        return (
            <CornerFrame className="status-frame">
                <section className="screen-page status-page" aria-label="Loading player status">
                    <div className="status-skeleton">
                        <div className="skeleton-line skeleton-title" />
                        <div className="skeleton-line skeleton-short" />
                        <div className="skeleton-line" />
                        <div className="skeleton-stats">
                            {statDetails.map((stat) => <span key={stat.name} />)}
                        </div>
                    </div>
                </section>
            </CornerFrame>
        )
    }

    return (
        <CornerFrame className="status-frame" ref={profileImageRef}>
            <section className="screen-page status-page" id="status-overview" aria-labelledby="status-title">
                {error ? (
                    <div className="status-message" role="alert">
                        <span className="system-label">SYSTEM NOTICE</span>
                        <h1 id="status-title">Status unavailable</h1>
                        <p>{error}</p>
                        <button
                            type="button"
                            className="retry-button"
                            onClick={() => {
                                setLoading(true)
                                setRetryCount((count) => count + 1)
                            }}
                        >
                            Retry connection
                        </button>
                    </div>
                ) : profile ? (
                    <>
                    <div className="status-heading">
                        <div className="identity">
                            <h1 id="status-title">{profile.display_name || 'Unnamed Player'}</h1>
                            <p className="identity-job">{profile.job || 'Unassigned'}</p>
                            {activeTitle && (
                                <span className="active-title">
                                    <Sparkles size={14} aria-hidden="true" />
                                    {activeTitle}
                                </span>
                            )}
                        </div>
                        <RankBadge rank={profile.rank} />
                    </div>

                    <div className="status-rule"><span>VITALS</span></div>
                    <section className="vitals-grid" aria-label="Player vitals">
                        <VitalsBar label={VITAL_LABELS.body} current={profile.hp_current} max={profile.hp_max} kind="body" />
                        <VitalsBar label={VITAL_LABELS.mind} current={profile.mp_current} max={profile.mp_max} kind="mind" />
                        <VitalsBar label={VITAL_LABELS.emotion} current={profile.emotion_current} max={profile.emotion_max} kind="emotion" />
                        <VitalsBar label={VITAL_LABELS.energy} current={profile.energy_current} max={profile.energy_max} kind="energy" />
                        <VitalsBar label={VITAL_LABELS.fatigue} current={profile.fatigue} max={GAME_RULES.vitals.fatigueMaximum} kind="fatigue" />
                    </section>

                    <XPBar
                        level={profile.level}
                        xp={profile.xp}
                        xpToNext={profile.xp_to_next}
                        careerXp={profile.career_xp}
                        xpCareerLinked={profile.xp_career_linked}
                        linkingProgress={linkingProgress}
                        onSetProgressLinked={(linked) => void setProgressLinked(linked)}
                        levelUp={levelUp}
                    />

                    {profile.available_points > 0 && (
                        <div className="points-banner" role="status">
                            <Sparkles size={17} aria-hidden="true" />
                            <span>Points ready to allocate</span>
                            <strong>{profile.available_points}</strong>
                        </div>
                    )}

                    <div className="status-rule"><span>ATTRIBUTES</span></div>
                    <section
                        className={`stats-grid${Capacitor.isNativePlatform() ? ' native-profile-stats' : ''}`}
                        aria-label="Player attributes"
                    >
                        {statDetails.map((stat) => (
                            <StatCard
                                key={stat.name}
                                label={stat.label}
                                value={profile[stat.name]}
                                streak={streaksByAbility.get(stat.name)}
                                icon={stat.icon}
                                canAllocate={profile.available_points > 0}
                                allocating={allocating}
                                onAllocate={() => void allocatePoint(stat.name)}
                            />
                        ))}
                    </section>
                    {streakError && <p className="streak-error" role="alert">Streak status unavailable: {streakError}</p>}
                    <p className="allocation-message" data-profile-share-exclude aria-live="polite">{allocationMessage}</p>

                    <footer className="status-footer">
                        <div className="gold-total">
                            <span className="gold-dot" aria-hidden="true" />
                            <strong>{profile.gold.toLocaleString()}</strong>
                        </div>
                        <div className="status-footer-actions" data-profile-share-exclude>
                            <button
                                type="button"
                                className="status-share-button"
                                disabled={sharingProfile}
                                onClick={() => void shareProfileImage()}
                            >
                                <Share2 size={16} aria-hidden="true" />
                                {sharingProfile ? 'Preparing...' : 'Share image'}
                            </button>
                            <button
                                type="button"
                                className="quest-button"
                                onClick={openQuestLog}
                            >
                                Quest Log
                            </button>
                        </div>
                    </footer>
                    {profileShareFeedback && (
                        <p
                            className={`status-share-feedback${profileShareFeedback.isError ? ' is-error' : ''}`}
                            data-profile-share-exclude
                            role={profileShareFeedback.isError ? 'alert' : 'status'}
                        >
                            {profileShareFeedback.message}
                        </p>
                    )}
                    </>
                ) : null}
                <p className="status-footnote">PERSONAL RECORD <span>•</span> LIVE SYNC ENABLED</p>
                <dialog className="quest-dialog" ref={questDialogRef} aria-labelledby="quest-log-title">
                <div className="quest-dialog-heading">
                    <div>
                        <span className="system-label">JOURNAL ACCESS</span>
                        <h2 id="quest-log-title">Quest Log</h2>
                    </div>
                    <button
                        type="button"
                        className="quest-close"
                        aria-label="Close quest log"
                        onClick={() => questDialogRef.current?.close()}
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <p className="quest-history-note">
                    Quest details and effect amounts reflect the quest&apos;s current settings.
                </p>
                {questHistoryLoading ? (
                    <p role="status">Loading quest records...</p>
                ) : questHistoryError ? (
                    <div className="quest-history-message" role="alert">
                        <p>{questHistoryError}</p>
                        <button type="button" className="quest-history-page-button" onClick={() => void loadQuestHistory(questHistoryPage)}>
                            Try again
                        </button>
                    </div>
                ) : questHistory.length === 0 ? (
                    <p>No quest records yet. Your daily quests will appear here after they are logged.</p>
                ) : (
                    <>
                        <p className="quest-history-count">{questHistoryCount} quest {questHistoryCount === 1 ? 'record' : 'records'}</p>
                        <div className="quest-history-list">
                            {questHistory.map(({ log, quest }) => (
                                <article className="quest-history-entry" key={log.id}>
                                    <div className="quest-history-entry-heading">
                                        <div>
                                            <h3>{quest?.name ?? 'Quest unavailable'}</h3>
                                            <time dateTime={log.quest_date}>
                                                {formatDateInTimeZone(log.quest_date, { dateStyle: 'medium' }, undefined, timeZone)}
                                            </time>
                                        </div>
                                        <span className={`quest-history-status ${log.status}`}>
                                            {getQuestHistoryStatusLabel(log.status)}
                                        </span>
                                    </div>
                                    {quest && (
                                        <>
                                            <div className="quest-history-details">
                                                <span>{getQuestRecurrenceLabel(quest.recurrence)} · {quest.prahar}</span>
                                                <span>{capitalize(quest.difficulty)} difficulty</span>
                                                {quest.target_value > 0 && (
                                                    <span>Target: {quest.target_value}{quest.unit ? ` ${quest.unit}` : ''}</span>
                                                )}
                                                <span>
                                                    Abilities: {quest.abilities.length
                                                        ? quest.abilities.map(getAbilityLabel).join(', ')
                                                        : 'None'}
                                                </span>
                                            </div>
                                            {log.completed_at && (
                                                <p className="quest-history-completed">
                                                    Completed {formatDateInTimeZone(log.completed_at, { timeStyle: 'short' }, undefined, timeZone)}
                                                </p>
                                            )}
                                            {log.status === 'failed' && (
                                                <p className="quest-history-completed">
                                                    {log.penalty_applied ? 'Skip penalty applied' : 'No skip penalty applied'}
                                                </p>
                                            )}
                                            <QuestEffects title="Configured rewards" effects={getQuestVitalRewards(quest)} extras={[`${quest.xp_reward} XP`, `${quest.career_xp_reward} Career XP`, `${quest.gold_reward} Gold`]} />
                                            <QuestEffects
                                                title="Skip penalties"
                                                effects={getQuestVitalPenalties(quest)}
                                                extras={quest.penalty_gold > 0 ? [`${quest.penalty_gold} Gold`] : []}
                                            />
                                        </>
                                    )}
                                </article>
                            ))}
                        </div>
                        <div className="quest-history-pagination">
                            <button
                                type="button"
                                className="quest-history-page-button"
                                disabled={questHistoryLoading || questHistoryPage <= 1}
                                onClick={() => void loadQuestHistory(questHistoryPage - 1)}
                            >
                                Previous
                            </button>
                            <span>Page {questHistoryPage}</span>
                            <button
                                type="button"
                                className="quest-history-page-button"
                                disabled={questHistoryLoading || questHistoryPage * GAME_RULES.history.pageSize >= questHistoryCount}
                                onClick={() => void loadQuestHistory(questHistoryPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
                </dialog>
            </section>
        </CornerFrame>
    )
}

function getQuestHistoryStatusLabel(status: QuestLogStatus) {
    if (status === 'pending') return 'To Do'
    if (status === 'failed') return 'Skipped'
    return 'Completed'
}

function getQuestRecurrenceLabel(recurrence: QuestRow['recurrence']) {
    if (recurrence === 'one_time') return 'One-time'
    return recurrence === 'daily' ? 'Daily' : 'Weekly'
}

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function QuestEffects({ title, effects, extras }: { title: string; effects: string[]; extras: string[] }) {
    const values = [...extras, ...effects]
    if (!values.length) return null
    return (
        <p className="quest-history-effects">
            <strong>{title}:</strong> {values.join(' · ')}
        </p>
    )
}