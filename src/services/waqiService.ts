const WAQI_TOKEN = process.env.EXPO_PUBLIC_AQICN_TOKEN ?? "";

function parseReading(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "-") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type WaqiGeoPayload = {
  aqi: number | null;
  station: string;
  pm25: number | null;
  pm10: number | null;
};

/**
 * Nearest WAQI / AQICN node for geo coordinates. Requires EXPO_PUBLIC_AQICN_TOKEN.
 */
export async function fetchWaqiGeo(
  lat: number,
  lon: number
): Promise<WaqiGeoPayload | null> {
  const token = WAQI_TOKEN.trim();
  if (!token) return null;

  const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${encodeURIComponent(token)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      status?: string;
      data?: {
        aqi?: unknown;
        city?: { name?: string };
        iaqi?: Record<string, { v?: unknown }>;
      };
    };
    if (j.status !== "ok" || !j.data) return null;

    const iaqi = j.data.iaqi ?? {};
    return {
      aqi: parseReading(j.data.aqi),
      station:
        typeof j.data.city?.name === "string" ? j.data.city.name.trim() : "",
      pm25: parseReading(iaqi.pm25?.v),
      pm10: parseReading(iaqi.pm10?.v),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
