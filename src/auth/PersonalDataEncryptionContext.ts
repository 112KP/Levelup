import { createContext, useContext } from 'react'

export type PersonalDataEncryptionContextValue = {
    isEnabled: boolean
    rememberDevice: boolean
    deviceStorageError: string
    enableEncryption: (passphrase: string, rememberDevice: boolean) => Promise<void>
    setRememberDevice: (rememberDevice: boolean) => Promise<void>
    lockEncryption: () => Promise<void>
}

export const PersonalDataEncryptionContext = createContext<PersonalDataEncryptionContextValue | null>(null)

export function usePersonalDataEncryption() {
    const context = useContext(PersonalDataEncryptionContext)
    if (!context) throw new Error('usePersonalDataEncryption must be used inside PersonalDataEncryptionProvider')
    return context
}
