import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function isNewSupabaseApiKey(value: string): boolean {
  return value && (value.startsWith('sb_publishable_') || value.startsWith('sb_secret_'));
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v,k) => headers.set(k, v));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export async function getUserFromAuthHeader(authHeader?: string | null) {
  try {
    if (!authHeader) return null;
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    const token = m[1];

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

    const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false }
    });

    // supabase-js exposes getUser for server, but newer API exposes getUserByCookie/getUser
    const { data, error } = await client.auth.getUser(token as any);
    if (error || !data || !data.user) return null;
    return { userId: data.user.id, user: data.user };
  } catch (e) {
    return null;
  }
}
