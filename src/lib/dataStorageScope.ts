/**
 * AsyncStorage namespace per account so tasks/habits/meditation don't mix between
 * users on one device. Guest data is isolated under "guest".
 */
export function dataStorageScope(
  isGuest: boolean,
  userId: string | undefined | null
): string {
  if (isGuest) return "guest";
  if (userId) return userId;
  return "__orphan__";
}

/** UUID v4 for Supabase rows (Postgres uuid type). */
export function randomUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
