/** Pratinjau label register gaya SIMDA BMD (logo · kode lokasi · kode barang + register · footer, QR opsional) */
export function RegisterLabel({ footer, top, bottom, name, provisional, qr, logo, showQr, showLogo }: {
  footer: string; top: string; bottom: string; name: string; provisional: boolean; qr: string; logo: string | null; showQr: boolean; showLogo: boolean;
}) {
  return (
    <div className="max-w-full space-y-1">
      <div className="flex border-2 border-slate-900 bg-white text-slate-900">
        {showLogo && (
          <div className="flex w-14 shrink-0 items-center justify-center border-r-2 border-slate-900 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- berkas privat lewat route ber-otorisasi */}
            {logo ? <img src={`/berkas/${logo}`} alt="Logo Pemda" className="max-h-12 object-contain" /> : <span className="text-center text-[9px] text-slate-400">LOGO PEMDA</span>}
          </div>
        )}
        <div className="min-w-0 flex-1 text-center font-bold">
          <div className="border-b-2 border-slate-900 px-1 py-1.5 text-[11px] break-all">{top}</div>
          <div className="px-1 py-1.5 text-[11px] break-all">{bottom}</div>
          <div className="border-t-2 border-slate-900 px-1 py-0.5 text-[9px]">{footer}</div>
        </div>
        {showQr && <div className="flex w-20 shrink-0 items-center justify-center border-l-2 border-slate-900 p-1 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />}
      </div>
      <div className="truncate text-[11px] text-slate-600">{name}</div>
      {provisional && <div className="text-[11px] font-bold text-red-700">SEMENTARA — kode lokasi SIMDA belum diisi (Penyiapan)</div>}
    </div>
  );
}
