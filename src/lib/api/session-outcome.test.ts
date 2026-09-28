import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";

import { classifyAuthOutcome } from "./session-outcome.js";

const CLAIMS = { sub: "3f1a…-uuid" };

function statusOf(error: unknown, claims?: { sub?: unknown } | null): number | null {
  const outcome = classifyAuthOutcome(error, claims);
  return outcome.ok ? null : outcome.status;
}

describe("上游抖动不得被当成登出", () => {
  it("a retryable fetch error is 503, not 401", () => {
    const outcome = classifyAuthOutcome(
      new AuthRetryableFetchError("TypeError: fetch failed", 0),
      null,
    );
    assert.equal(outcome.ok, false);
    assert.equal(
      outcome.ok === false && outcome.status,
      503,
      "an upstream fault is not an auth decision",
    );
    assert.equal(outcome.ok === false && outcome.code, "service-unavailable");
  });

  it("an upstream 5xx is 503 too (a real status, not the status-0 transport case)", () => {
    assert.equal(statusOf(new AuthRetryableFetchError("HTTP 502", 502), null), 503);
  });

  it("the retryable check runs before the generic `if (error)` — proven, not assumed", () => {
    const error = new AuthRetryableFetchError("fetch failed", 0);
    assert.ok(error, "precondition: the error object is truthy");
    assert.ok(
      error instanceof Error,
      "precondition: it is an AuthError, so a naive `if (error) → 401` fires on it",
    );
    assert.equal(statusOf(error, undefined), 503);
  });

  it("a genuinely missing session is still 401", () => {
    assert.equal(statusOf(new AuthSessionMissingError(), null), 401);
  });

  it("rejected credentials are still 401", () => {
    assert.equal(
      statusOf(new AuthApiError("Invalid credentials", 401, "invalid_credentials"), null),
      401,
    );
  });

  it("no error and no claims is 401", () => {
    assert.equal(statusOf(null, null), 401);
  });

  it("claims without a sub is 401 (a malformed token is not a session)", () => {
    assert.equal(statusOf(null, {}), 401);
    assert.equal(statusOf(null, { sub: "" }), 401);
  });

  it("a valid session passes through with its user id", () => {
    const outcome = classifyAuthOutcome(null, CLAIMS);
    assert.equal(outcome.ok, true);
    assert.equal(
      outcome.ok && outcome.userId,
      CLAIMS.sub,
      "the userId must be carried out of the classifier, not re-derived by the caller",
    );
    assert.equal(statusOf(null, CLAIMS), null, "and it is not a failure at all");
  });
});
