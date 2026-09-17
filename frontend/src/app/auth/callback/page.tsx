"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const { completeSession, error } = useAuth();

  useEffect(() => {
    // supabase-js (PKCE, detectSessionInUrl) exchanges the `?code=` for a
    // session on load. Complete our sign-in as soon as that session appears.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void completeSession(session.access_token);
      }      if (session) completeSession(session.access_token);
    });
    // Fallback: the session may already exist before the listener attaches.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) completeSession(data.session.access_token);
    });
    return () => sub.subscription.unsubscribe();
    // completeSession is recreated each render; the effect must run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 1.5rem",
        }}
      >
        Signing you in…
      </h1>

      {error ? (
        <>
          <div
            role="alert"
            style={{
              padding: "0.625rem 0.75rem",
              background: "#f8514914",
              border: "1px solid var(--error)",
              borderRadius: "6px",
              color: "var(--error)",
              fontSize: "0.875rem",
              marginBottom: "1.25rem",
            }}
          >
            {error}
          </div>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            <Link
              href="/auth/login"
              style={{ color: "var(--quantum)", textDecoration: "none" }}
            >
              Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>
          Completing your Google sign-in.
        </p>
      )}
    </>
  );
}
