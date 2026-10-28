import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabaseClient'

const nativeOAuthRedirectUrl = 'io.github.keyurpatel.levelup://login-callback'

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signUpWithPassword(email: string, password: string) {
  if (Capacitor.isNativePlatform()) {
    return supabase.auth.signUp({ email, password })
  }

  const emailRedirectTo = getWebRedirectUrl()

  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  })
}

export function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    return signInWithGoogleNative()
  }

  const redirectTo = getWebRedirectUrl()

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

function getWebRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

async function signInWithGoogleNative() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: nativeOAuthRedirectUrl,
      skipBrowserRedirect: true,
    },
  })

  if (error) return { error }
  if (!data.url) return { error: new Error('Supabase did not return an OAuth URL.') }

  try {
    await Browser.open({ url: data.url })
    return { error: null }
  } catch (openError) {
    return {
      error: openError instanceof Error
        ? openError
        : new Error('Unable to open the Google sign-in page.'),
    }
  }
}

export function signOut() {
  return supabase.auth.signOut()
}