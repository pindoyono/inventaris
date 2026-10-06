/** Pratinjau label register (format 10 masih menunggu persetujuan; versi cetak menyusul) */
export function RegisterLabel({ pemda, school, top, bottom, name, provisional, qr }: {
  pemda: string | null; school: string; top: string; bottom: string; name: string; provisional: boolean; qr: string;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded border-2 border-slate-800 bg-white p-2 text-slate-900">
      <div className="size-20 shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="min-w-0 font-mono text-[11px] leading-tight">
        <div className="font-sans text-[10px] font-semibold uppercase">{pemda ?? "Pemerintah Daerah"}</div>
        <div className="font-sans text-[10px]">{school}</div>
        <div className="mt-1 break-all">{top}</div>
        <div className="break-all font-semibold">{bottom}</div>
        <div className="mt-0.5 truncate font-sans text-[10px]">{name}</div>
        {provisional && <div className="font-sans text-[10px] font-bold text-red-700">SEMENTARA — kode pengguna/kuasa belum diisi</div>}
      </div>
    </div>
  );
}
