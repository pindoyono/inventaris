import { signOut } from "@/auth";

/** Keluar paksa (mis. sekolah dinonaktifkan saat sesi masih berlaku) */
export async function GET(req: Request) {
  const alasan = new URL(req.url).searchParams.get("alasan");
  await signOut({ redirectTo: alasan === "nonaktif" ? "/login?pesan=nonaktif" : "/login" });
}
