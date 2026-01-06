"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DayPicker } from "react-day-picker";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AppPage() {
  const today = useMemo(() => new Date(), []);
  const [email, setEmail] = useState<string>("");
  const [selected, setSelected] = useState<Date>(today);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setEmail(data.user.email ?? "");
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Outfit Calendar</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>Login: {email}</p>
        </div>

        <button onClick={logout} style={{ padding: "10px 12px", borderRadius: 8, fontWeight: 800 }}>
          ログアウト
        </button>
      </header>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* 左：その日の詳細（次で写真・コメントを置く） */}
        <section style={{ padding: 16, border: "1px solid #333", borderRadius: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>選択日</h2>
          <p style={{ marginTop: 8, fontSize: 16 }}>{ymd(selected)}</p>

          <div style={{ marginTop: 16, padding: 16, border: "1px dashed #444", borderRadius: 12, opacity: 0.85 }}>
            ここに「写真アップロード」「コメント」「天気/気温」を置く
          </div>
        </section>

        {/* 右：カレンダー（今日がデフォルトで選択） */}
        <aside style={{ padding: 16, border: "1px solid #333", borderRadius: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Calendar</h3>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            defaultMonth={today}
          />
        </aside>
      </div>
    </main>
  );
}