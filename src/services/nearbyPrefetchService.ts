/**
 * Module-level prefetch cache for the Nearby Places screen.
 *
 * Why: the Nearby screen takes 5-7s to load because it must (a) request
 * location permission state, (b) read the device location, and (c) fetch the
 * first "parks" result page from Google Places. We can kick off (a)-(c) from
 * the dashboard as soon as the user lands there, so when they swipe over to
 * Nearby the data is already (or mostly) warm.
 *
 * Consumer pattern:
 *   - On dashboard mount: `void warmNearbyPrefetch()` (fire-and-forget).
 *   - On nearby screen mount: read `getNearbyPrefetch()` and, if fresh, seed
 *     state immediately; otherwise fall back to the normal fetch path.
 */
import * as Location from "expo-location";
import {
  searchPlacesNearLocation,
  type NearbyPlace,
} from "./nearbyPlacesService";

export interface NearbyPrefetchSnapshot {
  coords: { lat: number; lng: number };
  query: string;
  places: NearbyPlace[];
  /** epoch ms when the snapshot finished */
  fetchedAt: number;
  /** permission status at the time of prefetch */
  permission: Location.PermissionStatus;
}

/** How long a warm snapshot stays fresh before we'd re-prefetch (ms). */
export const NEARBY_PREFETCH_TTL_MS = 5 * 60 * 1000;

/** Max distance user can move before the warm snapshot is considered stale (km). */
const MAX_COORD_DRIFT_KM = 1.2;

let snapshot: NearbyPrefetchSnapshot | null = null;
let inflight: Promise<NearbyPrefetchSnapshot | null> | null = null;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Kick off a best-effort nearby prefetch. Resolves to the snapshot (or null
 * if the user hasn't granted location permission yet — in which case there is
 * nothing to warm up).
 */
export async function warmNearbyPrefetch(
  query: string = "parks"
): Promise<NearbyPrefetchSnapshot | null> {
  // If a prefetch is already running, just return its promise.
  if (inflight) return inflight;

  // Freshly warm? Nothing to do.
  if (snapshot && Date.now() - snapshot.fetchedAt < NEARBY_PREFETCH_TTL_MS) {
    return snapshot;
  }

  inflight = (async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        // We do not silently request permissions here — that would surprise
        // the user on the dashboard. Just bail; the Nearby screen will ask.
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      const { places, error } = await searchPlacesNearLocation(
        coords.lat,
        coords.lng,
        query,
        { maxResults: 10, radiusM: 10_000 }
      );
      if (error) return null;
      snapshot = {
        coords,
        query,
        places,
        fetchedAt: Date.now(),
        permission: status,
      };
      return snapshot;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Return the current snapshot if it's fresh enough and the user's location
 * hasn't drifted too far from where we prefetched. Otherwise `null`.
 */
export function getNearbyPrefetch(
  currentCoords?: { lat: number; lng: number } | null
): NearbyPrefetchSnapshot | null {
  if (!snapshot) return null;
  if (Date.now() - snapshot.fetchedAt > NEARBY_PREFETCH_TTL_MS) return null;
  if (currentCoords) {
    const drift = haversineKm(
      snapshot.coords.lat,
      snapshot.coords.lng,
      currentCoords.lat,
      currentCoords.lng
    );
    if (drift > MAX_COORD_DRIFT_KM) return null;
  }
  return snapshot;
}

/** Invalidate the cache — e.g. after a pull-to-refresh. */
export function clearNearbyPrefetch(): void {
  snapshot = null;
}
