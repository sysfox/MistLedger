import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
 * Returns a 401 NextResponse instead when unauthenticated.
 */
export async function requireApiSession(
  request: NextRequest,
): Promise<ApiSession | NextResponse> {
  const refreshed: CookieToSet[] = [];
  try {
    const supabase = createSupabaseForRequest(request, refreshed);
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims || !claims.sub) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return { userId: claims.sub, supabase, refreshed };
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
