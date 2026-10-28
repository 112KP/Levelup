import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTimezone } from '../auth/useTimezone'

const timeZones = ['UTC', ...Intl.supportedValuesOf('timeZone')]

export function SettingsPage() {
    const { timeZone, loading, error, updateTimeZone } = useTimezone()
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    async function handleTimeZoneChange(nextTimeZone: string) {
        setSaving(true)
        setSaved(false)
        try {
            await updateTimeZone(nextTimeZone)
            setSaved(true)
        } catch {
            setSaved(false)
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="settings-page" aria-labelledby="settings-title">
            <p className="eyebrow">PREFERENCES</p>
            <h1 id="settings-title">Settings</h1>

            <div className="settings-section">
                <label htmlFor="timezone-select">Timezone</label>
                <p id="timezone-help">
                    Your daily quest board and midnight reset follow this timezone.
                </p>
                <select
                    id="timezone-select"
                    aria-describedby="timezone-help"
                    value={timeZone}
                    disabled={loading || saving}
                    onChange={(event) => void handleTimeZoneChange(event.target.value)}
                >
                    {timeZones.map((zone) => (
                        <option key={zone} value={zone}>
                            {zone.replaceAll('_', ' ')}
                        </option>
                    ))}
                </select>
                {loading && <p className="settings-message">Loading your settings...</p>}
                {saving && <p className="settings-message">Saving timezone...</p>}
                {saved && <p className="settings-message settings-success" role="status">Timezone saved.</p>}
                {error && <p className="settings-message settings-error" role="alert">{error}</p>}
            </div>

            <div className="settings-section settings-danger-zone">
                <h2>Account</h2>
                <p>Account deletion permanently removes your Levelup data.</p>
                <Link className="settings-delete-link" to="/delete-account">
                    Delete account
                </Link>
            </div>
        </section>
    )
}
