import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.FILES_DIR ?? "/var/lib/inventaris/files";

const IMAGE_SIGNATURES: { type: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { type: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", ext: "webp", test: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

export class FileError extends Error {}

/** Simpan gambar kecil (logo) setelah memeriksa isi berkas, bukan hanya ekstensinya. Mengembalikan nama berkas. */
export async function saveImage(schoolId: string, baseName: string, file: File, maxBytes = 1024 * 1024) {
  if (file.size === 0) throw new FileError("Berkas kosong");
  if (file.size > maxBytes) throw new FileError(`Ukuran maksimal ${Math.round(maxBytes / 1024)} KB`);
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = IMAGE_SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new FileError("Format harus PNG, JPG, atau WEBP");

  const dir = schoolDir(schoolId);
  await mkdir(dir, { recursive: true, mode: 0o750 });
  // Nama berkas baru tiap unggah agar cache browser tidak menampilkan logo lama
  const name = `${baseName}-${Date.now().toString(36)}.${sig.ext}`;
  const tmp = path.join(dir, `.${name}.tmp`);
  await writeFile(tmp, buf, { mode: 0o640 });
  await rename(tmp, path.join(dir, name));
  return name;
}

/** Simpan dokumen pendukung (PDF atau gambar), mis. scan SK. Maks 3 MB (batas unggah nginx 4 MB). */
export async function saveDocument(schoolId: string, baseName: string, file: File, maxBytes = 3 * 1024 * 1024) {
  if (file.size === 0) throw new FileError("Berkas kosong");
  if (file.size > maxBytes) throw new FileError(`Ukuran maksimal ${Math.round(maxBytes / 1024 / 1024)} MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = buf.toString("ascii", 0, 5) === "%PDF-";
  if (!isPdf) return saveImage(schoolId, baseName, file, maxBytes);
  const dir = schoolDir(schoolId);
  await mkdir(dir, { recursive: true, mode: 0o750 });
  const name = `${baseName}-${Date.now().toString(36)}.pdf`;
  const tmp = path.join(dir, `.${name}.tmp`);
  await writeFile(tmp, buf, { mode: 0o640 });
  await rename(tmp, path.join(dir, name));
  return name;
}

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };

export async function readSchoolFile(schoolId: string, name: string) {
  if (!/^[a-z0-9-]+\.(png|jpg|webp|pdf)$/.test(name)) return null;
  try {
    const data = await readFile(path.join(schoolDir(schoolId), name));
    const type = TYPES[name.split(".").pop()!];
    return { data, type };
  } catch {
    return null;
  }
}

function schoolDir(schoolId: string) {
  if (!/^[0-9a-f-]{36}$/.test(schoolId)) throw new FileError("ID sekolah tidak valid");
  return path.join(ROOT, "sekolah", schoolId);
}
