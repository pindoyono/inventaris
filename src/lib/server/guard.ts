import "server-only";
import { redirect } from "next/navigation";
import { AccessError, requirePlatformAdmin, requireSchoolUser } from "@/lib/tenant";
import type { Role } from "@/lib/roles";

/** Untuk halaman: ubah AccessError jadi redirect yang sesuai */
export async function pageSchoolUser(roles: Role[] = [], opts: { allowMustChange?: boolean } = {}) {
  let s;
  try {
    s = await requireSchoolUser(roles);
  } catch (e) {
    if (!(e instanceof AccessError)) throw e;
    if (e.reason === "FORBIDDEN") redirect("/dasbor?akses=ditolak");
    // Sesi lama (pengguna/sekolah dinonaktifkan) dibersihkan lewat /keluar
    redirect(e.reason === "SCHOOL_INACTIVE" ? "/keluar?alasan=nonaktif" : "/keluar");
  }
  if (s.mustChangePassword && !opts.allowMustChange) redirect("/akun/password");
  return s;
}

export async function pagePlatformAdmin() {
  try {
    return await requirePlatformAdmin();
  } catch (e) {
    if (e instanceof AccessError) redirect("/platform/login");
    throw e;
  }
}
