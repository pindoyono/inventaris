import "server-only";
import { count, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { rooms, schoolSettings, units, userRoles, users, warehouses } from "@/db/schema";

export type SetupStep = { key: string; title: string; href: string; done: boolean; required: boolean; note: string };

/** Status langkah penyiapan sekolah (harus dipanggil dalam withSchool) */
export async function setupStatus(tx: Tx) {
  const [st] = await tx.select().from(schoolSettings);
  const [[r], [u], [w], [kepsekRole], [n]] = await Promise.all([
    tx.select({ n: count() }).from(rooms),
    tx.select({ n: count() }).from(units),
    tx.select({ n: count() }).from(warehouses),
    tx.select({ n: count() }).from(userRoles).where(eq(userRoles.role, "KEPSEK")),
    tx.select({ n: count() }).from(users),
  ]);
  const steps: SetupStep[] = [
    {
      key: "profil",
      title: "Profil & kop dokumen",
      href: "/pengaturan/profil",
      done: !!(st.kepsekName && st.pengurusName && st.addressFull),
      required: true,
      note: "Alamat lengkap, kepala sekolah (Kuasa Pengguna Barang), dan pengurus barang untuk tanda tangan dokumen.",
    },
    {
      key: "bmd",
      title: "Kode lokasi SIMDA, label & kapitalisasi",
      href: "/pengaturan/kode-bmd",
      done: !!(st.kodeBidang && st.kodeUnit && st.kodeSubUnit),
      required: false,
      note: st.kodeBidang && st.kodeUnit && st.kodeSubUnit
        ? `Kode lokasi ${st.kodeProvinsi ?? "?"}.${st.kodeKab ?? "00"}.${st.kodeBidang}.${st.kodeUnit}.${st.kodeSubUnit} · UPB bawaan ${st.kodeUpb}`
        : "Boleh menyusul; selama kosong, kode register dicetak dengan tanda SEMENTARA.",
    },
    {
      key: "struktur",
      title: "Unit, ruangan & gudang",
      href: "/data-dasar",
      done: r.n > 0 && u.n > 0 && w.n > 0,
      required: true,
      note: `${u.n} unit, ${r.n} ruangan, ${w.n} gudang. Minimal satu unit dan satu ruangan.`,
    },
    {
      key: "alur",
      title: "Alur kerja",
      href: "/pengaturan/alur-kerja",
      done: true,
      required: false,
      note: `Persetujuan ${st.approvalLevels} tingkat, distribusi ${st.distributionMode.toLowerCase()}, akun siswa ${st.studentAccounts ? "aktif" : "tidak aktif"}.`,
    },
    {
      key: "pengguna",
      title: "Pengguna & peran",
      href: "/pengguna",
      done: kepsekRole.n > 0,
      required: false,
      note: `${n.n} pengguna. Disarankan membuat akun Kepala Sekolah dan Petugas Barang.`,
    },
  ];
  return { settings: st, steps };
}
