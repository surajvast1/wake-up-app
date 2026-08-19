/**
 * Google Places Text Search (nearby). Enable "Places API" in Google Cloud for your key.
 * Prefer EXPO_PUBLIC_GOOGLE_PLACES_API_KEY; falls back to legacy weather key if set.
 */

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingsTotal: number;
  lat: number;
  lng: number;
  distanceKm: number;
  /** First photo from Places Text Search, for Place Photo API */
  photoReference: string | null;
}

/** Build URL for legacy Place Photo endpoint (same key as Text Search). */
export function getPlacePhotoUrl(
  photoReference: string | null,
  maxWidth: number = 800
): string | null {
  if (!photoReference) return null;
  const key = getApiKey();
  if (!key) return null;
  const params = new URLSearchParams({
    maxwidth: String(maxWidth),
    photo_reference: photoReference,
    key,
  });
  return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
}

const getApiKey = (): string =>
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
  process.env.EXPO_PUBLIC_GOOGLE_WHEATHER_API_KEY?.trim() ||
  "";

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

/** How to order results in the UI (relevance = same order as Google Text Search). */
export type NearbyPlaceSortMode =
  | "relevance"
  | "rating"
  | "distance"
  | "reviews"
  | "name";

export function sortNearbyPlaces(
  places: NearbyPlace[],
  mode: NearbyPlaceSortMode
): NearbyPlace[] {
  if (mode === "relevance") return [...places];

  const out = [...places];
  out.sort((a, b) => {
    switch (mode) {
      case "rating": {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        if (rb !== ra) return rb - ra;
        return a.distanceKm - b.distanceKm;
      }
      case "distance": {
        if (a.distanceKm !== b.distanceKm) {
          return a.distanceKm - b.distanceKm;
        }
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        return rb - ra;
      }
      case "reviews": {
        if (b.userRatingsTotal !== a.userRatingsTotal) {
          return b.userRatingsTotal - a.userRatingsTotal;
        }
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        return rb - ra;
      }
      case "name":
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      default:
        return 0;
    }
  });
  return out;
}

type GooglePlaceResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location?: { lat: number; lng: number } };
  photos?: Array<{ photo_reference: string; height: number; width: number }>;
};

function mapResultsToPlaces(
  raw: GooglePlaceResult[],
  userLat: number,
  userLng: number
): NearbyPlace[] {
  const places: NearbyPlace[] = [];
  for (const r of raw) {
    const lat = r.geometry?.location?.lat;
    const lng = r.geometry?.location?.lng;
    if (lat == null || lng == null) continue;
    const photoRef = r.photos?.[0]?.photo_reference ?? null;
    places.push({
      id: r.place_id,
      name: r.name,
      address: r.formatted_address ?? r.vicinity ?? "",
      rating: r.rating ?? null,
      userRatingsTotal: r.user_ratings_total ?? 0,
      lat,
      lng,
      distanceKm: haversineKm(userLat, userLng, lat, lng),
      photoReference: photoRef,
    });
  }
  return places;
}

async function fetchTextSearch(
  latitude: number,
  longitude: number,
  query: string,
  radiusM: number,
  key: string
): Promise<{
  places: NearbyPlace[];
  status: string;
  error_message?: string;
}> {
  const params = new URLSearchParams({
    query,
    location: `${latitude},${longitude}`,
    radius: String(Math.min(radiusM, 50_000)),
    key,
  });
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: GooglePlaceResult[];
  };
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    return {
      places: [],
      status: json.status,
      error_message: json.error_message,
    };
  }
  return {
    places: mapResultsToPlaces(json.results ?? [], latitude, longitude),
    status: json.status,
  };
}

/** Strong fallback for short queries ("parks", "cafes") when Text Search returns nothing. */
async function fetchNearbySearch(
  latitude: number,
  longitude: number,
  keyword: string,
  radiusM: number,
  key: string
): Promise<{
  places: NearbyPlace[];
  status: string;
  error_message?: string;
}> {
  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    radius: String(Math.min(radiusM, 50_000)),
    keyword,
    key,
  });
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: GooglePlaceResult[];
  };
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    return {
      places: [],
      status: json.status,
      error_message: json.error_message,
    };
  }
  return {
    places: mapResultsToPlaces(json.results ?? [], latitude, longitude),
    status: json.status,
  };
}

/**
 * Text Search (query + location + radius), then Nearby Search if no results.
 * Merges duplicate place_ids if both return data (prefer first list).
 */
export async function searchPlacesNearLocation(
  latitude: number,
  longitude: number,
  textQuery: string,
  options?: { radiusM?: number; maxResults?: number }
): Promise<{ places: NearbyPlace[]; error: string | null }> {
  const key = getApiKey();
  if (!key) {
    return {
      places: [],
      error:
        "Missing API key. Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to .env (Places API enabled).",
    };
  }

  const q = textQuery.trim();
  if (!q) {
    return { places: [], error: "Enter a search term." };
  }

  const radiusM = options?.radiusM ?? 10_000;
  const maxResults = options?.maxResults ?? 10;

  try {
    const text = await fetchTextSearch(latitude, longitude, q, radiusM, key);
    if (text.status !== "OK" && text.status !== "ZERO_RESULTS") {
      const msg =
        text.error_message ||
        (text.status === "REQUEST_DENIED"
          ? "Places request denied — check API key and billing."
          : `Places error: ${text.status}`);
      return { places: [], error: msg };
    }

    let places = text.places;

    if (places.length === 0) {
      const nearby = await fetchNearbySearch(
        latitude,
        longitude,
        q,
        radiusM,
        key
      );
      if (nearby.status !== "OK" && nearby.status !== "ZERO_RESULTS") {
        const msg =
          nearby.error_message ||
          (nearby.status === "REQUEST_DENIED"
            ? "Places request denied — check API key and billing."
            : `Places error: ${nearby.status}`);
        return { places: [], error: msg };
      }
      places = nearby.places;
    }

    if (places.length === 0) {
      return { places: [], error: null };
    }

    return {
      places: places.slice(0, maxResults),
      error: null,
    };
  } catch {
    return { places: [], error: "Network error loading places." };
  }
}
