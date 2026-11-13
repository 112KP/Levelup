import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { PersonalDataEncryptionContext } from './PersonalDataEncryptionContext'
import {
    clearActiveEncryptionSession,
    createUserEncryptionSession,
    isEncryptedText,
    setActiveEncryptionSession,
    unlockUserEncryptionSession,
    verifyDeviceEncryptionSession,
} from '../lib/personalDataEncryption'
import type { UserEncryptionSession } from '../lib/personalDataEncryption'
import { encryptExistingPersonalText, encryptProfileDisplayName } from '../lib/encryptedDataMigration'
import {
    loadDeviceEncryptionSession,
    removeDeviceEncryptionSession,
    saveDeviceEncryptionSession,
} from '../lib/deviceEncryptionStorage'
import { supabase } from '../lib/supabaseClient'

type EncryptionMode =
    | 'loading'
    | 'load-error'
    | 'disabled'
    | 'unlocked'
    | 'locked'
    | 'migrating'
    | 'migration-error'
    | 'enable-error'

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'An unexpected encryption error occurred.'
}

function EncryptionGate({
    mode,
    error,
    progress,
    onUnlock,
    onResume,
    onLock,
    onRetryLoad,
    onReturnToSettings,
}: {
    mode: EncryptionMode
    error: string
    progress: string
    onUnlock: (passphrase: string, rememberDevice: boolean) => Promise<void>
    onResume: () => void
    onLock: () => void
    onRetryLoad: () => void
    onReturnToSettings: () => void
}) {
    const { logout } = useAuth()
    const [passphrase, setPassphrase] = useState('')
    const [rememberDevice, setRememberDevice] = useState(false)
    const [busy, setBusy] = useState(false)
    const [signOutError, setSignOutError] = useState('')

    async function handleUnlock(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        setBusy(true)
        try {
            await onUnlock(passphrase, rememberDevice)
            setPassphrase('')
        } finally {
            setBusy(false)
        }
    }

    async function handleSignOut() {
        setSignOutError('')
        try {
            await logout()
        } catch (signOutError) {
            setSignOutError(getErrorMessage(signOutError))
        }
    }

    return (
        <main className="encryption-gate">
            <section className="encryption-gate-card" aria-labelledby="encryption-gate-title">
                <p className="eyebrow">LEVELUP / PRIVATE DATA</p>
                {mode === 'loading' && (
                    <>
                        <h1 id="encryption-gate-title">Checking encryption status</h1>
                        <p>Your private data settings are loading.</p>
                    </>
                )}
                {mode === 'load-error' && (
                    <>
                        <h1 id="encryption-gate-title">Encryption status unavailable</h1>
                        <p className="encryption-gate-error" role="alert">{error}</p>
                        <button className="primary-button" type="button" onClick={onRetryLoad}>Try again</button>
                    </>
                )}
                {mode === 'locked' && (
                    <>
                        <h1 id="encryption-gate-title">Unlock your private data</h1>
                        <p>Enter the passphrase you chose when enabling encryption.</p>
                        <form className="encryption-gate-form" onSubmit={(event) => void handleUnlock(event)}>
                            <label htmlFor="encryption-passphrase">Passphrase</label>
                            <input
                                id="encryption-passphrase"
                                type="password"
                                autoComplete="current-password"
                                value={passphrase}
                                onChange={(event) => setPassphrase(event.target.value)}
                                required
                            />
                            <label className="encryption-remember-option">
                                <input
                                    type="checkbox"
                                    checked={rememberDevice}
                                    onChange={(event) => setRememberDevice(event.target.checked)}
                                />
                                Remember this device
                            </label>
                            <p className="encryption-gate-note">
                                Saves a non-exportable key in this browser, not your Levelup database. Clearing site data removes it.
                                Anyone who can access this device or run code from the same origin may be able to use it.
                            </p>
                            {error && <p className="encryption-gate-error" role="alert">{error}</p>}
                            <button className="primary-button" type="submit" disabled={busy}>
                                {busy ? 'Unlocking...' : 'Unlock data'}
                            </button>
                        </form>
                        <button className="text-button encryption-gate-signout" type="button" onClick={() => void handleSignOut()}>
                            Sign out
                        </button>
                        {signOutError && <p className="encryption-gate-error" role="alert">{signOutError}</p>}
                    </>
                )}
                {mode === 'migrating' && (
                    <>
                        <h1 id="encryption-gate-title">Encrypting your personal data</h1>
                        <p>{progress}</p>
                        <p>This page will continue when the migration is finished.</p>
                    </>
                )}
                {mode === 'migration-error' && (
                    <>
                        <h1 id="encryption-gate-title">Encryption needs to finish</h1>
                        <p className="encryption-gate-error" role="alert">{error}</p>
                        <p>Some records may already be encrypted. Keep your passphrase safe and resume to finish the migration.</p>
                        <div className="encryption-gate-actions">
                            <button className="primary-button" type="button" onClick={onResume}>Resume encryption</button>
                            <button className="secondary-button" type="button" onClick={onLock}>Lock data</button>
                        </div>
                    </>
                )}
                {mode === 'enable-error' && (
                    <>
                        <h1 id="encryption-gate-title">Encryption was not enabled</h1>
                        <p className="encryption-gate-error" role="alert">{error}</p>
                        <button className="primary-button" type="button" onClick={onReturnToSettings}>Return to settings</button>
                    </>
                )}
            </section>
        </main>
    )
}

