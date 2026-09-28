import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { classifyAuthOutcome } from "./session-outcome";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

export type ApiSession = {
  userId: string;
  supabase: ReturnType<typeof createSupabaseForRequest>;
  refreshed: CookieToSet[];
};

function createSupabaseForRequest(request: NextRequest, refreshed: CookieToSet[]) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => refreshed.push(c));
        },
      },
    },
  );
}

/**
 * Auth guard for Route Handlers: validates the cookie session, collects token
 * refreshes (they ride on the JSON response), and returns the per-request
 * Supabase client scoped by RLS.
 * Returns a 401 NextResponse when unauthenticated.
 *
 * [D-12] / [WP6-02] The 401-vs-503 decision is delegated to
 * `classifyAuthOutcome` rather than re-derived here, because the trap is that
 * `getClaims()` does *not* throw on an upstream fault — auth-js catches it and
 * returns `{ data: null, error: AuthRetryableFetchError }`, which a plain
 * `if (error) → 401` reads as a logout. A Supabase blip must not sign the user
 * out of the form they are filling in, so the classification lives in the
 * dependency-free module and gets its own tests.
 */
export async function requireApiSession(
  request: NextRequest,
): Promise<ApiSession | NextResponse> {
  const refreshed: CookieToSet[] = [];
  try {
    const supabase = createSupabaseForRequest(request, refreshed);
    const { data, error } = await supabase.auth.getClaims();
    const outcome = classifyAuthOutcome(error, data?.claims);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.code }, { status: outcome.status });
    }
    return { userId: outcome.userId, supabase, refreshed };
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
}

export function isApiSession(v: ApiSession | NextResponse): v is ApiSession {
  return !(v instanceof NextResponse);
}

/** JSON response that carries any cookies Supabase refreshed during the call. */
export function sessionResponse(session: ApiSession, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  for (const cookie of session.refreshed) {
    res.cookies.set(cookie);
  }
  return res;
}
