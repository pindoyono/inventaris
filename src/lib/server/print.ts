import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { regions, schoolSettings, schools } from "@/db/schema";
import { lokasiProvisional, registerCode } from "@/lib/assets-shared";
import { loadRegisterParts } from "@/lib/server/register";

export type Signer = { name: string | null; nip: string | null };

/** Data kop, penandatangan & kode lokasi untuk semua dokumen cetak */
export async function loadPrintContext(tx: Tx, schoolId: string) {
  const [sc] = await tx.select().from(schools).where(eq(schools.id, schoolId));
  const [st] = await tx.select().from(schoolSettings);
  const [reg] = await tx.select({ name: regions.name }).from(regions).where(eq(regions.code, sc.regencyCode));
  const [prov] = await tx.select({ name: regions.name }).from(regions).where(eq(regions.code, sc.provinceCode));
  const parts = await loadRegisterParts(tx, schoolId);
  // Kode lokasi dokumen = kode register baris atas tanpa tahun (UPB bawaan)
  const top = registerCode(parts, { isIntra: true, acqDate: "0000", bmdCode: "", regNo: 0 }).top.split(".");
  return {
    parts,
    kodeLokasi: top.slice(0, 8).join("."),
    provisional: lokasiProvisional(parts),
    labelQr: st.labelQr,
    labelLogo: st.labelLogo,
    school: { name: sc.name, npsn: sc.npsn },
    pemda: (st.pemdaName ?? "").toUpperCase(),
    dinas: (st.dinasName ?? "").toUpperCase(),
    alamat: st.addressFull ?? sc.address ?? "",
    logoPemda: st.logoPemdaFile,
    logoSchool: st.logoSchoolFile,
    /** "Kabupaten Malinau" → "Malinau" */
    kota: (reg?.name ?? "").replace(/^(Kabupaten|Kota)\s+/i, ""),
    provinsi: prov?.name ?? "",
    kepsek: { name: st.kepsekName, nip: st.kepsekNip } as Signer,
    pengurus: { name: st.pengurusName, nip: st.pengurusNip } as Signer,
    pengguna: { name: st.penggunaName, nip: st.penggunaNip } as Signer,
    dinasName: st.dinasName ?? "Dinas Pendidikan",
  };
}
export type PrintContext = Awaited<ReturnType<typeof loadPrintContext>>;

/** NIP 18 digit → "19700101 199503 1 001" */
export function fmtNip(nip: string | null | undefined) {
  if (!nip) return "-";
  const d = nip.replace(/\D/g, "");
  return d.length === 18 ? `${d.slice(0, 8)} ${d.slice(8, 14)} ${d.slice(14, 15)} ${d.slice(15)}` : nip;
}
