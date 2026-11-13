import { supabase } from './supabaseClient'
import type { Database } from '../types/database.types'
import { encryptText, isEncryptedText } from './personalDataEncryption'
import type { UserEncryptionSession } from './personalDataEncryption'

type MigrationProgress = (message: string) => void

const migrationPageSize = 100

export async function encryptExistingPersonalText(
    userId: string,
    session: UserEncryptionSession,
    onProgress: MigrationProgress,
) {
    onProgress('Encrypting quest names and descriptions...')
    for (let offset = 0; ; offset += migrationPageSize) {
        const questsResult = await supabase
            .from('quests')
            .select('id, name, description, unit')
            .eq('user_id', userId)
            .order('id')
            .range(offset, offset + migrationPageSize - 1)
        if (questsResult.error) throw new Error(`Unable to load quests for encryption: ${questsResult.error.message}`)

        for (const quest of questsResult.data) {
            const updates: Database['public']['Tables']['quests']['Update'] = {}
            if (!isEncryptedText(quest.name)) updates.name = await encryptText(quest.name, session, 'quests.name')
            if (quest.description !== null && !isEncryptedText(quest.description)) {
                updates.description = await encryptText(quest.description, session, 'quests.description')
            }
            if (quest.unit !== null && !isEncryptedText(quest.unit)) {
                updates.unit = await encryptText(quest.unit, session, 'quests.unit')
            }
            if (Object.keys(updates).length === 0) continue
            const { error } = await supabase
                .from('quests')
                .update(updates)
                .eq('id', quest.id)
                .eq('user_id', userId)
            if (error) throw new Error(`Unable to encrypt quest ${quest.id}: ${error.message}`)
        }
        if (questsResult.data.length < migrationPageSize) break
    }

    onProgress('Encrypting dungeon names...')
    for (let offset = 0; ; offset += migrationPageSize) {
        const dungeonsResult = await supabase
            .from('dungeons')
            .select('id, name')
            .eq('user_id', userId)
            .order('id')
            .range(offset, offset + migrationPageSize - 1)
        if (dungeonsResult.error) throw new Error(`Unable to load dungeons for encryption: ${dungeonsResult.error.message}`)

        for (const dungeon of dungeonsResult.data) {
            if (isEncryptedText(dungeon.name)) continue
            const { error } = await supabase
                .from('dungeons')
                .update({ name: await encryptText(dungeon.name, session, 'dungeons.name') })
                .eq('id', dungeon.id)
                .eq('user_id', userId)
            if (error) throw new Error(`Unable to encrypt dungeon ${dungeon.id}: ${error.message}`)
        }
        if (dungeonsResult.data.length < migrationPageSize) break
    }

    onProgress('Encrypting inventory names and descriptions...')
    for (let offset = 0; ; offset += migrationPageSize) {
        const itemsResult = await supabase
            .from('items')
            .select('id, name, description')
            .eq('user_id', userId)
            .order('id')
            .range(offset, offset + migrationPageSize - 1)
        if (itemsResult.error) throw new Error(`Unable to load inventory for encryption: ${itemsResult.error.message}`)

        for (const item of itemsResult.data) {
            const updates: Database['public']['Tables']['items']['Update'] = {}
            if (!isEncryptedText(item.name)) updates.name = await encryptText(item.name, session, 'items.name')
            if (item.description !== null && !isEncryptedText(item.description)) {
                updates.description = await encryptText(item.description, session, 'items.description')
            }
            if (Object.keys(updates).length === 0) continue
            const { error } = await supabase
                .from('items')
                .update(updates)
                .eq('id', item.id)
                .eq('user_id', userId)
            if (error) throw new Error(`Unable to encrypt inventory item ${item.id}: ${error.message}`)
        }
        if (itemsResult.data.length < migrationPageSize) break
    }

    onProgress('Encrypting skill names and descriptions...')
    for (let offset = 0; ; offset += migrationPageSize) {
        const skillsResult = await supabase
            .from('skills')
            .select('id, name, description')
            .eq('user_id', userId)
            .order('id')
            .range(offset, offset + migrationPageSize - 1)
        if (skillsResult.error) throw new Error(`Unable to load skills for encryption: ${skillsResult.error.message}`)

        for (const skill of skillsResult.data) {
            const updates: Database['public']['Tables']['skills']['Update'] = {}
            if (!isEncryptedText(skill.name)) updates.name = await encryptText(skill.name, session, 'skills.name')
            if (skill.description !== null && !isEncryptedText(skill.description)) {
                updates.description = await encryptText(skill.description, session, 'skills.description')
            }
            if (Object.keys(updates).length === 0) continue
            const { error } = await supabase
                .from('skills')
                .update(updates)
                .eq('id', skill.id)
                .eq('user_id', userId)
            if (error) throw new Error(`Unable to encrypt skill ${skill.id}: ${error.message}`)
        }
        if (skillsResult.data.length < migrationPageSize) break
    }

    onProgress('Finishing encryption setup...')
}

export async function encryptProfileDisplayName(
    userId: string,
    displayName: string | null,
    session: UserEncryptionSession,
) {
    const encryptedDisplayName = await encryptText(
        displayName ?? '',
        session,
        'profiles.display_name',
        true,
    )
    const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: encryptedDisplayName })
        .eq('user_id', userId)
        .select('user_id')
        .maybeSingle()
    if (error) throw new Error(`Unable to save the encryption marker: ${error.message}`)
    if (!data) throw new Error('Your profile could not be found while enabling encryption.')
}
