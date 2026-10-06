import { AccessError, requireSchoolUser } from "@/lib/tenant";
import { readSchoolFile } from "@/lib/server/files";

/** Berkas milik sekolah pengguna yang sedang masuk (logo, dsb.) */
export async function GET(_req: Request, ctx: RouteContext<"/berkas/[nama]">) {
  let schoolId: string;
  try {
    schoolId = (await requireSchoolUser()).schoolId;
  } catch (e) {
    if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 401 });
    throw e;
  }
  const f = await readSchoolFile(schoolId, (await ctx.params).nama);
  if (!f) return new Response("Tidak ditemukan", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: { "Content-Type": f.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" },
  });
}
