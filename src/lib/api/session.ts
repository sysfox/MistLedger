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

// 携带本次调用中 Supabase 刷新的 cookie。
export function sessionResponse(session: ApiSession, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  for (const cookie of session.refreshed) {
    res.cookies.set(cookie);
  }
  return res;
}
