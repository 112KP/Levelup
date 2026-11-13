import type { UserEncryptionSession } from './personalDataEncryption'

const databaseName = 'levelup-device-encryption'
const objectStoreName = 'encryption-sessions'
const databaseVersion = 1

type StoredEncryptionSession = {
    userId: string
    key: CryptoKey
    salt: number[]
}

function openDatabase() {
    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('This browser does not support remembering an encryption key on this device.'))
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, databaseVersion)
        let settled = false
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(objectStoreName)) {
                request.result.createObjectStore(objectStoreName, { keyPath: 'userId' })
            }
        }
        request.onsuccess = () => {
            if (settled) {
                request.result.close()
                return
            }
            settled = true
            resolve(request.result)
        }
        request.onerror = () => {
            if (settled) return
            settled = true
            reject(new Error('Unable to open this device’s encryption-key storage.', { cause: request.error }))
        }
        request.onblocked = () => {
            if (settled) return
            settled = true
            reject(new Error('This device’s encryption-key storage is blocked by another tab. Close other Levelup tabs and retry.'))
        }
    })
}

function runTransaction<T>(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
) {
    return new Promise<T>((resolve, reject) => {
        let result: unknown
        let transaction: IDBTransaction
        try {
            transaction = database.transaction(objectStoreName, mode)
            const request = action(transaction.objectStore(objectStoreName))
            request.onsuccess = () => {
                result = request.result
            }
            request.onerror = () => {
                reject(new Error('The device encryption-key operation failed.', { cause: request.error }))
            }
            transaction.oncomplete = () => resolve(result as T)
            transaction.onerror = () => reject(new Error('The device encryption-key transaction failed.', { cause: transaction.error }))
            transaction.onabort = () => reject(new Error('The device encryption-key transaction was aborted.', { cause: transaction.error }))
        } catch (error) {
            reject(error instanceof Error ? error : new Error('The device encryption-key operation failed.'))
        }
    })
}

function isCryptoKey(value: unknown): value is CryptoKey {
    if (typeof value !== 'object' || value === null) return false
    if (!('algorithm' in value) || typeof value.algorithm !== 'object' || value.algorithm === null) return false
    if (!('name' in value.algorithm) || value.algorithm.name !== 'AES-GCM') return false
    if (!('extractable' in value) || value.extractable !== false) return false
    if (!('type' in value) || value.type !== 'secret') return false
    return 'usages' in value
        && Array.isArray(value.usages)
        && value.usages.includes('encrypt')
        && value.usages.includes('decrypt')
}

function parseStoredSession(value: unknown, userId: string): UserEncryptionSession | null {
    if (value === undefined || value === null) return null
    if (typeof value !== 'object') throw new Error('The remembered encryption key on this device is invalid.')
    if (!('userId' in value) || value.userId !== userId) {
        throw new Error('The remembered encryption key belongs to a different account.')
    }
    if (!('key' in value) || !isCryptoKey(value.key)) {
        throw new Error('The remembered encryption key on this device is invalid.')
    }
    if (
        !('salt' in value)
        || !Array.isArray(value.salt)
        || value.salt.length !== 16
        || !value.salt.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
    ) {
        throw new Error('The remembered encryption key on this device is invalid.')
    }
    return {
        userId,
        key: value.key,
        salt: new Uint8Array(value.salt),
    }
}

export async function loadDeviceEncryptionSession(userId: string) {
    const database = await openDatabase()
    try {
        const stored = await runTransaction<unknown>(
            database,
            'readonly',
            (store) => store.get(userId),
        )
        return parseStoredSession(stored, userId)
    } finally {
        database.close()
    }
}

export async function saveDeviceEncryptionSession(session: UserEncryptionSession) {
    const database = await openDatabase()
    try {
        await runTransaction<IDBValidKey>(
            database,
            'readwrite',
            (store) => store.put({
                userId: session.userId,
                key: session.key,
                salt: Array.from(session.salt),
            } satisfies StoredEncryptionSession),
        )
    } finally {
        database.close()
    }
}

export async function removeDeviceEncryptionSession(userId: string) {
    const database = await openDatabase()
    try {
        await runTransaction<undefined>(
            database,
            'readwrite',
            (store) => store.delete(userId),
        )
    } finally {
        database.close()
    }
}
