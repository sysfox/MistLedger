"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // 成功与失败是两种不同的语义，不能共用一个 state。
  // 「注册成功，请到邮箱确认后再登录」曾被塞进 error state，于是渲染成余烬红 +
  // role="alert"（assertive）—— 视觉与语义双重错误：ember 在本项目只表示支出与
  // 危险（DESIGN.md §二）。拆成 notice（jade + role=status，polite）与
  // error（ember + role=alert，assertive）两个独立 state 后，颜色与播报强度
  // 都跟着语义走。
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // 提交失败后把焦点移到错误文本。焦点留在按钮上时读屏用户可能收不到
  // 播报（按钮此刻被 disabled，文案又在它上方）。tabIndex={-1} 让 <p> 可编程
  // 聚焦但不进 Tab 序列；焦点环仍是灯色（§十一 #9）。
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function toFriendlyError(err: unknown): string {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Invalid login credentials")) return "邮箱或密码不对，请重试";
    if (msg.includes("User already registered")) return "该邮箱已注册，去登录";
    return "登录失败，请检查网络后重试";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          // 成功路径：不是错误。玉绿 + role=status。
          setNotice("注册成功，请到邮箱确认后再登录");
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
    // 根 layout 的「跳到主内容」skip link 指向 #main。
    <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-8">
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
        {/* role="alert" 已隐含 assertive，原来的 aria-live="assertive" 冗余 */}
        {error ? (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="focus-visible:ring-lamp/60 text-sm text-ember focus-visible:ring-2"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-jade">
            {notice}
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
          setNotice(null);
        }}
        sx={{ alignSelf: "center", minHeight: 44, fontSize: "0.875rem" }}
      >
        {mode === "signin" ? "没有账号？去注册" : "已有账号？去登录"}
      </Button>
    </main>
  );
}
