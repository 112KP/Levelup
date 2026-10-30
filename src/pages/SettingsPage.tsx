import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabaseClient'
import { useTimezone } from '../auth/useTimezone'

const timeZones = ['UTC', ...Intl.supportedValuesOf('timeZone')]

function getTimeZoneOffsetMinutes(timeZone: string) {
    const now = new Date()
    const offsetName = new Intl.DateTimeFormat('en', {
        timeZone,
        timeZoneName: 'longOffset',
    }).formatToParts(now).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
    const offsetMatch = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offsetName)
    if (!offsetMatch) return 0

    const minutes = Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] ?? 0)
    return offsetMatch[1] === '-' ? -minutes : minutes
}

function formatTimeZoneOption(timeZone: string, offsetMinutes: number) {
    const zoneName = new Intl.DateTimeFormat('en', {
        timeZone,
        timeZoneName: 'long',
    }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value
    const sign = offsetMinutes < 0 ? '-' : '+'
    const absoluteOffset = Math.abs(offsetMinutes)
    const offset = `GMT${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`
    const location = timeZone === 'UTC'
        ? 'UTC'
        : timeZone.split('/').slice(1).join(', ').replaceAll('_', ' ')

    return `${offset} — ${zoneName ?? location} (${location})`
}

const timeZoneOptions = timeZones.map((zone) => ({
    value: zone,
    offsetMinutes: getTimeZoneOffsetMinutes(zone),
})).map(({ value, offsetMinutes }) => ({
    value,
    offsetMinutes,
    label: formatTimeZoneOption(value, offsetMinutes),
})).reduce<Array<{ offsetMinutes: number; options: Array<{ value: string; label: string }> }>>(
    (groups, option) => {
        let group = groups.find((candidate) => candidate.offsetMinutes === option.offsetMinutes)
        if (!group) {
            group = { offsetMinutes: option.offsetMinutes, options: [] }
            groups.push(group)
        }
        group.options.push({ value: option.value, label: option.label })
        return groups
    },
    [],
).sort((left, right) => left.offsetMinutes - right.offsetMinutes)

for (const group of timeZoneOptions) {
    group.options.sort((left, right) => left.label.localeCompare(right.label))
}

function formatOffset(offsetMinutes: number) {
    const sign = offsetMinutes < 0 ? '-' : '+'
    const absoluteOffset = Math.abs(offsetMinutes)
    return `GMT${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`
}

export function SettingsPage() {
    const { session } = useAuth()
    const { timeZone, loading, error, updateTimeZone } = useTimezone()
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [profile, setProfile] = useState<{
        userId: string
        displayName: string
        error: string
    } | null>(null)
    const [profileNameSaving, setProfileNameSaving] = useState(false)
    const [profileNameSaved, setProfileNameSaved] = useState(false)
    const userId = session?.user.id
    const currentProfile = profile && profile.userId === userId ? profile : null
    const profileNameLoading = Boolean(userId) && !currentProfile
    const profileName = currentProfile?.displayName ?? ''
    const profileNameError = !userId
        ? 'You must be signed in to edit your profile name.'
        : currentProfile?.error ?? ''

    useEffect(() => {
        let active = true

        async function loadProfileName() {
            if (!userId) return

            const { data, error: queryError } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .maybeSingle()

            if (!active) return
            setProfile({
                userId,
                displayName: data?.display_name ?? '',
                error: queryError?.message ?? (data ? '' : 'Your profile could not be found.'),
            })
        }

        void loadProfileName()

        return () => {
            active = false
        }
    }, [userId])

    async function handleProfileNameSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!userId || profileNameSaving) return

        setProfileNameSaving(true)
        setProfileNameSaved(false)
        setProfile((current) => current?.userId === userId
            ? { ...current, error: '' }
            : current)
        try {
            const displayName = profileName.trim()
            const { data, error: updateError } = await supabase
                .from('profiles')
                .update({ display_name: displayName || null })
                .eq('user_id', userId)
                .select('user_id')
                .maybeSingle()

            if (updateError) throw updateError
            if (!data) throw new Error('Your profile could not be found.')

            setProfile({ userId, displayName, error: '' })
            setProfileNameSaved(true)
        } catch (saveError) {
            const message =
                saveError instanceof Error ? saveError.message : 'Unable to save your profile name.'
            setProfile((current) => current?.userId === userId
                ? { ...current, error: message }
                : { userId, displayName: profileName, error: message })
        } finally {
            setProfileNameSaving(false)
        }
    }

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
                <h2>Profile</h2>
                <p id="profile-name-help">Choose the name shown on your profile page.</p>
                <form className="settings-profile-form" onSubmit={(event) => void handleProfileNameSubmit(event)}>
                    <label htmlFor="profile-name">Profile name</label>
                    <input
                        id="profile-name"
                        aria-describedby="profile-name-help"
                        autoComplete="nickname"
                        maxLength={50}
                        value={profileName}
                        disabled={!userId || profileNameLoading || profileNameSaving}
                        onChange={(event) => {
                            const displayName = event.target.value
                            setProfile((current) => userId && current?.userId === userId
                                ? { ...current, displayName, error: '' }
                                : current)
                            setProfileNameSaved(false)
                        }}
                    />
                    <button
                        className="primary-button settings-save-button"
                        type="submit"
                        disabled={!userId || profileNameLoading || profileNameSaving}
                    >
                        {profileNameSaving ? 'Saving...' : 'Save profile name'}
                    </button>
                </form>
                {profileNameLoading && <p className="settings-message">Loading your profile...</p>}
                {profileNameSaved && <p className="settings-message settings-success" role="status">Profile name saved.</p>}
                {profileNameError && <p className="settings-message settings-error" role="alert">{profileNameError}</p>}
            </div>

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
                    {timeZoneOptions.map(({ offsetMinutes, options }) => (
                        <optgroup key={offsetMinutes} label={formatOffset(offsetMinutes)}>
                            {options.map(({ value, label }) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </optgroup>
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
