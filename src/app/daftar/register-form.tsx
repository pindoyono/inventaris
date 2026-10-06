"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { LEVEL_LABEL, SCHOOL_LEVELS } from "@/lib/validations";
import { registerAction, type RegisterState } from "./actions";

type Region = { code: string; name: string };

export function RegisterForm({ provinces, regencies }: { provinces: Region[]; regencies: Region[] }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const [province, setProvince] = useState(v.provinceCode ?? "");
  const regencyOptions = regencies.filter((r) => r.code.startsWith(province + "."));

  return (
    <form action={action} className="space-y-6" noValidate>
      {e._form && <Alert>{e._form}</Alert>}

      <Card title="Data sekolah">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NPSN" error={e.npsn} hint="8 karakter, sesuai Dapodik">
            <Input name="npsn" defaultValue={v.npsn} maxLength={8} inputMode="numeric" autoComplete="off" required invalid={!!e.npsn} />
          </Field>
          <Field label="Jenjang" error={e.level}>
            <Select name="level" defaultValue={v.level ?? ""} required invalid={!!e.level}>
              <option value="" disabled>Pilih jenjang…</option>
              {SCHOOL_LEVELS.map((l) => (
                <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nama sekolah" error={e.name} hint="Nama lengkap resmi, mis. SMK Negeri 2 Malinau">
              <Input name="name" defaultValue={v.name} required invalid={!!e.name} />
            </Field>
          </div>
          <Field label="Nama singkat" error={e.shortName} hint="Untuk tampilan, mis. SMKN 2 Malinau">
            <Input name="shortName" defaultValue={v.shortName} required invalid={!!e.shortName} />
          </Field>
          <div />
          <Field label="Provinsi" error={e.provinceCode}>
            <Select name="provinceCode" value={province} onChange={(ev) => setProvince(ev.target.value)} required invalid={!!e.provinceCode}>
              <option value="" disabled>Pilih provinsi…</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Kabupaten/kota" error={e.regencyCode}>
            <Select key={province} name="regencyCode" defaultValue={v.provinceCode === province ? v.regencyCode : ""} required disabled={!province} invalid={!!e.regencyCode}>
              <option value="" disabled>Pilih kabupaten/kota…</option>
              {regencyOptions.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat (opsional)" error={e.address}>
              <Textarea name="address" rows={2} defaultValue={v.address} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Penanggung jawab pendaftaran">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama" error={e.contactName}>
            <Input name="contactName" defaultValue={v.contactName} required invalid={!!e.contactName} />
          </Field>
          <Field label="Nomor HP/WA" error={e.contactPhone} hint="Untuk konfirmasi oleh pengelola platform">
            <Input name="contactPhone" type="tel" defaultValue={v.contactPhone} required invalid={!!e.contactPhone} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email (opsional)" error={e.contactEmail} hint="Pemberitahuan persetujuan dikirim ke sini">
              <Input name="contactEmail" type="email" defaultValue={v.contactEmail} invalid={!!e.contactEmail} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Akun admin sekolah">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama admin" error={e.adminName}>
            <Input name="adminName" defaultValue={v.adminName} required invalid={!!e.adminName} />
          </Field>
          <Field label="Username" error={e.adminUsername} hint="Masuk dengan NPSN + username ini">
            <Input name="adminUsername" defaultValue={v.adminUsername} autoComplete="username" required invalid={!!e.adminUsername} />
          </Field>
          <Field label="Password" error={e.adminPassword} hint="Minimal 8 karakter">
            <Input name="adminPassword" type="password" autoComplete="new-password" required invalid={!!e.adminPassword} />
          </Field>
          <Field label="Ulangi password" error={e.adminPasswordConfirm}>
            <Input name="adminPasswordConfirm" type="password" autoComplete="new-password" required invalid={!!e.adminPasswordConfirm} />
          </Field>
        </div>
      </Card>

      {/* Honeypot: disembunyikan dari manusia */}
      <div aria-hidden className="absolute -left-[9999px]">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="declaration" className="mt-1 size-4 accent-teal-700" defaultChecked={v.declaration === "on"} />
          <span>
            Saya menyatakan sekolah ini adalah <strong>sekolah negeri milik Pemerintah Daerah</strong>, dan saya berwenang
            mendaftarkannya.
          </span>
        </label>
        {e.declaration && <p className="text-xs text-red-600">{e.declaration}</p>}
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Mengirim…" : "Kirim pendaftaran"}
      </Button>
    </form>
  );
}
