import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCpcbFeed, getNearestStation } from "./realtimeaqi";
import { fetchWaqiGeo } from "./waqiService";

export const AQI_DUAL_STORE_KEY = "AQI_DUAL_SOURCE_STORE_V2";

export type AqiSourceSnapshot = {
  station: string;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  distanceKm: number | null;
  updatedAtIso: string;
};

export type AqiDualStore = {
  waqi: AqiSourceSnapshot | null;
  cpcb: AqiSourceSnapshot | null;
  lastNetworkFetchAtIso: string | null;
};

export type CombinedAqiDisplay = {
  displayAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  stationLine: string;
  stationDistance: number | null;
};

type SourcePatch = {
  station?: string;
  aqi?: number | null;
  pm25?: number | null;
  pm10?: number | null;
  distanceKm?: number | null;
};

function mergeSource(
  prev: AqiSourceSnapshot | null,
  patch: SourcePatch
): AqiSourceSnapshot | null {
  const station =
    typeof patch.station === "string" && patch.station.trim().length > 0
      ? patch.station.trim()
      : prev?.station ?? "";

  const aqi =
    typeof patch.aqi === "number" && Number.isFinite(patch.aqi)
      ? patch.aqi
      : prev?.aqi ?? null;

  const pm25 =
    typeof patch.pm25 === "number" && Number.isFinite(patch.pm25)
      ? patch.pm25
      : prev?.pm25 ?? null;

  const pm10 =
    typeof patch.pm10 === "number" && Number.isFinite(patch.pm10)
      ? patch.pm10
      : prev?.pm10 ?? null;

  const distanceKm =
    typeof patch.distanceKm === "number" && Number.isFinite(patch.distanceKm)
      ? patch.distanceKm
      : prev?.distanceKm ?? null;

  const hasSignal =
    station.length > 0 ||
    aqi !== null ||
    pm25 !== null ||
    pm10 !== null ||
    distanceKm !== null;

  if (!hasSignal && !prev) return null;

  return {
    station,
    aqi,
    pm25,
    pm10,
    distanceKm,
    updatedAtIso: new Date().toISOString(),
  };
}

export function combinedDisplayFromStore(
  store: AqiDualStore | null
): CombinedAqiDisplay {
  if (!store) {
    return {
      displayAqi: null,
      pm25: null,
      pm10: null,
      stationLine: "",
      stationDistance: null,
    };
  }

  const wa = store.waqi;
  const cp = store.cpcb;
  type Cand = { aqi: number; pm25: number | null; pm10: number | null };
  const candidates: Cand[] = [];
  if (wa?.aqi != null) candidates.push({ aqi: wa.aqi, pm25: wa.pm25, pm10: wa.pm10 });
  if (cp?.aqi != null) candidates.push({ aqi: cp.aqi, pm25: cp.pm25, pm10: cp.pm10 });

  let displayAqi: number | null = null;
  let pm25: number | null = null;
  let pm10: number | null = null;
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => (a.aqi >= b.aqi ? a : b));
    displayAqi = best.aqi;
    pm25 = best.pm25;
    pm10 = best.pm10;
  }

  /** CPCB first — it is the same nearest monitor we anchor on; WAQI geo can label a different node (e.g. BWSSB) and was misleading when shown first. */
  const w = wa?.station?.trim() ?? "";
  const c = cp?.station?.trim() ?? "";
  const parts: string[] = [];
  if (c) parts.push(c);
  if (
    w &&
    w.toLowerCase() !== c.toLowerCase() &&
    !w.toLowerCase().includes(c.toLowerCase()) &&
    !c.toLowerCase().includes(w.toLowerCase())
  ) {
    parts.push(w);
  }
  const stationLine = parts.join(" · ");

  const stationDistance =
    typeof cp?.distanceKm === "number" && Number.isFinite(cp.distanceKm)
      ? cp.distanceKm
      : null;

  return {
    displayAqi,
    pm25,
    pm10,
    stationLine,
    stationDistance,
  };
}

export async function loadAqiDualStore(): Promise<AqiDualStore | null> {
  try {
    const raw = await AsyncStorage.getItem(AQI_DUAL_STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as AqiDualStore;
    if (!p || typeof p !== "object") return null;
    return {
      waqi: p.waqi ?? null,
      cpcb: p.cpcb ?? null,
      lastNetworkFetchAtIso:
        typeof p.lastNetworkFetchAtIso === "string"
          ? p.lastNetworkFetchAtIso
          : null,
    };
  } catch {
    return null;
  }
}

async function saveAqiDualStore(store: AqiDualStore): Promise<void> {
  await AsyncStorage.setItem(AQI_DUAL_STORE_KEY, JSON.stringify(store));
}

/**
 * One CPCB feed fetch → nearest monitor to user GPS → WAQI geo at that monitor’s
 * coordinates (same anchor) + CPCB row for that station. Merges with previous
 * snapshots when new values are null.
 */
export async function runDualAqiNetworkFetch(
  lat: number,
  lon: number
): Promise<CombinedAqiDisplay> {
  const prev = await loadAqiDualStore();

  let cpcbResult: ReturnType<typeof getNearestStation> = null;
  try {
    const feed = await fetchCpcbFeed();
    cpcbResult = getNearestStation(feed, lat, lon);
    if (__DEV__ && !cpcbResult) {
      console.warn(
        "[AQI] getNearestStation returned null — feed empty or no valid station coordinates"
      );
    }
  } catch (e) {
    if (__DEV__) {
      console.warn("[AQI] fetchCpcbFeed failed, keeping previous CPCB snapshot if any", e);
    }
  }

  const anchorLat = cpcbResult?.station.latitude;
  const anchorLon = cpcbResult?.station.longitude;
  const waqiCoordsOk =
    typeof anchorLat === "number" &&
    typeof anchorLon === "number" &&
    Number.isFinite(anchorLat) &&
    Number.isFinite(anchorLon);

  let waqiSnap = prev?.waqi ?? null;
  const w = await fetchWaqiGeo(
    waqiCoordsOk ? anchorLat : lat,
    waqiCoordsOk ? anchorLon : lon
  );
  if (w) {
    waqiSnap = mergeSource(waqiSnap, {
      station: w.station,
      aqi: w.aqi,
      pm25: w.pm25,
      pm10: w.pm10,
      distanceKm: null,
    });
  }

  let cpcbSnap = prev?.cpcb ?? null;
  if (cpcbResult) {
    cpcbSnap = mergeSource(cpcbSnap, {
      station: cpcbResult.station.name,
      aqi: cpcbResult.aqi,
      pm25: cpcbResult.pm25,
      pm10: cpcbResult.pm10,
      distanceKm: cpcbResult.station.distanceKm,
    });
  }

  const store: AqiDualStore = {
    waqi: waqiSnap,
    cpcb: cpcbSnap,
    lastNetworkFetchAtIso: new Date().toISOString(),
  };
  await saveAqiDualStore(store);
  return combinedDisplayFromStore(store);
}
