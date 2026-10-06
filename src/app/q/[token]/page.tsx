import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, qrTokens, schools } from "@/db/schema";
import { auth } from "@/auth";
import { withSchool } from "@/lib/tenant";
import { loadRegisterParts } from "@/lib/server/register";
import { registerCode } from "@/lib/assets-shared";

export const metadata: Metadata = { title: "Label Barang", robots: { index: false } };

/**
 * Tujuan QR label. Pengguna sekolah pemilik → halaman aset lengkap.
 * Selain itu hanya info minimal: nama barang, sekolah, kode register.
 */
export default async function QrPage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f]{24}$/.test(token)) notFound();
  const [t] = await db.select().from(qrTokens).where(eq(qrTokens.token, token));
  if (!t || t.kind !== "ASET") notFound();
  const session = await auth();
  if (session?.user?.kind === "school" && session.user.schoolId === t.schoolId) redirect(`/aset/${t.refId}`);

  const [school] = await db.select({ status: schools.status }).from(schools).where(eq(schools.id, t.schoolId));
  if (school?.status !== "ACTIVE") notFound();
  const info = await withSchool(t.schoolId, async (tx) => {
    const [a] = await tx.select().from(assets).where(eq(assets.id, t.refId));
    if (!a) return null;
    const parts = await loadRegisterParts(tx, t.schoolId);
    return { name: a.name, status: a.status, reg: registerCode(parts, a), school: parts.schoolName, pemda: parts.pemdaName };
  });
  if (!info) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-16">
      <p className="text-sm text-slate-500">{info.pemda ?? "Barang Milik Daerah"}</p>
      <h1 className="text-2xl font-semibold">{info.name}</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>{info.school}</p>
        <p className="mt-2 font-mono text-xs">{info.reg.top}<br /><strong>{info.reg.bottom}</strong></p>
        {info.status === "DIHAPUS" && <p className="mt-2 text-red-700">Barang ini sudah dihapus dari daftar barang.</p>}
      </div>
      <p className="text-sm text-slate-600">
        Barang Milik Daerah, tercatat di Inventaris. Petugas sekolah: <Link href={`/login?next=/q/${token}`} className="text-teal-700 hover:underline">masuk</Link> untuk melihat detail.
      </p>
    </main>
  );
}
