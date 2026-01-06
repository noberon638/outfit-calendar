"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setMsg(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("登録しました。ログインしてください。");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/app";
      }
    } catch (e: any) {
      setMsg(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Outfit Calendar</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>{mode === "login" ? "ログイン" : "新規登録"}</p>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}
        />

        <button onClick={submit} disabled={loading} style={{ padding: 12, borderRadius: 8, fontWeight: 800 }}>
          {loading ? "..." : mode === "login" ? "ログイン" : "登録"}
        </button>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          style={{ padding: 10, borderRadius: 8, opacity: 0.8 }}
        >
          {mode === "login" ? "新規登録へ" : "ログインへ"}
        </button>

        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>
    </main>
  );
}
