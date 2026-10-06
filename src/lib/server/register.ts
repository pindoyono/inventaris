import "server-only";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { schoolSettings, schools } from "@/db/schema";
import type { RegisterParts } from "@/lib/assets-shared";

export async function loadRegisterParts(tx: Tx, schoolId: string): Promise<RegisterParts & { schoolName: string; pemdaName: string | null }> {
  const [sc] = await tx.select().from(schools).where(eq(schools.id, schoolId));
  const [st] = await tx.select().from(schoolSettings);
  return {
    ownershipCode: sc.ownershipCode,
    provinceCode: sc.provinceCode,
    regencyCode: sc.regencyCode,
    kodePengguna: st.kodePengguna,
    kodeKuasaPengguna: st.kodeKuasaPengguna,
    kodeSubKuasa: st.kodeSubKuasa,
    schoolName: sc.name,
    pemdaName: st.pemdaName,
  };
}

export const qrUrl = (token: string) => `${process.env.AUTH_URL ?? "https://inventaris.ankdev.id"}/q/${token}`;

/** SVG QR (isi: URL token acak, bukan data barang) */
export function qrSvg(token: string) {
  return QRCode.toString(qrUrl(token), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}
