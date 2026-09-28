
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

export type ApiAuthFailure = {
  ok: false;
  status: 401 | 503;
  code: "unauthenticated" | "service-unavailable";
};

export type ApiAuthSuccess = {
  ok: true;
  userId: string;
};

export type ApiAuthOutcome = ApiAuthSuccess | ApiAuthFailure;

export function classifyAuthOutcome(
  error: unknown,
  claims: { sub?: unknown } | null | undefined,
): ApiAuthOutcome {
  if (isAuthRetryableFetchError(error)) {
    return { ok: false, status: 503, code: "service-unavailable" };
  }
  if (error || !claims?.sub) {
    return { ok: false, status: 401, code: "unauthenticated" };
  }
  return { ok: true, userId: String(claims.sub) };
}
