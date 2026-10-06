"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, FormMessage } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { disposalAction } from "../../actions";

export function DisposalActions({ id, status, petugas, kepsek, today, lines }: { id: string; status: string; petugas: boolean; kepsek: boolean; today: string; lines: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(disposalAction.bind(null, id), {});
  const box = "space-y-2 rounded-lg border border-teal-600 bg-white p-4 text-sm";
  const input = "rounded-md border border-slate-300 px-2 py-1.5";
  const confirmSubmit = (msg: string) => (e: React.FormEvent) => { if (!confirm(msg)) e.preventDefault(); };
  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      {status === "DRAF" && (petugas || kepsek) && (
        <form action={action} className={box} onSubmit={confirmSubmit("Lanjutkan?")}>
          {petugas && <Link href="?ubah=1" className="block text-teal-700 hover:underline">Ubah draf</Link>}
          {kepsek ? <p>Ajukan usulan ini sebagai Kuasa Pengguna Barang. Status barang menjadi “diusulkan hapus”.</p> : <p>Menunggu Kepala Sekolah mengajukan usulan.</p>}
          <div className="flex gap-2">
            {kepsek && <Button name="action" value="AJUKAN" disabled={pending}>Ajukan usulan</Button>}
            {petugas && <Button name="action" value="BATAL" variant="secondary" disabled={pending}>Batalkan draf</Button>}
          </div>
        </form>
      )}
      {status === "DIAJUKAN" && (petugas || kepsek) && (
        <form action={action} className={box} onSubmit={confirmSubmit("Catat surat usulan sudah dikirim?")}>
          <p className="font-medium">Catat pengiriman surat usulan ke Dinas/BPKAD</p>
          <div className="flex flex-wrap gap-2">
            <input name="letterNumber" placeholder="Nomor surat" className={input} required />
            <input name="letterDate" type="date" max={today} className={input} required />
            <Button name="action" value="KIRIM" disabled={pending}>Simpan</Button>
          </div>
        </form>
      )}
      {status === "DIKIRIM" && (petugas || kepsek) && (
        <form action={action} className={box} onSubmit={confirmSubmit("Catat SK? Barang yang dicentang akan dihapus dari daftar barang.")}>
          <p className="font-medium">Catat SK penghapusan kepala daerah</p>
          <div className="flex flex-wrap gap-2">
            <input name="skNumber" placeholder="Nomor SK" className={input} />
            <input name="skDate" type="date" max={today} className={input} />
            <input name="skFile" type="file" accept="application/pdf,image/png,image/jpeg" className="text-sm" />
          </div>
          <p className="text-slate-600">Barang yang disetujui dalam SK (yang tidak dicentang dipulihkan):</p>
          {lines.map((l) => (
            <label key={l.id} className="flex items-center gap-2"><input type="checkbox" name="approved" value={l.id} defaultChecked className="size-4 accent-teal-700" />{l.label}</label>
          ))}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-2">
            <Button name="action" value="SK" disabled={pending}>Catat SK</Button>
            <input name="reason" placeholder="Keterangan bila usulan ditolak" className={`${input} min-w-48 flex-1`} />
            <Button name="action" value="TOLAK" variant="danger" disabled={pending}>Usulan ditolak</Button>
          </div>
        </form>
      )}
    </div>
  );
}
