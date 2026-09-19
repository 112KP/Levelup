import { supabase } from '../lib/supabaseClient'

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signUpWithPassword(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export function signInWithGoogle() {
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}