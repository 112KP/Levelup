export const DEFAULT_TIME_ZONE = 'America/New_York'

export function getDateKey(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''

    return `${value('year')}-${value('month')}-${value('day')}`
}

export function formatDateInTimeZone(
    value: string | Date,
    options: Intl.DateTimeFormatOptions = {},
    locale?: string,
    timeZone = DEFAULT_TIME_ZONE,
) {
    const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    const date = value instanceof Date ? value : new Date(isDateOnly ? `${value}T12:00:00.000Z` : value)

    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: isDateOnly ? 'UTC' : timeZone,
    }).format(date)
}