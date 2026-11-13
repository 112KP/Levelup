import assert from 'node:assert/strict'
import test from 'node:test'
import {
    clearActiveEncryptionSession,
    createUserEncryptionSession,
    decryptEmbeddedEncryptedText,
    decryptPersonalText,
    decryptText,
    encryptPersonalText,
    encryptText,
    isEncryptedText,
    setActiveEncryptionSession,
    unlockUserEncryptionSession,
    verifyDeviceEncryptionSession,
} from '../src/lib/personalDataEncryption.ts'

test('encrypted values round-trip and are bound to their field and account', async () => {
    await assert.rejects(
        createUserEncryptionSession('player-1', 'too short'),
        /at least 12 characters/,
    )
    const session = await createUserEncryptionSession('player-1', 'a sufficiently long passphrase')
    const encrypted = await encryptText('quest name', session, 'quests.name')

    assert.equal(isEncryptedText(encrypted), true)
    assert.equal(encrypted.includes('quest name'), false)
    assert.equal(await decryptText(encrypted, session, 'quests.name'), 'quest name')
    await assert.rejects(decryptText(encrypted, session, 'skills.name'), /wrong field/)
    await assert.rejects(
        decryptText(encrypted, { ...session, userId: 'player-2' }, 'quests.name'),
        /Unable to decrypt/,
    )
})

test('the encrypted profile marker verifies the passphrase and preserves its salt', async () => {
    const session = await createUserEncryptionSession('player-1', 'a sufficiently long passphrase')
    const marker = await encryptText('Player name', session, 'profiles.display_name', true)
    const unlocked = await unlockUserEncryptionSession('player-1', 'a sufficiently long passphrase', marker)

    assert.equal(unlocked.displayName, 'Player name')
    assert.deepEqual(unlocked.session.salt, session.salt)
    const remembered = await verifyDeviceEncryptionSession({
        userId: session.userId,
        key: session.key,
        salt: new Uint8Array(session.salt),
    }, marker)
    assert.equal(remembered.displayName, 'Player name')
    setActiveEncryptionSession(session)
    try {
        const updatedMarker = await encryptPersonalText('Updated player name', 'player-1', 'profiles.display_name')
        const updated = await unlockUserEncryptionSession('player-1', 'a sufficiently long passphrase', updatedMarker)
        assert.equal(updated.displayName, 'Updated player name')
        assert.deepEqual(updated.session.salt, session.salt)
    } finally {
        clearActiveEncryptionSession('player-1')
    }
    await assert.rejects(
        unlockUserEncryptionSession('player-1', 'incorrect passphrase', marker),
        /Unable to decrypt/,
    )
})

test('personal values and encrypted names embedded in activity text decrypt for the active account', async () => {
    const session = await createUserEncryptionSession('player-1', 'a sufficiently long passphrase')
    setActiveEncryptionSession(session)
    try {
        const encryptedName = await encryptPersonalText('Dungeon name', 'player-1', 'dungeons.name')
        assert.equal(await decryptPersonalText(encryptedName, 'player-1', 'dungeons.name'), 'Dungeon name')

        const encryptedQuestName = await encryptText('Quest name', session, 'quests.name')
        assert.equal(
            await decryptEmbeddedEncryptedText(`Failed: ${encryptedQuestName}`, session),
            'Failed: Quest name',
        )
    } finally {
        clearActiveEncryptionSession('player-1')
    }
})
