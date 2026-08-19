import { File } from "expo-file-system";
import { supabase, supabaseConfigured } from "./supabase";

/**
 * Uploads a local gallery image to Supabase Storage (`avatars` public bucket).
 * Returns a public HTTPS URL, or null if upload is skipped or fails.
 */
export async function uploadProfilePhotoToStorage(
  userId: string,
  localUri: string | null | undefined
): Promise<string | null> {
  if (!supabaseConfigured || !userId || !localUri) return null;
  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    return localUri;
  }

  try {
    const fileRef = new File(localUri);
    const arrayBuffer = await fileRef.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length === 0) return null;

    const isPng =
      localUri.toLowerCase().includes("png") ||
      localUri.toLowerCase().includes(".png");
    const ext = isPng ? "png" : "jpg";
    const contentType = isPng ? "image/png" : "image/jpeg";
    const path = `${userId}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, {
        contentType,
        upsert: true,
      });

    if (upErr) {
      console.warn("[avatars upload]", upErr.message);
      return null;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn("[avatars upload]", e);
    return null;
  }
}
