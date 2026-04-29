import fs from "fs";
import path from "path";

function getUploadDir(): string {
  const dir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
  return dir;
}

export function ensureDir(subdir: "originals" | "masked" | "documents" | "inspections"): string {
  const base = getUploadDir();
  const full = path.join(base, subdir);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
  return full;
}

export async function saveFile(
  buffer: Buffer,
  fileName: string,
  subdir: "originals" | "masked" | "documents" | "inspections"
): Promise<string> {
  const dir = ensureDir(subdir);
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  // Return relative path stored in DB
  return `${subdir}/${fileName}`;
}

export function getAbsolutePath(relativePath: string): string {
  return path.join(getUploadDir(), relativePath);
}

export function fileExists(relativePath: string): boolean {
  return fs.existsSync(getAbsolutePath(relativePath));
}
