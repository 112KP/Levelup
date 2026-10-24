import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://112kp.github.io',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:5173',
])

const userOwnedTables = [
  'quest_logs',
  'quest_stat_rewards',
  'activity_log',
  'profiles',
  'dungeons',
  'items',
  'skills',
  'quests',
  'titles',
] as const

function responseHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  if (!origin || !allowedOrigins.has(origin)) {
    return new Response('Origin is not allowed.', { status: 403 })
  }

  const headers = responseHeaders(origin)

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers,
    })
  }

  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    return new Response(JSON.stringify({ error: 'Sign in to request account deletion.' }), {
      status: 401,
      headers,
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Account deletion is not configured: missing Supabase server credentials.')
    return new Response(JSON.stringify({ error: 'Account deletion is temporarily unavailable.' }), {
      status: 500,
      headers,
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Your session is invalid or expired. Sign in again.' }), {
        status: 401,
        headers,
      })
    }

    for (const table of userOwnedTables) {
      const { error } = await adminClient.from(table).delete().eq('user_id', user.id)
      if (error) {
        console.error(`Failed to delete ${table} rows for account ${user.id}:`, error)
        return new Response(
          JSON.stringify({
            error: 'Account data could not be fully deleted. Please retry or contact support.',
          }),
          { status: 500, headers },
        )
      }
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteUserError) {
      console.error(`Failed to delete auth account ${user.id}:`, deleteUserError)
      return new Response(
        JSON.stringify({
          error: 'Account data was removed, but account deletion did not finish. Please contact support.',
        }),
        { status: 500, headers },
      )
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers })
  } catch (error) {
    console.error('Unexpected error while deleting an account:', error)
    return new Response(
      JSON.stringify({
        error: 'Unable to complete account deletion. Please retry or contact support.',
      }),
      { status: 500, headers },
    )
  }
})
