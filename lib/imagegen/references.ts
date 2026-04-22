import fs from "fs/promises";
import path from "path";

const REF_ROOT = path.join(process.cwd(), "public", "reference-images");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export type ReferenceCategoryMeta = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
};

export type LoadedReferenceImage = {
  data: Buffer;
  mimeType: string;
  fileName: string;
};

export type LoadedReferenceSet = {
  styleNotes: string;
  images: LoadedReferenceImage[];
};

type StyleJson = {
  name?: string;
  description?: string;
  styleNotes?: string;
};

let listCache: ReferenceCategoryMeta[] | null = null;

export function clearReferenceCache(): void {
  listCache = null;
}

function mimeForExt(ext: string): string {
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

/** Allow only safe folder names under reference-images (no path traversal). */
export function isSafeCategoryId(id: string): boolean {
  if (!id || id.length > 120) return false;
  return /^[a-z0-9][a-z0-9_-]*$/i.test(id);
}

async function readStyleJson(dir: string): Promise<StyleJson> {
  try {
    const raw = await fs.readFile(path.join(dir, "style.json"), "utf-8");
    return JSON.parse(raw) as StyleJson;
  } catch {
    return {};
  }
}

function firstThumbnailFile(files: string[]): string | null {
  const imgs = files
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return imgs[0] ?? null;
}

/**
 * Lists subfolders of public/reference-images/ with optional style.json metadata.
 * Results are cached in-memory for the process lifetime.
 */
export async function listReferenceCategories(): Promise<ReferenceCategoryMeta[]> {
  if (listCache) return listCache;

  let names: string[];
  try {
    names = await fs.readdir(REF_ROOT);
  } catch {
    listCache = [];
    return listCache;
  }

  const out: ReferenceCategoryMeta[] = [];

  for (const id of names) {
    const dir = path.join(REF_ROOT, id);
    let isDir = false;
    try {
      const st = await fs.stat(dir);
      isDir = st.isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    if (!isSafeCategoryId(id)) continue;

    const style = await readStyleJson(dir);
    const files = await fs.readdir(dir);
    const thumb = firstThumbnailFile(files);
    const thumbnailUrl = thumb
      ? `/reference-images/${encodeURIComponent(id)}/${encodeURIComponent(thumb)}`
      : null;

    out.push({
      id,
      name: style.name?.trim() || id,
      description: style.description?.trim() || "",
      thumbnailUrl,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  listCache = out;
  return listCache;
}

/**
 * Loads up to maxImages reference images from a category folder for multimodal Gemini input.
 */
export async function loadReferenceSet(
  category: string,
  maxImages = 3
): Promise<LoadedReferenceSet> {
  if (!isSafeCategoryId(category)) {
    return { styleNotes: "", images: [] };
  }

  const dir = path.join(REF_ROOT, category);
  const style = await readStyleJson(dir);
  const styleNotes = style.styleNotes?.trim() ?? "";

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return { styleNotes, images: [] };
  }

  const imageFiles = files
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, Math.max(0, maxImages));

  const images: LoadedReferenceImage[] = [];
  for (const fileName of imageFiles) {
    const ext = path.extname(fileName).toLowerCase();
    const full = path.join(dir, fileName);
    try {
      const data = await fs.readFile(full);
      images.push({
        data,
        mimeType: mimeForExt(ext),
        fileName,
      });
    } catch {
      // skip unreadable file
    }
  }

  return { styleNotes, images };
}
