import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTimezone } from '../auth/useTimezone'

const timeZones = ['UTC', ...Intl.supportedValuesOf('timeZone')]

function formatTimeZoneOption(timeZone: string) {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en', {
        timeZone,
        timeZoneName: 'long',
    })
    const zoneName = formatter.formatToParts(now).find((part) => part.type === 'timeZoneName')?.value
    const offsetName = new Intl.DateTimeFormat('en', {
        timeZone,
        timeZoneName: 'longOffset',
    }).formatToParts(now).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
    const offsetMatch = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offsetName)
    const offset = offsetMatch
        ? `GMT${offsetMatch[1]}${offsetMatch[2].padStart(2, '0')}:${offsetMatch[3] ?? '00'}`
        : 'GMT+00:00'
    const location = timeZone === 'UTC'
        ? 'UTC'
        : timeZone.split('/').slice(1).join(', ').replaceAll('_', ' ')

    return `${offset} — ${zoneName ?? location} (${location})`
}

const timeZoneOptions = timeZones.map((zone) => ({
    value: zone,
    label: formatTimeZoneOption(zone),
}))

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
                    {timeZoneOptions.map(({ value, label }) => (
                        <option key={value} value={value}>
                            {label}
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
