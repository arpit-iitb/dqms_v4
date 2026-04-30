import { prisma } from "./prisma";
import fs from "fs";
import path from "path";

type Subdir = "originals" | "masked" | "documents" | "inspections";

// Use DB storage on Vercel (no persistent filesystem) or when explicitly set
const useDbStorage = !!process.env.VERCEL || process.env.USE_DB_STORAGE === "true";

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".step": "application/octet-stream",
    ".stp": "application/octet-stream",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeMap[ext] || "application/octet-stream";
}

// ---------- Local filesystem helpers (dev) ----------

function getUploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
}

export function ensureDir(subdir: Subdir): string {
  const base = getUploadDir();
  const full = path.join(base, subdir);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
  return full;
}

// ---------- Public API ----------

export async function saveFile(
  buffer: Buffer,
  fileName: string,
  subdir: Subdir,
): Promise<string> {
  const storageKey = `${subdir}/${fileName}`;

  if (useDbStorage) {
    const mimeType = getMimeType(fileName);
    const data = Buffer.from(buffer) as unknown as Uint8Array<ArrayBuffer>;
    await prisma.fileBlob.upsert({
      where: { storageKey },
      update: { data, mimeType, size: buffer.length },
      create: { storageKey, data, mimeType, size: buffer.length },
    });
    return storageKey;
  }

  const dir = ensureDir(subdir);
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return storageKey;
}

export async function getFileBuffer(storageKey: string): Promise<Buffer | null> {
  if (useDbStorage) {
    const blob = await prisma.fileBlob.findUnique({
      where: { storageKey },
      select: { data: true },
    });
    if (!blob) return null;
    return Buffer.from(blob.data);
  }

  const absPath = path.join(getUploadDir(), storageKey);
  if (!fs.existsSync(absPath)) return null;
  return fs.readFileSync(absPath);
}

export async function fileExists(storageKey: string): Promise<boolean> {
  if (useDbStorage) {
    const count = await prisma.fileBlob.count({ where: { storageKey } });
    return count > 0;
  }
  return fs.existsSync(path.join(getUploadDir(), storageKey));
}

export async function getFileMime(storageKey: string): Promise<string> {
  if (useDbStorage) {
    const blob = await prisma.fileBlob.findUnique({
      where: { storageKey },
      select: { mimeType: true },
    });
    return blob?.mimeType ?? "application/octet-stream";
  }
  return getMimeType(storageKey);
}

// Legacy compat — for code that still uses absolute paths
export function getAbsolutePath(relativePath: string): string {
  return path.join(getUploadDir(), relativePath);
}
