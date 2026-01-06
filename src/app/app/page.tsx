"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type OutfitRow = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  comment: string | null;
  image_path: string | null;
  location_enabled: boolean | null;
  lat: number | null;
  lon: number | null;
  place: string | null;
  weather_temp_c: number | null;
  weather_code: number | null;
  weather_label: string | null;
  created_at: string;
  updated_at: string;
};

type UserSettingsRow = {
  user_id: string;
  location_enabled: boolean | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  updated_at: string;
};

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weatherLabelFromCode(code: number | null): string {
  if (code == null) return "";
  // Open-Meteo weathercode: https://open-meteo.com/en/docs
  if (code === 0) return "快晴";
  if (code === 1 || code === 2) return "晴れ";
  if (code === 3) return "くもり";
  if (code === 45 || code === 48) return "霧";
  if ([51, 53, 55, 56, 57].includes(code)) return "霧雨";
  if ([61, 63, 65, 66, 67].includes(code)) return "雨";
  if ([71, 73, 75, 77].includes(code)) return "雪";
  if ([80, 81, 82].includes(code)) return "にわか雨";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return `天気コード:${code}`;
}

async function fetchOpenMeteo(lat: number, lon: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true` +
    `&timezone=Asia%2FTokyo`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("天気API取得に失敗しました");
  const json = await res.json();
  const cw = json?.current_weather;
  return {
    tempC: typeof cw?.temperature === "number" ? cw.temperature : null,
    code: typeof cw?.weathercode === "number" ? cw.weathercode : null,
    time: cw?.time as string | undefined,
  };
}

async function geocodeCity(city: string) {
  // Nominatim (OpenStreetMap) でジオコーディング（キー不要）
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    city
  )}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("地域の検索に失敗しました");
  const json = await res.json();
  const first = json?.[0];
  if (!first) throw new Error("地域が見つかりませんでした（例: 渋谷, Tokyo などで再入力）");
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  const display = String(first.display_name || city);
  return { lat, lon, display };
}

export default function AppPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string>("");
  const [selected, setSelected] = useState<Date>(new Date());

  const [settings, setSettings] = useState<UserSettingsRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [outfit, setOutfit] = useState<OutfitRow | null>(null);

  const [comment, setComment] = useState("");
  const [city, setCity] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(true);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [weatherText, setWeatherText] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const ymd = useMemo(() => toYMD(selected), [selected]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserEmail(data.user.email ?? "");
    })();
  }, [router]);

  // 初回：ユーザー設定取得/作成
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const u = auth.user;
      if (!u) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();

      if (error) {
        setMsg(error.message);
        return;
      }

      if (!data) {
        // ないなら作る
        const init: Partial<UserSettingsRow> = {
          user_id: u.id,
          location_enabled: true,
          city: "",
          lat: null,
          lon: null,
        };
        const { data: created, error: e2 } = await supabase
          .from("user_settings")
          .insert(init)
          .select("*")
          .single();
        if (e2) {
          setMsg(e2.message);
          return;
        }
        setSettings(created as UserSettingsRow);
        setLocationEnabled(true);
        setCity("");
      } else {
        setSettings(data as UserSettingsRow);
        setLocationEnabled(Boolean(data.location_enabled));
        setCity(data.city ?? "");
      }
    })();
  }, []);

  // 日付変更：その日のoutfit取得
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: auth } = await supabase.auth.getUser();
      const u = auth.user;
      if (!u) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("outfits")
        .select("*")
        .eq("user_id", u.id)
        .eq("date", ymd)
        .maybeSingle();

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      setOutfit((data as OutfitRow) ?? null);
      setComment((data as OutfitRow)?.comment ?? "");
      setWeatherText(
        data?.weather_temp_c != null
          ? `${data.weather_label ?? ""} / ${data.weather_temp_c}℃`
          : ""
      );

      // 画像表示：保存済みなら署名URLを作る
      if (data?.image_path) {
        const { data: signed, error: e2 } = await supabase.storage
          .from("outfits")
          .createSignedUrl(data.image_path, 60 * 60);
        if (!e2 && signed?.signedUrl) {
          setImagePreviewUrl(signed.signedUrl);
        } else {
          setImagePreviewUrl("");
        }
      } else {
        setImagePreviewUrl("");
      }

      setImageFile(null);
      setLoading(false);
    })();
  }, [ymd]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function openCamera() {
    setMsg("");
    fileInputRef.current?.click();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    const url = URL.createObjectURL(f);
    setImagePreviewUrl(url);
  }

  async function saveSettings(next: Partial<UserSettingsRow>) {
    const { data: auth } = await supabase.auth.getUser();
    const u = auth.user;
    if (!u) return;

    const payload = { user_id: u.id, ...next };
    const { data, error } = await supabase
      .from("user_settings")
      .upsert(payload)
      .select("*")
      .single();

    if (error) throw error;
    const row = data as UserSettingsRow;
    setSettings(row);
    setLocationEnabled(Boolean(row.location_enabled));
    setCity(row.city ?? "");
  }

  async function updateWeatherNow() {
    setMsg("");

    try {
      if (locationEnabled) {
        // ブラウザ位置情報（Web API）
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
          });
        });

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const w = await fetchOpenMeteo(lat, lon);
        const label = weatherLabelFromCode(w.code);

        setWeatherText(
          w.tempC != null ? `${label} / ${w.tempC}℃` : `${label}`
        );

        // outfit保存時にlat/lon/weatherも一緒に入れるため、いったんstateに反映
        setOutfit((prev) =>
          prev
            ? {
                ...prev,
                location_enabled: true,
                lat,
                lon,
                weather_temp_c: w.tempC,
                weather_code: w.code,
                weather_label: label,
              }
            : ({
                id: "",
                user_id: "",
                date: ymd,
                comment: null,
                image_path: null,
                location_enabled: true,
                lat,
                lon,
                place: null,
                weather_temp_c: w.tempC,
                weather_code: w.code,
                weather_label: label,
                created_at: "",
                updated_at: "",
              } as OutfitRow)
        );

        // 設定にも反映（location_enabled）
        await saveSettings({ location_enabled: true });
      } else {
        // city から位置を決める（第三者API：Nominatim）
        if (!city.trim()) {
          setMsg("位置情報OFFの場合は、地域(city)を入力してください（例: 渋谷, Tokyo）");
          return;
        }
        const g = await geocodeCity(city.trim());
        const w = await fetchOpenMeteo(g.lat, g.lon);
        const label = weatherLabelFromCode(w.code);

        setWeatherText(
          w.tempC != null ? `${label} / ${w.tempC}℃` : `${label}`
        );

        setOutfit((prev) =>
          prev
            ? {
                ...prev,
                location_enabled: false,
                lat: g.lat,
                lon: g.lon,
                place: g.display,
                weather_temp_c: w.tempC,
                weather_code: w.code,
                weather_label: label,
              }
            : ({
                id: "",
                user_id: "",
                date: ymd,
                comment: null,
                image_path: null,
                location_enabled: false,
                lat: g.lat,
                lon: g.lon,
                place: g.display,
                weather_temp_c: w.tempC,
                weather_code: w.code,
                weather_label: label,
                created_at: "",
                updated_at: "",
              } as OutfitRow)
        );

        // 設定保存
        await saveSettings({
          location_enabled: false,
          city: city.trim(),
          lat: g.lat,
          lon: g.lon,
        });
      }
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function handleSave() {
    setMsg("");

    try {
      const { data: auth } = await supabase.auth.getUser();
      const u = auth.user;
      if (!u) {
        router.replace("/login");
        return;
      }

      let image_path = outfit?.image_path ?? null;

      // 画像アップロード（Storage）
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const filename = `${crypto.randomUUID()}.${ext}`;
        const path = `${u.id}/${ymd}/${filename}`;

        const { error: upErr } = await supabase.storage
          .from("outfits")
          .upload(path, imageFile, {
            upsert: true,
            contentType: imageFile.type,
          });

        if (upErr) throw upErr;
        image_path = path;
      }

      // 天気が空なら取っておく（最低1回は入るように）
      let lat = outfit?.lat ?? null;
      let lon = outfit?.lon ?? null;
      let place = outfit?.place ?? null;
      let weather_temp_c = outfit?.weather_temp_c ?? null;
      let weather_code = outfit?.weather_code ?? null;
      let weather_label = outfit?.weather_label ?? null;
      let locEnabled = locationEnabled;

      if (weather_temp_c == null && weather_label == null) {
        // 可能なら自動取得
        await updateWeatherNow();
        // updateWeatherNow後にstateが更新されるので、ここでは再取得しても良いが
        // まずは最小でOK（保存済みを優先）
      }

      const payload = {
        user_id: u.id,
        date: ymd,
        comment: comment || null,
        image_path,
        location_enabled: locEnabled,
        lat,
        lon,
        place,
        weather_temp_c,
        weather_code,
        weather_label,
      };

      const { data, error } = await supabase
        .from("outfits")
        .upsert(payload, { onConflict: "user_id,date" })
        .select("*")
        .single();

      if (error) throw error;

      const row = data as OutfitRow;
      setOutfit(row);

      // 画像表示：署名URLに更新
      if (row.image_path) {
        const { data: signed, error: e2 } = await supabase.storage
          .from("outfits")
          .createSignedUrl(row.image_path, 60 * 60);
        if (!e2 && signed?.signedUrl) setImagePreviewUrl(signed.signedUrl);
      }

      setImageFile(null);
      setMsg("保存しました ✅");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">Outfit Calendar</h1>
            <p className="mt-2 text-sm text-white/70">Login: {userEmail}</p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            ログアウト
          </button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          {/* Left */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6 shadow-[0_0_60px_rgba(255,255,255,0.06)]">
            <div className="text-sm text-white/60">選択日</div>
            <div className="mt-1 font-medium">{ymd}</div>

            <div className="mt-6 grid gap-4">
              {/* Photo */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">写真（コーデ）</div>
                  <button
                    onClick={openCamera}
                    className="rounded-xl border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
                  >
                    撮影/選択
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPickFile}
                />

                <div className="mt-3 overflow-hidden rounded-2xl border border-white/15 bg-black/30">
                  {imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreviewUrl}
                      alt="outfit"
                      className="h-72 w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-72 items-center justify-center text-sm text-white/40">
                      まだ写真がありません
                    </div>
                  )}
                </div>

                {outfit?.place ? (
                  <div className="mt-2 text-xs text-white/50">場所: {outfit.place}</div>
                ) : null}
              </div>

              {/* Comment */}
              <div>
                <div className="text-sm font-medium">コメント</div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="例：夕方寒かった / ブーツが良かった など"
                  className="mt-2 h-28 w-full resize-none rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </div>

              {/* Location & Weather */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">天気 / 気温</div>
                  <button
                    onClick={updateWeatherNow}
                    className="rounded-xl border border-white/20 px-3 py-2 text-xs hover:bg-white/10"
                  >
                    取得/更新
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={locationEnabled}
                      onChange={async (e) => {
                        const v = e.target.checked;
                        setLocationEnabled(v);
                        try {
                          await saveSettings({ location_enabled: v });
                        } catch (err: any) {
                          setMsg(err?.message ?? String(err));
                        }
                      }}
                    />
                    位置情報を使う（ONで現在地）
                  </label>
                </div>

                {!locationEnabled ? (
                  <div className="mt-3">
                    <div className="text-xs text-white/60">地域（位置情報OFF用）</div>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="例：渋谷 / Tokyo / Shinjuku"
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
                    />
                  </div>
                ) : null}

                <div className="mt-3 text-sm text-white/80">
                  {weatherText ? weatherText : <span className="text-white/40">未取得</span>}
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  保存
                </button>
                {msg ? <div className="text-sm text-white/70">{msg}</div> : null}
              </div>
            </div>
          </div>

          {/* Right: Calendar */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6 shadow-[0_0_60px_rgba(255,255,255,0.06)]">
            <div className="text-sm font-medium">Calendar</div>

            <div className="mt-4">
              <DayPicker
                mode="single"
                selected={selected}
                onSelect={(d) => d && setSelected(d)}
                defaultMonth={selected}
                showOutsideDays
                styles={{
                  caption: { color: "white" },
                }}
              />
            </div>

            <div className="mt-4 text-xs text-white/50">
              ※ 右側カレンダーで日付を切り替えると、その日の保存データを読み込みます
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}