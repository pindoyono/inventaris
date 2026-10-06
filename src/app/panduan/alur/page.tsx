import type { Metadata } from "next";
import Link from "next/link";
import { FLOWS } from "../flows";
import { FlowBlock } from "../ui";

export const metadata: Metadata = { title: "Flowchart alur penggunaan" };

export default function AlurPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Flowchart alur penggunaan</h1>
        <p className="mt-1 leading-relaxed text-slate-600">
          Kotak <span className="rounded border border-teal-700 bg-teal-100 px-1 text-teal-900">hijau toska</span> bisa diklik untuk membuka halaman aplikasi terkait (perlu masuk lebih dulu).
          Belah ketupat = keputusan/pilihan; garis putus-putus = jalur balik (dikembalikan, dibatalkan, dilanjutkan lagi).
          Di HP, geser diagram ke samping bila lebar.
        </p>
      </div>
      <nav aria-label="Daftar flowchart" className="flex flex-wrap gap-2 text-sm">
        {FLOWS.map((f, i) => (
          <a key={f.id} href={`#alur-${f.id}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 hover:border-teal-600">{i + 1}. {f.title}</a>
        ))}
      </nav>
      {FLOWS.map((f) => (
        <div key={f.id} className="border-t border-slate-200 pt-4">
          <FlowBlock id={f.id} />
          <p className="mt-2 text-sm"><Link href={`/panduan/${f.topic}`} className="text-teal-700 underline">Baca penjelasan lengkap →</Link> · <a href="#" className="text-slate-500 hover:underline">ke atas ↑</a></p>
        </div>
      ))}
    </div>
  );
}
