import { useEffect, useRef, useState } from 'react'
import {
    BrainCircuit,
    Dumbbell,
    Eye,
    HeartPulse,
    LogOut,
    Sparkles,
    Wind,
    X,
} from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../lib/supabaseClient'
import type { Profile, StatName } from '../../types/database'
import { RankBadge } from './RankBadge'
import { CornerFrame } from './CornerFrame'
import { StatCard } from './StatCard'
import { VitalsBar } from './VitalsBar'
import { XPBar } from './XPBar'
import './status-window.css'

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

export function StatusWindow() {
    const { session, logout } = useAuth()
    const userId = session?.user.id
    const [profile, setProfile] = useState<Profile | null>(null)
    const profileRef = useRef<Profile | null>(null)
    const questDialogRef = useRef<HTMLDialogElement | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [retryCount, setRetryCount] = useState(0)
    const [allocating, setAllocating] = useState(false)
    const [allocationMessage, setAllocationMessage] = useState('')
    const [levelUp, setLevelUp] = useState(false)

    useEffect(() => {
        if (!userId) return

        let active = true
        let levelUpTimer: number | undefined

        function commitProfile(nextProfile: Profile | null) {
            if (!active) return
            if (nextProfile && profileRef.current && nextProfile.level > profileRef.current.level) {
                setLevelUp(true)
                window.clearTimeout(levelUpTimer)
                levelUpTimer = window.setTimeout(() => setLevelUp(false), 3200)
            }
            profileRef.current = nextProfile
            setProfile(nextProfile)
        }

        const channel = supabase
            .channel(`profile-status-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        commitProfile(null)
                        setError('Your status record is no longer available.')
                        return
                    }
                    commitProfile(payload.new as Profile)
                    setError('')
                },
            )
            .subscribe()

        async function loadProfile() {
            const { data, error: queryError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
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
            commitProfile(data as unknown as Profile)
            setError('')
        }

        void loadProfile()

        return () => {
            active = false
            window.clearTimeout(levelUpTimer)
            void supabase.removeChannel(channel)
        }
    }, [retryCount, userId])

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
            stat_name: stat,
            points: 1,
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
            .select('*')
            .eq('id', previousProfile.id)
            .maybeSingle()

        if (data && !refreshError) {
            profileRef.current = data as unknown as Profile
            setProfile(data as unknown as Profile)
        }
        setAllocationMessage(`${statDetails.find((item) => item.name === stat)?.label} increased.`)
        setAllocating(false)
    }

    async function handleLogout() {
        try {
            await logout()
        } catch {
            setError('Unable to sign out. Please try again.')
        }
    }

    if (loading) {
        return (
            <main className="status-page min-h-screen w-full">
                <CornerFrame className="status-frame status-skeleton" aria-label="Loading player status">
                    <div className="skeleton-line skeleton-title" />
                    <div className="skeleton-line skeleton-short" />
                    <div className="skeleton-line" />
                    <div className="skeleton-stats">
                        {statDetails.map((stat) => <span key={stat.name} />)}
                    </div>
                </CornerFrame>
            </main>
        )
    }

    return (
        <main className="status-page min-h-screen w-full">
            <header className="status-topbar">
                <a className="system-mark" href="#status-overview" aria-label="Levelup status overview">
                    <Sparkles size={17} aria-hidden="true" />
                    <span>LEVELUP <i>/</i> SYSTEM</span>
                </a>
                <button type="button" className="logout-button" onClick={handleLogout}>
                    <LogOut size={16} aria-hidden="true" />
                    <span>Sign out</span>
                </button>
            </header>

            <CornerFrame className="status-frame" id="status-overview" aria-labelledby="status-title">
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
                                {profile.active_title && (
                                    <span className="active-title">
                                        <Sparkles size={14} aria-hidden="true" />
                                        {profile.active_title}
                                    </span>
                                )}
                            </div>
                            <RankBadge rank={profile.rank} />
                        </div>

                        <div className="status-rule"><span>VITALS</span></div>
                        <section className="vitals-grid" aria-label="Player vitals">
                            <VitalsBar label="HP" current={profile.hp} max={profile.max_hp} kind="hp" />
                            <VitalsBar label="MP" current={profile.mp} max={profile.max_mp} kind="mp" />
                            <VitalsBar label="FATIGUE" current={profile.fatigue} max={100} kind="fatigue" />
                        </section>

                        <XPBar
                            level={profile.level}
                            xp={profile.xp}
                            xpToNext={profile.xp_to_next}
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
                        <section className="stats-grid" aria-label="Player attributes">
                            {statDetails.map((stat) => (
                                <StatCard
                                    key={stat.name}
                                    name={stat.name}
                                    label={stat.label}
                                    value={profile[stat.name]}
                                    icon={stat.icon}
                                    canAllocate={profile.available_points > 0}
                                    allocating={allocating}
                                    onAllocate={allocatePoint}
                                />
                            ))}
                        </section>
                        <p className="allocation-message" aria-live="polite">{allocationMessage}</p>

                        <footer className="status-footer">
                            <div className="gold-total">
                                <span className="gold-dot" aria-hidden="true" />
                                <strong key={profile.gold}>{profile.gold.toLocaleString()}</strong>
                            </div>
                            <button
                                type="button"
                                className="quest-button"
                                onClick={() => questDialogRef.current?.showModal()}
                            >
                                Quest Log
                            </button>
                        </footer>
                    </>
                ) : null}
            </CornerFrame>
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
                <p>Quest records will appear here when your first quest is logged.</p>
            </dialog>
        </main>
    )
}