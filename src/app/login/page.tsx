"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toFriendlyError(err: unknown): string {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Invalid login credentials")) return "邮箱或密码不对，请重试";
    if (msg.includes("User already registered")) return "该邮箱已注册，去登录";
    return "登录失败，请检查网络后重试";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setError("注册成功，请到邮箱确认后再登录");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-8">
      <div className="flex flex-col items-center text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">雾夜账</h1>
        <div className="lamp-line mt-3 w-24" />
        <p className="mt-3 text-xs text-dim">看清每笔钱从哪出、还剩多少</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField
          id="login-email"
          type="email"
          label="邮箱"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="login-password"
          type="password"
          label="密码"
          required
          slotProps={{ htmlInput: { minLength: 6 } }}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? (
          <p role="alert" aria-live="assertive" className="text-sm text-ember">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? "请稍候…" : mode === "signin" ? "登录" : "注册"}
        </Button>
      </form>
      <Button
        type="button"
        variant="text"
        color="primary"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        sx={{ alignSelf: "center", minHeight: 44, fontSize: "0.875rem" }}
      >
        {mode === "signin" ? "没有账号？去注册" : "已有账号？去登录"}
      </Button>
    </main>
  );
}
