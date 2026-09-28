import { supabase } from "@/integrations/supabase/client";

export const PET_BUCKET = "pet-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 6;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const cache = new Map<string, string>();

/** Turns stored storage paths into displayable signed URLs (bucket is private). */
export async function resolveImageUrls(paths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const path of paths) {
    if (!path) continue;
    if (path.startsWith("http")) {
      result[path] = path;
    } else if (cache.has(path)) {
      result[path] = cache.get(path)!;
    } else {
      missing.push(path);
    }
  }

  if (missing.length) {
    const { data } = await supabase.storage.from(PET_BUCKET).createSignedUrls(missing, 60 * 60);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        cache.set(item.path, item.signedUrl);
        result[item.path] = item.signedUrl;
      }
    }
  }
  return result;
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name}: only JPG, PNG, WebP or AVIF images are allowed.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: images must be smaller than 5 MB.`;
  }
  return null;
}

export async function uploadPetImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PET_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}
