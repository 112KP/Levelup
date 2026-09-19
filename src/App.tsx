import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from './auth/useAuth'
import {
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from './services/authService'
import './App.css'

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

function Workspace() {
  const { session, logout } = useAuth()
  const [error, setError] = useState('')

  async function handleLogout() {
    setError('')

    try {
      await logout()
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : 'Unable to sign out.',
      )
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">LEVELUP / WORKSPACE</p>
          <h1>Your progress starts here.</h1>
        </div>
        <button type="button" className="icon-button" onClick={handleLogout}>
          <LogOut size={18} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </header>
      <section className="empty-workspace">
        <p className="eyebrow">SIGNED IN AS</p>
        <h2>{session?.user.email}</h2>
        <p>Your private workspace is ready for the next feature.</p>
        {error && <p className="form-message error">{error}</p>}
      </section>
    </main>
  )
}

function App() {
  const { session, loading, authError } = useAuth()

  if (loading) {
    return <main className="loading-screen">Loading your workspace...</main>
  }

  return session ? (
    <Workspace />
  ) : (
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

export default App
