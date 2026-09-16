import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";

// Lazily create the browser client. `NEXT_PUBLIC_*` vars are inlined at build
// time; instantiating at module load would crash `next build` prerendering of
// client pages (e.g. /auth/login) whenever the vars are absent. Deferring to
// first use keeps the build green and only touches env at runtime in the browser.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    _client = createClient(url, anonKey);
  }
  return _client;
}

// Proxy so callers keep using `supabase.auth...` / `supabase.channel(...)` while
// the underlying client is created on first property access, never at import.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Realtime subscription helpers.
 *
 * The backend publishes broadcast events from `services/realtime_service.py`:
 *   - `circuit:{circuitId}` event `result`
 *   - `tutor:{sessionId}`   event `token`
 *
 * Each helper returns an unsubscribe function — call it on component unmount to
 * avoid leaking channels (never poll the API for these).
 */

export function subscribeToCircuitResult<T = unknown>(
  circuitId: string,
  onResult: (payload: T) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`circuit:${circuitId}`)
    .on("broadcast", { event: "result" }, ({ payload }) => onResult(payload as T))
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToTutorTokens(
  sessionId: string,
  onToken: (token: string) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`tutor:${sessionId}`)
    .on("broadcast", { event: "token" }, ({ payload }) =>
      onToken((payload as { token: string }).token)
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
