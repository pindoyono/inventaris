import type { Metadata } from "next";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { assets } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { qrSvg } from "@/lib/server/register";
import { registerCode } from "@/lib/assets-shared";
import { Halaman, Judul } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak Label Register" };
const PER_PAGE = 14; // 2 kolom × 7 baris, label 90 × 32 mm

/** ?id=…&id=… | ?batch=… | ?ruang=… — label kode register + QR */
export default async function CetakLabel({ searchParams }: PageProps<"/cetak/label">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const ids = ([] as string[]).concat(sp.id ?? []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
  const batch = typeof sp.batch === "string" && /^[0-9a-f-]{36}$/.test(sp.batch) ? sp.batch : null;
  const room = typeof sp.ruang === "string" && /^[0-9a-f-]{36}$/.test(sp.ruang) ? sp.ruang : null;
  const data = await withSchool(s.schoolId, async (tx) => {
    const where = ids.length ? inArray(assets.id, ids) : batch ? eq(assets.batchId, batch) : room ? eq(assets.roomId, room) : eq(assets.id, "00000000-0000-0000-0000-000000000000");
    const list = await tx.select().from(assets).where(and(where, ne(assets.status, "DIHAPUS"))).orderBy(asc(assets.bmdCode), asc(assets.regNo)).limit(500);
    return { list, c: await loadPrintContext(tx, s.schoolId) };
  });
  const { list, c } = data;
  const owner = c.parts.ownershipCode === "11" ? `MILIK PEMPROV ${c.provinsi.toUpperCase()}` : `MILIK PEMKAB/KOT ${c.kota.toUpperCase()}`;
  const labels = await Promise.all(list.map(async (a) => ({ a, reg: registerCode(c.parts, a), qr: await qrSvg(a.qrToken) })));
  const pages = Array.from({ length: Math.max(1, Math.ceil(labels.length / PER_PAGE)) }, (_, p) => labels.slice(p * PER_PAGE, (p + 1) * PER_PAGE));
  return (
    <>
      {pages.map((pg, p) => (
        <Halaman key={p} judul={`Label Kode Register (${labels.length} label)`} ket="Permendagri 108/2016 — kode lokasi + tahun (atas), kode barang + nomor register (bawah)">
          {p === 0 && <Judul title="Lembar Label Kode Register" nomor={`${labels.length} label · ukuran 90 × 32 mm · 2 kolom × 7 baris per A4`} />}
          {labels.length === 0 && <p className="paragraf">Tidak ada barang dipilih.</p>}
          <div className="label-grid">
            {pg.map(({ a, reg, qr }) => (
              <div key={a.id} className="label">
                <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
                <div className="teks">
                  <div className="pemilik">{owner}</div>
                  <div className="sek">{c.school.name.toUpperCase()}</div>
                  <div className="reg atas">{reg.top}</div>
                  <div className="reg">{reg.bottom}</div>
                  <div className="nm">{a.name}{a.brand ? ` · ${a.brand}` : ""}</div>
                  {reg.provisional && <div className="sm">SEMENTARA</div>}
                </div>
              </div>
            ))}
          </div>
        </Halaman>
      ))}
    </>
  );
}
