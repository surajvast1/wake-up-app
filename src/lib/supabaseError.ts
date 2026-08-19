import type { PostgrestError } from "@supabase/supabase-js";

/**
 * PostgREST errors are returned on `{ error }`, not thrown. Without checking,
 * the app can look "fine" while only AsyncStorage was updated.
 */
export function logSupabaseError(
  tag: string,
  error: PostgrestError | null | undefined
): boolean {
  if (!error) return false;
  console.warn(
    `[Supabase:${tag}]`,
    error.message,
    error.code ?? "",
    error.details ?? ""
  );
  return true;
}
