"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Card, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { completeSetup, saveBmdSettings, saveProfile, saveWorkflow } from "./actions";

export function CompleteButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState>(completeSetup, {});
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Button disabled={disabled || pending}>Tandai penyiapan selesai</Button>
      {disabled && <p className="text-xs text-slate-500">Lengkapi langkah wajib terlebih dahulu.</p>}
    </form>
  );
}

type Profile = Record<string, string | null>;

export function ProfileForm({ p }: { p: Profile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const e = state.errors ?? {};
  const t = (k: string) => ({ name: k, defaultValue: state.values?.[k] ?? p[k] ?? "", invalid: !!e[k] });
  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      <Card title="Identitas sekolah">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nama sekolah" error={e.name}><Input {...t("name")} required /></Field></div>
          <Field label="Nama singkat" error={e.shortName}><Input {...t("shortName")} required /></Field>
          <div />
          <div className="sm:col-span-2">
            <Field label="Alamat singkat" error={e.address}><Input {...t("address")} /></Field>
          </div>
        </div>
      </Card>
      <Card title="Kop dokumen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Pemerintah Daerah" error={e.pemdaName} hint="Baris pertama kop, mis. Pemerintah Provinsi Kalimantan Utara">
            <Input {...t("pemdaName")} />
          </Field>
          <Field label="Nama dinas" error={e.dinasName} hint="Baris kedua kop, mis. Dinas Pendidikan dan Kebudayaan">
            <Input {...t("dinasName")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat lengkap untuk kop" error={e.addressFull} hint="Jalan, kelurahan/desa, kecamatan, kode pos, telepon, email">
              <Textarea {...t("addressFull")} rows={2} />
            </Field>
          </div>
          <LogoField label="Logo Pemda" name="logoPemda" current={p.logoPemdaFile} error={e.logoPemda} />
          <LogoField label="Logo sekolah" name="logoSchool" current={p.logoSchoolFile} error={e.logoSchool} />
        </div>
      </Card>
      <Card title="Penandatangan dokumen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kepala sekolah (Kuasa Pengguna Barang)" error={e.kepsekName}><Input {...t("kepsekName")} /></Field>
          <Field label="NIP kepala sekolah" error={e.kepsekNip}><Input {...t("kepsekNip")} inputMode="numeric" /></Field>
          <Field label="Pengurus Barang Pembantu" error={e.pengurusName}><Input {...t("pengurusName")} /></Field>
          <Field label="NIP pengurus barang" error={e.pengurusNip}><Input {...t("pengurusNip")} inputMode="numeric" /></Field>
          <Field label="Pengguna Barang (Kepala Dinas) — opsional" error={e.penggunaName} hint="Untuk dokumen yang memerlukan tanda tangan Pengguna Barang">
            <Input {...t("penggunaName")} />
          </Field>
          <Field label="NIP Pengguna Barang" error={e.penggunaNip}><Input {...t("penggunaNip")} inputMode="numeric" /></Field>
        </div>
      </Card>
      <Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
    </form>
  );
}

function LogoField({ label, name, current, error }: { label: string; name: string; current: string | null; error?: string }) {
  return (
    <Field label={label} error={error} hint="PNG/JPG/WEBP, maks. 1 MB">
      <div className="flex items-center gap-3">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/berkas/${current}`} alt="" className="size-12 rounded border border-slate-200 object-contain" />
        ) : (
          <span className="flex size-12 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400">—</span>
        )}
        <input type="file" name={name} accept="image/png,image/jpeg,image/webp" className="text-sm" />
      </div>
    </Field>
  );
}

const GOLONGAN_LABEL: Record<string, string> = {
  B: "B — Peralatan dan mesin",
  C: "C — Gedung dan bangunan",
  D: "D — Jalan, irigasi, jaringan",
  E: "E — Aset tetap lainnya",
  F: "F — Konstruksi dalam pengerjaan",
  ATB: "Aset tak berwujud",
};

export type BmdFormValues = {
  kodeProvinsi: string; kodeKab: string; kodeBidang: string; kodeUnit: string; kodeSubUnit: string; kodeUpb: string;
  labelQr: boolean; labelLogo: boolean; capDefault: string; caps: Record<string, string>;
  ownershipCode: string; provinceCode: string; regencyCode: string; schoolName: string;
  funds: { name: string; upb: string | null }[];
};

export function BmdForm({ v }: { v: BmdFormValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBmdSettings, {});
  const e = state.errors ?? {};
  const val = (k: string, d: string) => state.values?.[k] ?? d;
  const [f, setF] = useState({ prov: v.kodeProvinsi, kab: v.kodeKab, bid: v.kodeBidang, unit: v.kodeUnit, sub: v.kodeSubUnit, upb: v.kodeUpb || "01" });
  const on = (k: keyof typeof f) => (ev: { target: { value: string } }) => setF((o) => ({ ...o, [k]: ev.target.value.replace(/\D/g, "") }));
  const pad = (x: string, n: number, fb: string) => (x ? x.padStart(n, "0") : fb);
  const kab = f.kab ? f.kab.padStart(2, "0") : v.ownershipCode === "11" ? "00" : v.regencyCode.split(".")[1];
  const preview = [v.ownershipCode, "01", pad(f.prov, 2, v.provinceCode), kab, pad(f.bid, 2, "??"), pad(f.unit, 2, "??"), pad(f.sub, 3, "???"), pad(f.upb, 2, "01"), "2026"].join(".");
  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      <Card title="Kode lokasi (sama dengan label SIMDA BMD Dinas)">
        <p className="mb-4 text-sm text-slate-600">
          Salin dari label aset Dinas atau aplikasi SIMDA BMD (menu Laporan › Label Kode Barang). Contoh label Dinas:
          <span className="ml-1 font-mono">11.01.<b>34</b>.00.<b>08</b>.<b>01</b>.<b>058</b>.<b>02</b>.2026</span> = kepemilikan Pemprov · intrakomptabel ·
          <b> provinsi 34</b> · kab 00 · <b>bidang 08</b> · <b>unit 01</b> · <b>sub unit 058</b> · <b>UPB 02</b> · tahun perolehan.
          Selama bidang/unit/sub unit kosong, kode register dicetak dengan tanda <strong>SEMENTARA</strong>.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kode provinsi (SIMDA)" error={e.kodeProvinsi} hint={`Kalimantan Utara di SIMDA: 34 (bukan kode wilayah ${v.provinceCode})`}>
            <Input name="kodeProvinsi" value={f.prov} onChange={on("prov")} maxLength={2} inputMode="numeric" placeholder={v.provinceCode} invalid={!!e.kodeProvinsi} />
          </Field>
          <Field label="Kode kab/kota" error={e.kodeKab} hint={v.ownershipCode === "11" ? "Aset provinsi: kosongkan (00)" : "Kosong = dari data wilayah"}>
            <Input name="kodeKab" value={f.kab} onChange={on("kab")} maxLength={2} inputMode="numeric" placeholder={kab} invalid={!!e.kodeKab} />
          </Field>
          <div />
          <Field label="Bidang" error={e.kodeBidang} hint="mis. 08 Bidang Pendidikan dan Kebudayaan">
            <Input name="kodeBidang" value={f.bid} onChange={on("bid")} maxLength={2} inputMode="numeric" placeholder="08" invalid={!!e.kodeBidang} />
          </Field>
          <Field label="Unit / Perangkat Daerah" error={e.kodeUnit} hint="mis. 01 Dinas Pendidikan, Kebudayaan">
            <Input name="kodeUnit" value={f.unit} onChange={on("unit")} maxLength={2} inputMode="numeric" placeholder="01" invalid={!!e.kodeUnit} />
          </Field>
          <Field label="Sub Unit (sekolah)" error={e.kodeSubUnit} hint={`mis. 058 ${v.schoolName}`}>
            <Input name="kodeSubUnit" value={f.sub} onChange={on("sub")} maxLength={3} inputMode="numeric" placeholder="058" invalid={!!e.kodeSubUnit} />
          </Field>
        </div>
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm">
          Pratinjau kode lokasi (barang tahun 2026, UPB bawaan): <span className="font-mono font-semibold">{preview}</span>
        </div>
      </Card>

      <Card title="UPB (Unit Pengelola Barang) per sumber dana">
        <p className="mb-3 text-sm text-slate-600">
          Di SIMDA, satu sekolah punya beberapa UPB menurut <b>sumber dana</b> barangnya, mis. 1 Umum · 2 Bosnas · 3 Bosprov · 4 P3D · 5 Block Grant · 6 DAK.
          Kode UPB tiap sumber dana diatur di <Link href="/data-dasar/sumber-dana" className="font-medium text-teal-700 underline">Data Dasar › Sumber Dana</Link>.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="UPB bawaan" error={e.kodeUpb} hint="Untuk barang tanpa sumber dana atau sumber dana tanpa kode UPB">
            <Input name="kodeUpb" value={f.upb} onChange={on("upb")} maxLength={2} inputMode="numeric" placeholder="01" invalid={!!e.kodeUpb} />
          </Field>
          <div className="sm:col-span-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <b>Dana lain</b> — komite sekolah, hibah/sumbangan, swadaya, atau sumber dana apa pun yang <i>belum diberi kode UPB</i> — otomatis
            masuk <b>UPB bawaan ({pad(f.upb, 2, "01")})</b>, yaitu UPB umum “{v.schoolName}”. Barang tanpa sumber dana juga masuk ke sini.
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th className="py-1 font-medium">Sumber dana</th><th className="py-1 font-medium">UPB pada kode register</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {v.funds.length === 0 && <tr><td colSpan={2} className="py-2 text-slate-500">Belum ada sumber dana.</td></tr>}
            {v.funds.map((x) => (
              <tr key={x.name}><td className="py-1.5">{x.name}</td><td className="py-1.5 font-mono">{x.upb ?? <span className="font-sans text-slate-500">{pad(f.upb, 2, "01")} (bawaan — belum diberi kode)</span>}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Tampilan label kode register">
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="labelLogo" defaultChecked={state.values ? state.values.labelLogo === "on" : v.labelLogo} className="mt-0.5 size-4 accent-teal-700" />
            <span>Tampilkan <b>logo Pemda</b> di kiri label (seperti label Dinas). Logo diambil dari <Link href="/pengaturan/profil" className="text-teal-700 underline">Profil & kop</Link>.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="labelQr" defaultChecked={state.values ? state.values.labelQr === "on" : v.labelQr} className="mt-0.5 size-4 accent-teal-700" />
            <span>Tampilkan <b>QR code</b> di kanan label — dipindai dengan HP untuk membuka data barang (lokasi, kondisi, riwayat).</span>
          </label>
        </div>
      </Card>
      <Card title="Batas nilai kapitalisasi">
        <p className="mb-4 text-sm text-slate-600">
          Barang dengan harga satuan di bawah batas ini dicatat sebagai ekstrakomptabel (tetap tercatat di KIR, kode
          register 02). Sesuaikan dengan Peraturan Kepala Daerah tentang kebijakan akuntansi.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batas umum (Rp)" error={e.capDefault}>
            <Input name="capDefault" defaultValue={val("capDefault", v.capDefault)} inputMode="numeric" invalid={!!e.capDefault} />
          </Field>
          <div />
          {Object.entries(GOLONGAN_LABEL).map(([g, label]) => (
            <Field key={g} label={label} hint="Kosong = ikut batas umum">
              <Input name={`cap_${g}`} defaultValue={val(`cap_${g}`, v.caps[g] ?? "")} inputMode="numeric" />
            </Field>
          ))}
        </div>
      </Card>
      <Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
    </form>
  );
}

export function WorkflowForm({ v: initial }: { v: { approvalLevels: number; studentAccounts: boolean; distributionMode: string; loanDefaultDays: number; unitLabel: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWorkflow, {});
  const e = state.errors ?? {};
  const sv = state.values;
  const v = sv
    ? { approvalLevels: Number(sv.approvalLevels), studentAccounts: sv.studentAccounts === "on", distributionMode: sv.distributionMode, loanDefaultDays: Number(sv.loanDefaultDays) || 1, unitLabel: sv.unitLabel ?? "" }
    : initial;
  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      <Card>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tingkat persetujuan permintaan" error={e.approvalLevels} hint="Berlaku pada mode Lengkap. 2 tingkat: Verifikator lalu Kepala Sekolah">
            <Select name="approvalLevels" defaultValue={String(v.approvalLevels)}>
              <option value="1">1 tingkat (Kepala Sekolah)</option>
              <option value="2">2 tingkat (Verifikator → Kepala Sekolah)</option>
            </Select>
          </Field>
          <Field label="Dokumen pengeluaran persediaan" error={e.distributionMode} hint="Permendagri 47/2021: nota permintaan → surat permintaan → SPPB → BAST">
            <Select name="distributionMode" defaultValue={v.distributionMode}>
              <option value="RINGKAS">Ringkas: nota permintaan → Petugas menyetujui & menyalurkan (BAST)</option>
              <option value="LENGKAP">Lengkap: nota → surat permintaan → SPPB Kepala Sekolah → BAST</option>
            </Select>
          </Field>
          <Field label="Lama pinjam bawaan (hari)" error={e.loanDefaultDays}>
            <Input name="loanDefaultDays" type="number" min={1} max={60} defaultValue={v.loanDefaultDays} />
          </Field>
          <Field label="Sebutan unit" error={e.unitLabel} hint="Mis. Unit, Jurusan, Program Keahlian, Bidang">
            <Input name="unitLabel" defaultValue={v.unitLabel} />
          </Field>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input type="checkbox" name="studentAccounts" defaultChecked={v.studentAccounts} className="mt-1 size-4 accent-teal-700" />
            <span>
              <span className="font-medium">Aktifkan akun siswa</span>
              <span className="block text-slate-600">Siswa bisa masuk dan mengajukan peminjaman sendiri (peran Peminjam).</span>
            </span>
          </label>
        </div>
      </Card>
      <Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
    </form>
  );
}
