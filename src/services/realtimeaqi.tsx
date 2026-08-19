function parseFiniteNumber(value: any) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toUpperCase() === "NA") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** When overall AQI is NA, CPCB often still publishes per-pollutant sub-indices. */
function maxHourlySubIndex(pollutants: any[] | undefined): number | null {
  let max = -Infinity;
  for (const p of pollutants ?? []) {
    const v = parseFiniteNumber(p?.Hourly_sub_index);
    if (v !== null && v > max) max = v;
  }
  return max === -Infinity ? null : Math.round(max);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CPCB_FEED_URL =
  "https://airquality.cpcb.gov.in/caaqms/iit_rss_feed_with_coordinates?";

/** Raw CPCB IIT RSS JSON (one HTTP GET). */
export async function fetchCpcbFeed(): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(CPCB_FEED_URL, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`CPCB request failed (${response.status})`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Closest monitor in the CPCB feed to the user's coordinates (valid lat/lon only).
 */
export function getNearestStation(
  cpcbResponse: any,
  userLat: number,
  userLon: number
) {
  let bestStation: any = null;
  let bestDistance = Infinity;

  for (const state of cpcbResponse?.country ?? []) {
    for (const city of state?.citiesInState ?? []) {
      for (const station of city?.stationsInCity ?? []) {
        const lat = parseFiniteNumber(station?.latitude);
        const lon = parseFiniteNumber(station?.longitude);
        if (lat === null || lon === null) continue;

        const dist = haversine(userLat, userLon, lat, lon);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestStation = station;
        }
      }
    }
  }

  if (!bestStation) return null;

  const pm25 =
    parseFiniteNumber(
      bestStation?.pollutants?.find((p: any) => p?.indexId === "PM2.5")?.avg
    ) ?? null;

  const pm10 =
    parseFiniteNumber(
      bestStation?.pollutants?.find((p: any) => p?.indexId === "PM10")?.avg
    ) ?? null;

  const stationLat = parseFiniteNumber(bestStation?.latitude);
  const stationLon = parseFiniteNumber(bestStation?.longitude);
  if (stationLat === null || stationLon === null) return null;

  const aqiOverall = parseFiniteNumber(bestStation?.airQualityIndexValue);
  const aqiFromSubs = maxHourlySubIndex(bestStation?.pollutants);
  const aqi = aqiOverall ?? aqiFromSubs ?? null;

  return {
    aqi,
    pm25,
    pm10,
    predominantParameter: bestStation?.predominantParameter ?? "NA",
    station: {
      name: bestStation?.stationName ?? "NA",
      siteId: bestStation?.siteId ?? "NA",
      latitude: stationLat,
      longitude: stationLon,
      distanceKm: Number(bestDistance.toFixed(2)),
      lastUpdate: bestStation?.lastUpdate ?? "NA",
    },
    pollutants: bestStation?.pollutants ?? [],
    source: "CPCB" as const,
  };
}

export async function realtimeAqi(latitude: number, longitude: number) {
  const data = await fetchCpcbFeed();
  return getNearestStation(data, latitude, longitude);
}
