import "server-only";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { fundingSources, schoolSettings, schools } from "@/db/schema";
import type { RegisterParts } from "@/lib/assets-shared";

export async function loadRegisterParts(tx: Tx, schoolId: string): Promise<RegisterParts & { schoolName: string; pemdaName: string | null }> {
  const [sc] = await tx.select().from(schools).where(eq(schools.id, schoolId));
  const [st] = await tx.select().from(schoolSettings);
  const fs = await tx.select({ id: fundingSources.id, upb: fundingSources.kodeUpb }).from(fundingSources);
  return {
    ownershipCode: sc.ownershipCode,
    provinceCode: sc.provinceCode,
    regencyCode: sc.regencyCode,
    kodeProvinsi: st.kodeProvinsi,
    kodeKab: st.kodeKab,
    kodeBidang: st.kodeBidang,
    kodeUnit: st.kodeUnit,
    kodeSubUnit: st.kodeSubUnit,
    kodeUpb: st.kodeUpb,
    upbByFunding: Object.fromEntries(fs.filter((f) => f.upb).map((f) => [f.id, f.upb!])),
    schoolName: sc.name,
    pemdaName: st.pemdaName,
  };
}

export const qrUrl = (token: string) => `${process.env.AUTH_URL ?? "https://inventaris.ankdev.id"}/q/${token}`;

/** SVG QR (isi: URL token acak, bukan data barang) */
export function qrSvg(token: string) {
  return QRCode.toString(qrUrl(token), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}
