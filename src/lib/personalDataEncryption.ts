import type { Json } from '../types/database.types'

const envelopePrefix = 'levelup-encrypted:v1.'
const profileNameContext = 'profiles.display_name'
const pbkdf2Iterations = 600_000

type EncryptedEnvelope = {
    context: string
    iv: string
    ciphertext: string
    salt?: string
}

export type UserEncryptionSession = {
    userId: string
    key: CryptoKey
    salt: Uint8Array
}

let activeSession: UserEncryptionSession | null = null

function bytesToBase64Url(bytes: Uint8Array) {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string) {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function parseEnvelope(value: string): EncryptedEnvelope {
    if (!value.startsWith(envelopePrefix)) {
        throw new Error('This value is not encrypted with Levelup personal data encryption.')
    }

    try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(value.slice(envelopePrefix.length))))
        if (
            typeof parsed !== 'object'
            || parsed === null
            || !('context' in parsed)
            || typeof parsed.context !== 'string'
            || !('iv' in parsed)
            || typeof parsed.iv !== 'string'
            || !('ciphertext' in parsed)
            || typeof parsed.ciphertext !== 'string'
            || ('salt' in parsed && typeof parsed.salt !== 'string')
        ) {
            throw new Error('Invalid encrypted value.')
        }

        return parsed as EncryptedEnvelope
    } catch (error) {
        if (error instanceof Error && error.message === 'Invalid encrypted value.') throw error
        throw new Error('Encrypted data is invalid or incomplete.', { cause: error })
    }
}

function additionalData(userId: string, context: string) {
    return new TextEncoder().encode(`${userId}\u0000${context}`)
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
    const passwordMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase.normalize('NFKC')),
        'PBKDF2',
        false,
        ['deriveKey'],
    )
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new Uint8Array(salt),
            iterations: pbkdf2Iterations,
            hash: 'SHA-256',
        },
        passwordMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    )
}

export function isEncryptedText(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.startsWith(envelopePrefix)
}

export function normalizePersonalDataError(error: unknown) {
    return error instanceof Error ? error : new Error('Unable to process encrypted personal data.')
}

export async function createUserEncryptionSession(userId: string, passphrase: string): Promise<UserEncryptionSession> {
    if (passphrase.length < 12) throw new Error('Use an encryption passphrase with at least 12 characters.')
    const salt = crypto.getRandomValues(new Uint8Array(16))
    return { userId, salt, key: await deriveKey(passphrase, salt) }
}

export async function unlockUserEncryptionSession(
    userId: string,
    passphrase: string,
    encryptedDisplayName: string,
): Promise<{ session: UserEncryptionSession; displayName: string }> {
    const envelope = parseEnvelope(encryptedDisplayName)
    if (envelope.context !== profileNameContext || !envelope.salt) {
        throw new Error('The encryption key marker is invalid.')
    }

    const salt = base64UrlToBytes(envelope.salt)
    const session = { userId, salt, key: await deriveKey(passphrase, salt) }
    const displayName = await decryptEnvelope(encryptedDisplayName, session, profileNameContext)
    return { session, displayName }
}

export async function verifyDeviceEncryptionSession(
    session: UserEncryptionSession,
    encryptedDisplayName: string,
) {
    const envelope = parseEnvelope(encryptedDisplayName)
    if (envelope.context !== profileNameContext || !envelope.salt) {
        throw new Error('The encryption key marker is invalid.')
    }
    if (bytesToBase64Url(session.salt) !== envelope.salt) {
        throw new Error('The remembered encryption key does not match this account.')
    }
    const displayName = await decryptEnvelope(encryptedDisplayName, session, profileNameContext)
    return { session, displayName }
}

export async function encryptText(
    value: string,
    session: UserEncryptionSession,
    context: string,
    includeSalt = false,
) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv,
            additionalData: additionalData(session.userId, context),
        },
        session.key,
        new TextEncoder().encode(value),
    )
    const envelope: EncryptedEnvelope = {
        context,
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
        ...(includeSalt ? { salt: bytesToBase64Url(session.salt) } : {}),
    }
    return `${envelopePrefix}${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(envelope)))}`
}

