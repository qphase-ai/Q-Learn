import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

// Browser client — uses the public anon key. Never import the service key here.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
