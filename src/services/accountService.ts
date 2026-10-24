import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  if (error instanceof FunctionsHttpError) {
    const body: unknown = await error.context.json().catch(() => null)
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      throw new Error(body.error)
    }
  }
  if (error) throw error

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
  if (signOutError) throw signOutError
}
