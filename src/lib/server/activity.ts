import "server-only";
import type { Tx } from "@/db";
import { activityLogs } from "@/db/schema";
import type { SchoolSession } from "@/lib/tenant";
import { clientIp } from "@/lib/server/request";

export async function logActivity(
  tx: Tx,
  s: SchoolSession,
  action: string,
  entity: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
) {
  await tx.insert(activityLogs).values({
    schoolId: s.schoolId,
    userId: s.userId,
    userName: s.userName,
    action,
    entity,
    entityId,
    before: before ?? null,
    after: after ?? null,
    ip: await clientIp(),
  });
}

/** Kode error PostgreSQL (postgres.js, bisa dibungkus DrizzleQueryError) */
export function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}
