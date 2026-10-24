import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { supabase } from '../lib/supabaseClient'

const nativeOAuthRedirectUrl = 'io.github.keyurpatel.levelup://login-callback'
const processedCallbacks = new Set<string>()

async function completeNativeOAuth(url: string) {
  const callback = new URL(url)
  const expectedCallback = new URL(nativeOAuthRedirectUrl)

  if (
    callback.protocol !== expectedCallback.protocol ||
    callback.hostname !== expectedCallback.hostname ||
    callback.pathname !== expectedCallback.pathname
  ) {
    return
  }

  const fragment = new URLSearchParams(callback.hash.replace(/^#/, ''))
  const providerError =
    callback.searchParams.get('error_description') ??
    callback.searchParams.get('error') ??
    fragment.get('error_description') ??
    fragment.get('error')
  if (providerError) throw new Error(providerError)

  const code = callback.searchParams.get('code') ?? fragment.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    await Browser.close()
    return
  }

  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  if (!accessToken || !refreshToken) {
    throw new Error('Google sign-in returned without an authorization code or session tokens.')
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (error) throw error
  await Browser.close()
}

export async function listenForNativeOAuth(onError: (message: string) => void) {
  if (!Capacitor.isNativePlatform()) return () => {}

  const processCallback = async (url: string) => {
    if (processedCallbacks.has(url)) return
    processedCallbacks.add(url)

    try {
      await completeNativeOAuth(url)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to complete Google sign-in.')
    }
  }

  const listener: PluginListenerHandle = await App.addListener('appUrlOpen', ({ url }) => {
    void processCallback(url)
  })

  try {
    const launchUrl = await App.getLaunchUrl()
    if (launchUrl?.url) await processCallback(launchUrl.url)
  } catch (error) {
    await listener.remove()
    throw error
  }

  return () => {
    void listener.remove()
  }
}