async function decryptEnvelope(
    value: string,
    session: UserEncryptionSession,
    expectedContext?: string,
) {
    const envelope = parseEnvelope(value)
    if (expectedContext && envelope.context !== expectedContext) {
        throw new Error('Encrypted data is stored in the wrong field.')
    }

    try {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: base64UrlToBytes(envelope.iv),
                additionalData: additionalData(session.userId, envelope.context),
            },
            session.key,
            base64UrlToBytes(envelope.ciphertext),
        )
        return new TextDecoder().decode(decrypted)
    } catch {
        throw new Error('Unable to decrypt data. Check the passphrase or restore the original encrypted value.')
    }
}

export function decryptText(value: string, session: UserEncryptionSession, context: string): Promise<string>
export function decryptText(value: null, session: UserEncryptionSession, context: string): Promise<null>
export function decryptText(value: string | null, session: UserEncryptionSession, context: string): Promise<string | null>
export async function decryptText(
    value: string | null,
    session: UserEncryptionSession,
    context: string,
): Promise<string | null> {
    if (value === null || !isEncryptedText(value)) return value
    return decryptEnvelope(value, session, context)
}

export async function decryptEmbeddedEncryptedText(value: string, session: UserEncryptionSession) {
    const tokens = value.match(/levelup-encrypted:v1\.[A-Za-z0-9_-]+/g)
    if (!tokens?.length) return value

    let result = value
    for (const token of new Set(tokens)) {
        const decrypted = await decryptEnvelope(token, session)
        result = result.replaceAll(token, decrypted)
    }
    return result
}

export function setActiveEncryptionSession(session: UserEncryptionSession | null) {
    activeSession = session
}

export function clearActiveEncryptionSession(userId?: string) {
    if (!userId || activeSession?.userId === userId) activeSession = null
}

function getSession(userId: string) {
    return activeSession?.userId === userId ? activeSession : null
}

export function encryptPersonalText(value: string, userId: string, context: string): Promise<string>
export function encryptPersonalText(value: null, userId: string, context: string): Promise<null>
export function encryptPersonalText(value: string | null, userId: string, context: string): Promise<string | null>
export async function encryptPersonalText(value: string | null, userId: string, context: string): Promise<string | null> {
    if (value === null) return null
    const session = getSession(userId)
    if (!session) {
        if (isEncryptedText(value)) throw new Error('Unlock encrypted data before saving it.')
        return value
    }
    if (isEncryptedText(value)) {
        await decryptText(value, session, context)
        return value
    }
    return encryptText(value, session, context, context === profileNameContext)
}

export function encryptPersonalTextForActiveSession(value: string, context: string): Promise<string>
export function encryptPersonalTextForActiveSession(value: null, context: string): Promise<null>
export function encryptPersonalTextForActiveSession(
    value: string | null,
    context: string,
): Promise<string | null>
export async function encryptPersonalTextForActiveSession(value: string | null, context: string): Promise<string | null> {
    if (value === null) return null
    if (!activeSession) {
        if (isEncryptedText(value)) throw new Error('Unlock encrypted data before saving it.')
        return value
    }
    return encryptPersonalText(value, activeSession.userId, context)
}

export function decryptPersonalText(value: string, userId: string, context: string): Promise<string>
export function decryptPersonalText(value: null, userId: string, context: string): Promise<null>
export function decryptPersonalText(value: string | null, userId: string, context: string): Promise<string | null>
export async function decryptPersonalText(value: string | null, userId: string, context: string): Promise<string | null> {
    if (value === null) return null
    const session = getSession(userId)
    if (!session) {
        if (isEncryptedText(value)) throw new Error('Unlock encrypted data to view this value.')
        return value
    }
    return decryptText(value, session, context)
}

export async function decryptEmbeddedPersonalText(value: string, userId: string) {
    const session = getSession(userId)
    if (!session) {
        if (isEncryptedText(value)) throw new Error('Unlock encrypted data to view this value.')
        return value
    }
    return decryptEmbeddedEncryptedText(value, session)
}

export async function decryptActivitySnapshot(snapshot: Json | null, userId: string) {
    if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return snapshot

    const itemName = snapshot.item_name
    if (typeof itemName !== 'string') return snapshot
    return {
        ...snapshot,
        item_name: await decryptPersonalText(itemName, userId, 'items.name'),
    }
}

