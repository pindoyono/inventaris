import type { ReactNode } from "react";
import { registerCode, type RegisterParts } from "@/lib/assets-shared";
import { PrintButton } from "./print-button";

/** Kode lokasi (baris atas kode register tanpa intra/ekstra & tahun) */
export function kodeLokasi(p: RegisterParts) {
  const top = registerCode(p, { isIntra: true, acqDate: "0000", bmdCode: "", regNo: 0 }).top.split(".");
  return { text: [top[0], top[1], top[2], top[3], top[4], top[5], top[6]].join("."), provisional: !p.kodePengguna || !p.kodeKuasaPengguna };
}

export function ReportHeader({ parts, title, subtitle, children, csv, print }: {
  parts: RegisterParts & { schoolName: string; pemdaName: string | null };
  title: string; subtitle?: string; children?: ReactNode; csv?: string; print?: string;
}) {
  const kl = kodeLokasi(parts);
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 uppercase">{parts.pemdaName ?? "Pemerintah Daerah"} · {parts.schoolName}</p>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
          <p className="text-sm text-slate-600">
            Kode lokasi: <span className="font-mono">{kl.text}</span>
            {kl.provisional && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-700 print:hidden">SEMENTARA — isi kode di Penyiapan</span>}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {csv && <a href={`${csv}${csv.includes("?") ? "&" : "?"}format=xlsx`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Unduh Excel</a>}
          {csv && <a href={csv} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">CSV</a>}
          {print ? <a href={print} target="_blank" rel="noreferrer" className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">Cetak</a> : <PrintButton />}
        </div>
      </div>
      {children && <div className="print:hidden">{children}</div>}
    </div>
  );
}

export const th = "border border-slate-300 px-2 py-1 font-medium";
export const td = "border border-slate-300 px-2 py-1";
