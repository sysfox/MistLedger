import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const redirectResponse = NextResponse.redirect(
      new URL("/login", request.url),
    );
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return redirectResponse;
  }
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  // App pages are static shells with no data; unauthenticated users see the
  // skeleton once and are bounced to /login by the API layer (401), so the
  // auth roundtrip no longer blocks the first byte. `$` (not `^$`) matches the
  // empty remainder so "/" is excluded. /login keeps the gate to bounce
  // authenticated users back to the app.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|$|(?:ledger|data|settings|api)(?:$|/)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
