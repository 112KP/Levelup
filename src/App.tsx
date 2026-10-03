import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CircleUserRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { CornerFrame } from './components/status/CornerFrame'
import { StatusWindow } from './components/status/StatusWindow'
import { ManageDungeonsPage } from './pages/ManageDungeonsPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { ItemsPage } from './pages/ItemsPage'
import { ManageQuestsPage } from './pages/ManageQuestsPage'
import { SkillsPage } from './pages/SkillsPage'
import { TitlesPage } from './pages/TitlesPage'
import { TodayBoardPage } from './pages/TodayBoardPage'
import {
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
} from './services/authService'
import './App.css'

const navItems = [
    { to: '/', label: 'Home' },
    { to: '/quests/manage', label: 'Manage Quests' },
    { to: '/today', label: 'Today' },
    { to: '/titles', label: 'Titles' },
    { to: '/skills', label: 'Skills' },
    { to: '/items', label: 'Items' },
    { to: '/dungeons/manage', label: 'Manage Dungeons' },
    { to: '/history', label: 'History' },
    { to: '/profile', label: 'View Profile' },
]

type ProfileNavigationMenuProps = {
    showRefresh: boolean
    refreshing: boolean
    onRefresh: () => void
}

function ProfileNavigationMenu({ showRefresh, refreshing, onRefresh }: ProfileNavigationMenuProps) {
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        function handlePointerDown(event: PointerEvent) {
            if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    return (
        <div className="workspace-header-actions">
            {showRefresh && (
                <button
                    className={`home-refresh-button${refreshing ? ' is-refreshing' : ''}`}
                    type="button"
                    aria-label="Refresh home"
                    title="Refresh home"
                    disabled={refreshing}
                    onClick={onRefresh}
                >
                    <RefreshCw size={19} aria-hidden="true" />
                </button>
            )}
            <div className="profile-menu-anchor" ref={menuRef}>
                <button
                    className="profile-button"
                    type="button"
                    aria-label="Open navigation menu"
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-controls="profile-menu"
                    onClick={() => setOpen((current) => !current)}
                >
                    <CircleUserRound size={22} aria-hidden="true" />
                </button>
            {open && (
                <>
                    <button className="profile-menu-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setOpen(false)} />
                    <nav className="profile-menu" id="profile-menu" aria-label="Main navigation">
                        {navItems.map(({ to, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/'}
                                className={({ isActive }) => isActive ? 'profile-menu-link is-active' : 'profile-menu-link'}
                                onClick={() => setOpen(false)}
                            >
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                </>
            )}
            </div>
        </div>
    )
}

function AuthScreen() {
    const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setMessage('')

        if (!email.trim() || password.length < 8) {
            setError('Enter a valid email and a password with at least 8 characters.')
            return
        }

        setBusy(true)
        const result =
            mode === 'sign-in'
                ? await signInWithPassword(email.trim(), password)
                : await signUpWithPassword(email.trim(), password)
        setBusy(false)

        if (result.error) {
            setError(result.error.message)
            return
        }

        if (mode === 'sign-up' && !result.data.session) {
            setMessage('Check your email to confirm your account before signing in.')
        }
    }

    async function handleGoogleSignIn() {
        setError('')
        setBusy(true)
        const { error: googleError } = await signInWithGoogle()
        setBusy(false)

        if (googleError) {
            setError(googleError.message)
        }
    }

    return (
        <main className="auth-layout">
            <section className="auth-intro">
                <p className="eyebrow">LEVELUP / PRIVATE WORKSPACE</p>
                <h1>Make progress visible.</h1>
                <p className="intro-copy">
                    A focused home for the work, ideas, and milestones you want to keep
                    moving.
                </p>
            </section>

            <section className="auth-panel" aria-labelledby="auth-title">
                <div className="panel-heading">
                    <div className="icon-mark" aria-hidden="true">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <p className="eyebrow">WELCOME BACK</p>
                        <h2 id="auth-title">
                            {mode === 'sign-in' ? 'Sign in' : 'Create your account'}
                        </h2>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        minLength={8}
                        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />

                    {error && <p className="form-message error">{error}</p>}
                    {message && <p className="form-message success">{message}</p>}

                    <button type="submit" className="primary-button" disabled={busy}>
                        {busy ? 'Working...' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
                    </button>
                </form>

                <div className="divider">
                    <span>or</span>
                </div>

                <button
                    type="button"
                    className="secondary-button"
                    onClick={handleGoogleSignIn}
                    disabled={busy}
                >
                    Continue with Google
                </button>

                <p className="auth-switch">
                    {mode === 'sign-in' ? 'New to Levelup?' : 'Already have an account?'}{' '}
                    <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
                            setError('')
                            setMessage('')
                        }}
                    >
                        {mode === 'sign-in' ? 'Create an account' : 'Sign in'}
                    </button>
                </p>
            </section>
        </main>
    )
}

function AppShell() {
    const location = useLocation()
    const [homeRefresh, setHomeRefresh] = useState<(() => Promise<void>) | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const registerHomeRefresh = useCallback((refresh: (() => Promise<void>) | null) => {
        setHomeRefresh(() => refresh)
    }, [])

    async function refreshHome() {
        if (!homeRefresh || refreshing) return
        setRefreshing(true)
        try {
            await homeRefresh()
        } finally {
            setRefreshing(false)
        }
    }

    return (
        <div className="workspace-shell">
            <header className="workspace-header">
                <NavLink to="/" className="workspace-brand">LEVELUP <i>/</i> SYSTEM</NavLink>
                <ProfileNavigationMenu
                    showRefresh={location.pathname === '/'}
                    refreshing={refreshing}
                    onRefresh={() => void refreshHome()}
                />
            </header>

            <main className="management-main">
                <CornerFrame className="management-frame">
                    <Routes>
                        <Route path="/" element={<HomePage onRefreshReady={registerHomeRefresh} />} />
                        <Route path="/home" element={<Navigate to="/" replace />} />
                        <Route path="/profile" element={<StatusWindow />} />
                        <Route path="/quests" element={<Navigate to="/quests/manage" replace />} />
                        <Route path="/quests/manage" element={<ManageQuestsPage />} />
                        <Route path="/today" element={<TodayBoardPage />} />
                        <Route path="/titles" element={<TitlesPage />} />
                        <Route path="/skills" element={<SkillsPage />} />
                        <Route path="/items" element={<ItemsPage />} />
                        <Route path="/dungeons" element={<Navigate to="/dungeons/manage" replace />} />
                        <Route path="/dungeons/manage" element={<ManageDungeonsPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </CornerFrame>
            </main>
        </div>
    )
}

function App() {
    const { session, loading, authError } = useAuth()

    if (loading) {
        return <main className="loading-screen">Loading your workspace...</main>
    }

    if (!session) {
        return (
            <>
                {authError && (
                    <p className="auth-startup-error" role="alert">
                        Authentication could not be restored: {authError}
                    </p>
                )}
                <AuthScreen />
            </>
        )
    }

    return (
        <BrowserRouter>
            <AppShell />
        </BrowserRouter>
    )
}

export default App
