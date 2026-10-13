const EASTERN_TIME_ZONE = 'America/New_York'

export function getEasternDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: EASTERN_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''

    return `${value('year')}-${value('month')}-${value('day')}`
}

export function formatEasternDate(
    value: string | Date,
    options: Intl.DateTimeFormatOptions = {},
    locale?: string,
) {
    const date = value instanceof Date
        ? value
        : /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? new Date(`${value}T12:00:00.000Z`)
            : new Date(value)

    return new Intl.DateTimeFormat(locale, { ...options, timeZone: EASTERN_TIME_ZONE }).format(date)
}