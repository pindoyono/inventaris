import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { notifications } from "@/db/schema";
import { AccessError, requireSchoolUser, withSchool } from "@/lib/tenant";

/** Tandai dibaca lalu buka tautannya (hanya tautan internal) */
export async function GET(_req: Request, ctx: RouteContext<"/notifikasi/buka/[id]">) {
  const id = Number((await ctx.params).id);
  let link = "/notifikasi";
  try {
    const s = await requireSchoolUser();
    if (Number.isSafeInteger(id)) {
      const [n] = await withSchool(s.schoolId, (tx) =>
        tx.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, s.userId))).returning({ link: notifications.link }),
      );
      if (n?.link?.startsWith("/") && !n.link.startsWith("//")) link = n.link;
    }
  } catch (e) {
    if (e instanceof AccessError) redirect("/login");
    throw e;
  }
  redirect(link);
}
