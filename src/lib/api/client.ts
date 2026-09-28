"use client";

const OUTAGE_MESSAGE = "账房暂时联系不上，稍后再试一次";
const TRANSPORT_MESSAGE = "网络连接失败，请稍后重试";
const GENERIC_MESSAGE = "数据加载失败，请稍后重试";
const UNAUTHENTICATED_MESSAGE = "登录已过期，请重新登录";

const HUMAN_COPY = /[㐀-鿿]/;

export class ApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 0 || status >= 500;
}

async function humanMessageFrom(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.clone().json();
    if (typeof body !== "object" || body === null) return null;
    const message = (body as { error?: unknown }).error;
    if (typeof message !== "string") return null;
    const trimmed = message.trim();
    return trimmed.length > 0 && HUMAN_COPY.test(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

let sessionLostHandler: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null): void {
  sessionLostHandler = handler;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError(TRANSPORT_MESSAGE, 0, true);
  }

  if (res.status === 401) {
    sessionLostHandler?.();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    throw new ApiError(UNAUTHENTICATED_MESSAGE, 401, false);
  }

  if (!res.ok) {
    if (res.status === 503) {
      throw new ApiError(OUTAGE_MESSAGE, 503, true);
    }
    const human = await humanMessageFrom(res);
    throw new ApiError(human ?? GENERIC_MESSAGE, res.status, isRetryableStatus(res.status));
  }

  return (await res.json()) as T;
}

const RELOAD_EVENT = "mistledger:reload";

export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RELOAD_EVENT));
  }
}
