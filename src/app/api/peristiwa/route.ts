import { AccessError, requireSchoolUser } from "@/lib/tenant";
import { subscribe, type LiveEvent } from "@/lib/server/realtime";

export const dynamic = "force-dynamic";

/** Server-Sent Events: sinyal perubahan untuk lonceng & dasbor (isi data tetap diambil lewat halaman) */
export async function GET(req: Request) {
  let s;
  try { s = await requireSchoolUser(); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 401 }); throw e; }
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    async start(ctrl) {
      const write = (t: string) => { try { ctrl.enqueue(enc.encode(t)); } catch { cleanup(); } };
      write("retry: 10000\n\n");
      const unsub = await subscribe({ schoolId: s.schoolId, userId: s.userId, send: (e: LiveEvent) => write(`event: ${e.k}\ndata: {}\n\n`) });
      const ping = setInterval(() => write(": ping\n\n"), 25_000);
      cleanup = () => { clearInterval(ping); unsub(); };
      req.signal.addEventListener("abort", () => { cleanup(); try { ctrl.close(); } catch {} });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
