"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6">
      <div className="flex flex-col items-center text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">雾夜账</h1>
        <div className="lamp-line mt-3 w-24" />
        <p className="mt-3 text-xs text-dim">看清每笔钱从哪出、还剩多少</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="邮箱"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="密码（至少 6 位）"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        {error ? <p className="text-sm text-ember">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "请稍候…" : mode === "signin" ? "登录" : "注册"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="link-subtle self-center text-sm"
      >
        {mode === "signin" ? "没有账号？去注册" : "已有账号？去登录"}
      </button>
    </main>
  );
}
