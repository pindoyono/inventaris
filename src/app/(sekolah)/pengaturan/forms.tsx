"use client";

import { useActionState } from "react";
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

export function BmdForm({ v }: { v: { kodePengguna: string; kodeKuasaPengguna: string; kodeSubKuasa: string; capDefault: string; caps: Record<string, string> } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBmdSettings, {});
  const e = state.errors ?? {};
  const val = (k: string, d: string) => state.values?.[k] ?? d;
  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      <Card title="Kode lokasi (kode register BMD)">
        <p className="mb-4 text-sm text-slate-600">
          Ditetapkan Pemda (BPKAD/Dinas). Dapat dilihat pada label aset lama, KIB/KIR terdahulu, atau ditanyakan ke
          pengurus barang Dinas Pendidikan. Selama kosong, kode register dicetak dengan tanda <strong>SEMENTARA</strong>.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kode pengguna barang" error={e.kodePengguna} hint="6 digit (Dinas)">
            <Input name="kodePengguna" defaultValue={val("kodePengguna", v.kodePengguna)} maxLength={6} inputMode="numeric" invalid={!!e.kodePengguna} />
          </Field>
          <Field label="Kode kuasa pengguna" error={e.kodeKuasaPengguna} hint="5 digit (sekolah)">
            <Input name="kodeKuasaPengguna" defaultValue={val("kodeKuasaPengguna", v.kodeKuasaPengguna)} maxLength={5} inputMode="numeric" invalid={!!e.kodeKuasaPengguna} />
          </Field>
          <Field label="Kode sub kuasa pengguna" error={e.kodeSubKuasa} hint="00000 bila tidak ada">
            <Input name="kodeSubKuasa" defaultValue={val("kodeSubKuasa", v.kodeSubKuasa)} maxLength={5} inputMode="numeric" invalid={!!e.kodeSubKuasa} />
          </Field>
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
          <Field label="Tingkat persetujuan permintaan" error={e.approvalLevels} hint="2 tingkat: Verifikator lalu Kepala Sekolah">
            <Select name="approvalLevels" defaultValue={String(v.approvalLevels)}>
              <option value="1">1 tingkat (Kepala Sekolah)</option>
              <option value="2">2 tingkat (Verifikator → Kepala Sekolah)</option>
            </Select>
          </Field>
          <Field label="Dokumen pengeluaran persediaan" error={e.distributionMode} hint="Permendagri 47/2021: nota permintaan → surat permintaan → SPPB → BAST">
            <Select name="distributionMode" defaultValue={v.distributionMode}>
              <option value="RINGKAS">Ringkas (permintaan → SPPB/BAST sekaligus)</option>
              <option value="LENGKAP">Lengkap (semua dokumen terpisah)</option>
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
