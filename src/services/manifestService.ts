import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "MANIFEST_ENTRY_";

export interface ManifestEntry {
  date: string;
  content: string;
  updatedAt: string;
}

function keyFor(scope: string, date: string): string {
  return `${scope}:${KEY_PREFIX}${date}`;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getTodayManifest(
  scope: string
): Promise<ManifestEntry | null> {
  const date = todayStr();
  try {
    const raw = await AsyncStorage.getItem(keyFor(scope, date));
    if (!raw) return null;
    return JSON.parse(raw) as ManifestEntry;
  } catch {
    return null;
  }
}

export async function saveTodayManifest(
  scope: string,
  content: string
): Promise<ManifestEntry> {
  const date = todayStr();
  const entry: ManifestEntry = {
    date,
    content,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(keyFor(scope, date), JSON.stringify(entry));
  return entry;
}

export async function getManifestForDate(
  scope: string,
  date: string
): Promise<ManifestEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(scope, date));
    if (!raw) return null;
    return JSON.parse(raw) as ManifestEntry;
  } catch {
    return null;
  }
}
