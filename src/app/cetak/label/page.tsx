import type { Metadata } from "next";
import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { assets } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { qrSvg } from "@/lib/server/register";
import { KIB_LABEL, registerCode, upbOf } from "@/lib/assets-shared";
import { Halaman, Judul } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak Label Register" };
const PER_PAGE = 14; // 2 kolom × 7 baris, label 90 × 32 mm

/**
 * Label kode register gaya SIMDA BMD (label Dinas): logo Pemda · kode lokasi · kode barang + register · footer Pemda,
 * ditambah QR (bisa dimatikan di Penyiapan). Pilihan barang:
 * ?id=…&id=… | ?batch=… | ?ruang=… | ?tahun=2026&gol=B&upb=02 (seperti filter "Label Kode Barang" di SIMDA)
 */
export default async function CetakLabel({ searchParams }: PageProps<"/cetak/label">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const uuid = (v: string) => (/^[0-9a-f-]{36}$/.test(v) ? v : null);
  const ids = ([] as string[]).concat(sp.id ?? []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
  const batch = uuid(str("batch"));
  const room = uuid(str("ruang"));
  const year = /^\d{4}$/.test(str("tahun")) ? str("tahun") : null;
  const gol = str("gol") in KIB_LABEL ? str("gol") : null;
  const upb = /^\d{2}$/.test(str("upb")) ? str("upb") : null;
  const data = await withSchool(s.schoolId, async (tx) => {
    const conds: SQL[] = [ne(assets.status, "DIHAPUS")];
    if (ids.length) conds.push(inArray(assets.id, ids));
    if (batch) conds.push(eq(assets.batchId, batch));
    if (room) conds.push(eq(assets.roomId, room));
    if (year) conds.push(sql`extract(year from ${assets.acqDate}) = ${Number(year)}`);
    if (gol) conds.push(eq(assets.kib, gol));
    const any = ids.length || batch || room || year || gol || upb;
    const list = any ? await tx.select().from(assets).where(and(...conds)).orderBy(asc(assets.bmdCode), asc(assets.regNo)).limit(1000) : [];
    return { list, c: await loadPrintContext(tx, s.schoolId) };
  });
  const { c } = data;
  const list = upb ? data.list.filter((a) => upbOf(c.parts, a.fundingSourceId) === upb) : data.list;
  const footer = c.parts.ownershipCode === "11" ? `PEMERINTAH PROVINSI ${c.provinsi.toUpperCase()}` : (c.pemda || `PEMERINTAH ${c.kota.toUpperCase()}`);
  const showQr = c.labelQr;
  const showLogo = c.labelLogo;
  const labels = await Promise.all(list.map(async (a) => ({ a, reg: registerCode(c.parts, a), qr: showQr ? await qrSvg(a.qrToken) : "" })));
  const pages = Array.from({ length: Math.max(1, Math.ceil(labels.length / PER_PAGE)) }, (_, p) => labels.slice(p * PER_PAGE, (p + 1) * PER_PAGE));
  const filterText = [year && `tahun perolehan ${year}`, gol && KIB_LABEL[gol], upb && `UPB ${upb}`].filter(Boolean).join(" · ");
  const cls = `label-dinas${showLogo ? " ada-logo" : ""}${showQr ? " ada-qr" : ""}`;
  return (
    <>
      {pages.map((pg, p) => (
        <Halaman key={p} judul={`Label Kode Register (${labels.length} label)`} ket="Format label SIMDA BMD — kode lokasi + tahun (atas), kode barang + nomor register (bawah)" bilah={p === 0}>
          {p === 0 && <Judul title="Lembar Label Kode Barang" nomor={`${labels.length} label${filterText ? ` · ${filterText}` : ""} · 90 × 32 mm, 2 × 7 per A4`} />}
          {labels.length === 0 && <p className="paragraf">Tidak ada barang dipilih.</p>}
          <div className="label-grid">
            {pg.map(({ a, reg, qr }) => (
              <div key={a.id} className="label-sel">
                <div className={cls}>
                  {showLogo && <div className="logo">{c.logoPemda ? (
                    // eslint-disable-next-line @next/next/no-img-element -- berkas privat lewat route ber-otorisasi, dicetak
                    <img src={`/berkas/${c.logoPemda}`} alt="" />
                  ) : <span>LOGO<br />PEMDA</span>}</div>}
                  <div className="kode atas">{reg.top}</div>
                  <div className="kode bawah">{reg.bottom}</div>
                  <div className="kaki">{footer}</div>
                  {showQr && <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />}
                </div>
                <div className="nm">{a.name}{a.brand ? ` · ${a.brand}` : ""}{reg.provisional && <b className="sm"> · SEMENTARA</b>}</div>
              </div>
            ))}
          </div>
        </Halaman>
      ))}
    </>
  );
}
