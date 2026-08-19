import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITE_PEOPLE_KEY = "@quote_favorite_people_v1";

export async function getFavoritePeople(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITE_PEOPLE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return [];
  } catch {
    return [];
  }
}

export async function setFavoritePeople(people: string[]): Promise<void> {
  const cleaned = people
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  await AsyncStorage.setItem(FAVORITE_PEOPLE_KEY, JSON.stringify(cleaned));
}

export async function addFavoritePerson(name: string): Promise<string[]> {
  const current = await getFavoritePeople();
  const trimmed = name.trim();
  if (!trimmed || current.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }
  const updated = [...current, trimmed];
  await setFavoritePeople(updated);
  return updated;
}

export async function removeFavoritePerson(name: string): Promise<string[]> {
  const current = await getFavoritePeople();
  const updated = current.filter((p) => p.toLowerCase() !== name.toLowerCase());
  await setFavoritePeople(updated);
  return updated;
}
