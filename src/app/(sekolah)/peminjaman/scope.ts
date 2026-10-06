import "server-only";
import { eq, or, type SQL } from "drizzle-orm";
import { loans } from "@/db/schema";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

/** Peminjam (tanpa peran pengelola) hanya melihat peminjamannya sendiri */
export function loanScope(s: SchoolSession): SQL | undefined {
  if (hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"])) return undefined;
  return or(eq(loans.borrowerUserId, s.userId), eq(loans.createdBy, s.userId));
}
