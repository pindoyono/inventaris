import { AccessError, requireSchoolUser } from "@/lib/tenant";
import { buildTemplate } from "@/lib/server/impor/template";
import { IMPORT_SPECS, type ImportKind } from "@/lib/server/impor/spec";

export async function GET(_req: Request, ctx: RouteContext<"/impor/template/[jenis]">) {
  try { await requireSchoolUser(["ADMIN", "PETUGAS"]); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 403 }); throw e; }
  const kind = (await ctx.params).jenis as ImportKind;
  if (!(kind in IMPORT_SPECS)) return new Response("Tidak ditemukan", { status: 404 });
  const buf = await buildTemplate(kind);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-impor-${kind}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