function PersonalDataEncryptionState({ children, userId }: { children: ReactNode; userId: string | undefined }) {
    const [mode, setMode] = useState<EncryptionMode>('loading')
    const [isEnabled, setIsEnabled] = useState(false)
    const [rememberDevice, setRememberDeviceState] = useState(false)
    const [deviceStorageError, setDeviceStorageError] = useState('')
    const [unlockedSession, setUnlockedSession] = useState<UserEncryptionSession | null>(null)
    const [pendingSession, setPendingSession] = useState<UserEncryptionSession | null>(null)
    const [rememberAfterMigration, setRememberAfterMigration] = useState(false)
    const [error, setError] = useState('')
    const [progress, setProgress] = useState('')
    const [loadAttempt, setLoadAttempt] = useState(0)

    const runMigration = useCallback(async (encryptionSession: UserEncryptionSession) => {
        if (!userId) return false
        setMode('migrating')
        setError('')
        setProgress('Preparing your personal data...')
        try {
            await encryptExistingPersonalText(userId, encryptionSession, setProgress)
            setActiveEncryptionSession(encryptionSession)
            setUnlockedSession(encryptionSession)
            setPendingSession(null)
            setMode('unlocked')
            return true
        } catch (migrationError) {
            setPendingSession(encryptionSession)
            setError(getErrorMessage(migrationError))
            setMode('migration-error')
            return false
        }
    }, [userId])

    const rememberSessionOnDevice = useCallback(async (encryptionSession: UserEncryptionSession) => {
        try {
            await saveDeviceEncryptionSession(encryptionSession)
            setRememberDeviceState(true)
            setDeviceStorageError('')
        } catch (storageError) {
            setRememberDeviceState(false)
            setDeviceStorageError(`Encryption is unlocked, but this device could not save its key: ${getErrorMessage(storageError)}`)
        }
    }, [])

    useEffect(() => {
        let active = true
        clearActiveEncryptionSession(userId)

        async function loadEncryptionState() {
            if (!userId) {
                if (active) setMode('disabled')
                return
            }

            const { data, error: queryError } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .maybeSingle()
            if (!active) return
            if (queryError || !data) {
                setError(queryError?.message ?? 'Your profile could not be found.')
                setMode('load-error')
                return
            }

            if (!isEncryptedText(data.display_name)) {
                setIsEnabled(false)
                setMode('disabled')
                return
            }

            setIsEnabled(true)
            setMode('locked')
            let savedSession: UserEncryptionSession | null
            try {
                savedSession = await loadDeviceEncryptionSession(userId)
            } catch (storageError) {
                if (!active) return
                setError(`This device could not read its remembered key. Enter your passphrase to unlock: ${getErrorMessage(storageError)}`)
                return
            }
            if (!active || !savedSession) return

            try {
                await verifyDeviceEncryptionSession(savedSession, data.display_name)
            } catch (verificationError) {
                try {
                    await removeDeviceEncryptionSession(userId)
                } catch (removeError) {
                    if (active) {
                        setRememberDeviceState(true)
                        setDeviceStorageError(`A stale remembered key could not be removed: ${getErrorMessage(removeError)}`)
                        setError(`The remembered key is invalid and could not be removed. Enter your passphrase to unlock. ${getErrorMessage(removeError)}`)
                    }
                    return
                }
                if (active) {
                    setError(`The remembered key could not unlock your data. Enter your passphrase: ${getErrorMessage(verificationError)}`)
                }
                return
            }
            if (!active) return
            setRememberDeviceState(true)
            setPendingSession(savedSession)
            await runMigration(savedSession)
        }

        void loadEncryptionState().catch((loadError: unknown) => {
            if (!active) return
            setError(getErrorMessage(loadError))
            setMode('load-error')
        })

        return () => {
            active = false
            clearActiveEncryptionSession(userId)
        }
    }, [loadAttempt, runMigration, userId])

    const enableEncryption = useCallback(async (passphrase: string, rememberDevice: boolean) => {
        if (!userId) throw new Error('You must be signed in to enable encryption.')
        setMode('migrating')
        setError('')
        setProgress('Preparing your encryption key...')
        let markerSaved = false

        try {
            const { data, error: profileError } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .maybeSingle()
            if (profileError) throw new Error(`Unable to load your profile: ${profileError.message}`)
            if (!data) throw new Error('Your profile could not be found.')

            const encryptionSession = await createUserEncryptionSession(userId, passphrase)
            await encryptProfileDisplayName(userId, data.display_name, encryptionSession)
            markerSaved = true
            setIsEnabled(true)
            setPendingSession(encryptionSession)
            setRememberAfterMigration(rememberDevice)
            const migrated = await runMigration(encryptionSession)
            if (migrated) {
                if (rememberDevice) await rememberSessionOnDevice(encryptionSession)
                setRememberAfterMigration(false)
            }
        } catch (enableError) {
            setError(getErrorMessage(enableError))
            setMode(markerSaved ? 'migration-error' : 'enable-error')
        }
    }, [rememberSessionOnDevice, runMigration, userId])

    const unlockEncryption = useCallback(async (passphrase: string, rememberDevice: boolean) => {
        if (!userId) return
        setError('')
        let encryptionSession: UserEncryptionSession
        try {
            const { data, error: profileError } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .maybeSingle()
            if (profileError) throw new Error(`Unable to load your encryption key marker: ${profileError.message}`)
            if (!data?.display_name || !isEncryptedText(data.display_name)) {
                throw new Error('The encryption key marker could not be found on your profile.')
            }
            const unlocked = await unlockUserEncryptionSession(userId, passphrase, data.display_name)
            encryptionSession = unlocked.session
            setIsEnabled(true)
            setPendingSession(encryptionSession)
        } catch (unlockError) {
            setError(getErrorMessage(unlockError))
            return
        }
        setRememberAfterMigration(rememberDevice)
        const migrated = await runMigration(encryptionSession)
        if (migrated) {
            if (rememberDevice) await rememberSessionOnDevice(encryptionSession)
            setRememberAfterMigration(false)
        }
    }, [rememberSessionOnDevice, runMigration, userId])

    const setRememberDevice = useCallback(async (remember: boolean) => {
        if (!userId || !unlockedSession) throw new Error('Unlock encrypted data before changing this device setting.')
        if (remember) {
            await saveDeviceEncryptionSession(unlockedSession)
            setRememberDeviceState(true)
            setDeviceStorageError('')
            return
        }
        await removeDeviceEncryptionSession(userId)
        setRememberDeviceState(false)
        setDeviceStorageError('')
    }, [unlockedSession, userId])

    const lockEncryption = useCallback(async () => {
        clearActiveEncryptionSession(userId)
        setUnlockedSession(null)
        setPendingSession(null)
        setRememberAfterMigration(false)
        setMode('locked')
        setError('')
        try {
            if (userId && rememberDevice) await removeDeviceEncryptionSession(userId)
            setRememberDeviceState(false)
            setDeviceStorageError('')
        } catch (storageError) {
            setError(`Data is locked for this session, but the remembered key could not be removed: ${getErrorMessage(storageError)}`)
        }
    }, [rememberDevice, userId])

    async function resumeMigration() {
        if (!pendingSession) return
        const migrated = await runMigration(pendingSession)
        if (!migrated) return
        if (rememberAfterMigration) await rememberSessionOnDevice(pendingSession)
        setRememberAfterMigration(false)
    }

    function returnToSettings() {
        setMode('disabled')
        setError('')
    }

    const contextValue = {
        isEnabled,
        rememberDevice,
        deviceStorageError,
        enableEncryption,
        setRememberDevice,
        lockEncryption,
    }

    if (mode === 'disabled' || mode === 'unlocked') {
        return (
            <PersonalDataEncryptionContext.Provider value={contextValue}>
                {children}
            </PersonalDataEncryptionContext.Provider>
        )
    }

    return (
        <EncryptionGate
            mode={mode}
            error={error}
            progress={progress}
            onUnlock={unlockEncryption}
            onResume={resumeMigration}
            onLock={lockEncryption}
            onRetryLoad={() => {
                setError('')
                setMode('loading')
                setLoadAttempt((attempt) => attempt + 1)
            }}
            onReturnToSettings={returnToSettings}
        />
    )
}

export function PersonalDataEncryptionProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth()
    const userId = session?.user.id
    return (
        <PersonalDataEncryptionState key={userId ?? 'signed-out'} userId={userId}>
            {children}
        </PersonalDataEncryptionState>
    )
}
