"use client";

/**
 * Client fetcher for the /api data layer: same-origin GET with cookie auth.
 * 401 -> bounce to /login. Other failures -> thrown Error with a Chinese
 * message for section-level fallbacks.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError("网络连接失败，请稍后重试", 0);
  }
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    throw new ApiError("登录已过期，请重新登录", 401);
  }
  if (!res.ok) {
    throw new ApiError("数据加载失败，请稍后重试", res.status);
  }
  return (await res.json()) as T;
}

const RELOAD_EVENT = "mistledger:reload";

export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RELOAD_EVENT));
  }
}
