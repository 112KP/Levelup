import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resetMyProgress } from '../services/accountService'

export function ResetAccountPage() {
    const navigate = useNavigate()
    const [confirmation, setConfirmation] = useState('')
    const [error, setError] = useState('')
    const [resetting, setResetting] = useState(false)

    async function handleResetProgress() {
        setError('')
        setResetting(true)

        try {
            await resetMyProgress()
            navigate('/', { replace: true })
        } catch (resetError) {
            setError(resetError instanceof Error ? resetError.message : 'Unable to reset your progress.')
            setResetting(false)
        }
    }

    return (
        <section className="delete-account-page" aria-labelledby="reset-account-title">
            <p className="eyebrow">ACCOUNT / RESET PROGRESS</p>
            <h1 id="reset-account-title">Reset account progress</h1>
            <p>
                This resets your level, XP, abilities, vitals, fatigue, gold, rank, active title,
                streaks, quest history, activity history, and dungeon progress.
            </p>
            <p>
                Your account, profile name, timezone, quest templates, skills, items, dungeons,
                and unlocked titles will remain. This action cannot be undone.
            </p>

            <label htmlFor="reset-account-confirmation">
                Type <strong>RESET</strong> to confirm
            </label>
            <input
                id="reset-account-confirmation"
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={resetting}
            />

            {error && <p className="form-message error" role="alert">{error}</p>}

            <div className="delete-account-actions">
                <Link className="secondary-button" to="/settings">Cancel</Link>
                <button
                    className="danger-button"
                    type="button"
                    disabled={confirmation !== 'RESET' || resetting}
                    onClick={() => void handleResetProgress()}
                >
                    {resetting ? 'Resetting progress...' : 'Reset account progress'}
                </button>
            </div>
        </section>
    )
}
