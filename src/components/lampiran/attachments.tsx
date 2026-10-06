import { withSchool } from "@/lib/tenant";
import { listAttachments, type AttachEntity } from "@/lib/server/attachments";
import { UploadAttachment, DeleteAttachment } from "./upload";

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" });

/** Daftar lampiran + unggah (server component) */
export async function Attachments({ schoolId, entity, entityId, path, canEdit, title = "Lampiran" }: { schoolId: string; entity: AttachEntity; entityId: string; path: string; canEdit: boolean; title?: string }) {
  const list = await withSchool(schoolId, (tx) => listAttachments(tx, entity, entityId));
  return (
    <section className="space-y-2 print:hidden">
      <h2 className="font-semibold">{title}</h2>
      {list.length === 0 && <p className="text-sm text-slate-500">Belum ada lampiran.</p>}
      {list.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((a) => {
            const pdf = a.storedName.endsWith(".pdf");
            return (
              <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                <a href={`/berkas/${a.storedName}`} target="_blank" rel="noreferrer" className="block">
                  {pdf ? (
                    <span className="flex h-28 items-center justify-center rounded bg-slate-100 text-slate-600">PDF</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/berkas/${a.storedName}`} alt={a.caption ?? a.fileName} className="h-28 w-full rounded object-cover" loading="lazy" />
                  )}
                </a>
                <span className="mt-1 block truncate" title={a.fileName}>{a.caption ?? a.fileName}</span>
                <span className="flex justify-between text-slate-500">{fmt.format(a.createdAt)}{canEdit && <DeleteAttachment id={a.id} path={path} />}</span>
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && <UploadAttachment entity={entity} entityId={entityId} path={path} />}
    </section>
  );
}
