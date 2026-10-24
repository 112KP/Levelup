import { useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteAccount } from '../services/accountService'

export function DeleteAccountPage() {
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteAccount() {
    setError('')
    setDeleting(true)

    try {
      await deleteAccount()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete your account.')
      setDeleting(false)
    }
  }

  return (
    <section className="delete-account-page" aria-labelledby="delete-account-title">
      <p className="eyebrow">ACCOUNT / PERMANENT ACTION</p>
      <h1 id="delete-account-title">Delete your account</h1>
      <p>
        This permanently deletes your Levelup account and its associated profile, quests,
        history, skills, items, titles, and dungeons. You will be signed out and cannot recover this data.
      </p>
      <p>
        Deletion affects your Levelup account only. It does not delete your Google account.
        Read the <a href={`${import.meta.env.BASE_URL}privacy-policy.html`}>Privacy Policy</a>.
      </p>

      <label htmlFor="delete-account-confirmation">
        Type <strong>DELETE</strong> to confirm
      </label>
      <input
        id="delete-account-confirmation"
        autoComplete="off"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        disabled={deleting}
      />

      {error && <p className="form-message error" role="alert">{error}</p>}

      <div className="delete-account-actions">
        <Link className="secondary-button" to="/">Cancel</Link>
        <button
          className="danger-button"
          type="button"
          disabled={confirmation !== 'DELETE' || deleting}
          onClick={() => void handleDeleteAccount()}
        >
          {deleting ? 'Deleting account...' : 'Permanently delete account'}
        </button>
      </div>
    </section>
  )
}
