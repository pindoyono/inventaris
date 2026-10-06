"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { ROLE_BMD, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { saveUser } from "./actions";

export type UserRow = {
  id: string;
  name: string;
  username: string;
  nip: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  roles: string[];
  unitIds: string[];
  warehouseIds: string[];
};
type Opt = { id: string; name: string };

const ROLE_DESC: Record<Role, string> = {
  ADMIN: "Mengatur sekolah, data dasar, dan pengguna",
  KEPSEK: "Menyetujui permintaan & menandatangani dokumen",
  VERIFIKATOR: "Memeriksa permintaan sebelum ke kepala sekolah",
  PETUGAS: "Mencatat penerimaan, pengeluaran, aset, opname",
  PENGUSUL: "Mengajukan permintaan barang untuk unitnya",
  PEMINJAM: "Mengajukan peminjaman barang",
};

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export function UserManager(props: {
  rows: UserRow[];
  units: Opt[];
  warehouses: Opt[];
  unitLabel: string;
  studentAccounts: boolean;
  editing: UserRow | null;
  selfId: string;
}) {
  const { rows, editing } = props;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Nama</th>
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Peran</th>
              <th className="px-3 py-2 font-medium">Terakhir masuk</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => (
              <tr key={u.id} className={`${editing?.id === u.id ? "bg-teal-50" : ""} ${u.isActive ? "" : "text-slate-400"}`}>
                <td className="px-3 py-2">
                  {u.name}
                  {!u.isActive && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs">nonaktif</span>}
                  {u.locked && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-700">terkunci</span>}
                  {u.mustChangePassword && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">ganti password</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                <td className="px-3 py-2">{u.roles.map((r) => ROLE_LABEL[r as Role] ?? r).join(", ")}</td>
                <td className="px-3 py-2 text-slate-500">{u.lastLoginAt ? fmt.format(new Date(u.lastLoginAt)) : "—"}</td>
                <td className="px-3 py-2"><Link href={`?ubah=${u.id}`} className="text-teal-700 hover:underline">Ubah</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserForm key={editing?.id ?? "baru"} {...props} />
    </div>
  );
}

function UserForm({ editing, units, warehouses, unitLabel, studentAccounts, selfId }: Parameters<typeof UserManager>[0]) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveUser, {});
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};
  useEffect(() => {
    if (state.ok && !editing) formRef.current?.reset();
  }, [state, editing]);
  // Isian dikembalikan server saat gagal (React mengosongkan form setelah action)
  const sv = state.values;
  const cur = sv
    ? {
        name: sv.name, username: sv.username, nip: sv.nip, email: sv.email, isActive: sv.isActive === "on",
        roles: sv.roles ? sv.roles.split(",") : [], unitIds: sv.unitIds ? sv.unitIds.split(",") : [], warehouseIds: sv.warehouseIds ? sv.warehouseIds.split(",") : [],
      }
    : editing;

  return (
    <Card title={editing ? "Ubah pengguna" : "Tambah pengguna"} actions={editing && <Link href="?" className="text-sm text-slate-600 hover:underline">Batal</Link>}>
      <form ref={formRef} action={action} className="space-y-4">
        <FormMessage state={state} />
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <Field label="Nama lengkap" error={e.name}><Input name="name" defaultValue={cur?.name} required invalid={!!e.name} /></Field>
        <Field label="Username" error={e.username}><Input name="username" defaultValue={cur?.username} autoComplete="off" required invalid={!!e.username} /></Field>
        <Field label="NIP (opsional)" error={e.nip}><Input name="nip" defaultValue={cur?.nip ?? ""} inputMode="numeric" invalid={!!e.nip} /></Field>
        <Field label="Email (opsional)" error={e.email} hint="Untuk notifikasi"><Input name="email" type="email" defaultValue={cur?.email ?? ""} invalid={!!e.email} /></Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Peran</legend>
          {ROLES.map((r) => (
            <label key={r} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="roles" value={r} defaultChecked={cur?.roles.includes(r)} className="mt-0.5 size-4 accent-teal-700" />
              <span>
                {ROLE_LABEL[r]}
                {ROLE_BMD[r] && <span className="text-slate-500"> ({ROLE_BMD[r]})</span>}
                <span className="block text-xs text-slate-500">
                  {ROLE_DESC[r]}
                  {r === "PEMINJAM" && !studentAccounts ? ". Akun siswa belum diaktifkan di Alur Kerja; peran ini tetap bisa untuk guru/staf." : ""}
                </span>
              </span>
            </label>
          ))}
          {e.roles && <p className="text-xs text-red-600">{e.roles}</p>}
        </fieldset>

        {units.length > 0 && (
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-slate-700">{unitLabel} (lingkup Pengusul)</legend>
            {units.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="unitIds" value={u.id} defaultChecked={cur?.unitIds.includes(u.id)} className="size-4 accent-teal-700" />
                {u.name}
              </label>
            ))}
          </fieldset>
        )}
        {warehouses.length > 1 && (
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-slate-700">Gudang (lingkup Petugas; kosong = semua)</legend>
            {warehouses.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="warehouseIds" value={w.id} defaultChecked={cur?.warehouseIds.includes(w.id)} className="size-4 accent-teal-700" />
                {w.name}
              </label>
            ))}
          </fieldset>
        )}

        <Field
          label={editing ? "Reset password (opsional)" : "Password awal"}
          error={e.password}
          hint={editing ? "Isi hanya bila ingin mereset; pengguna wajib menggantinya saat masuk" : "Minimal 8 karakter; wajib diganti saat pertama masuk"}
        >
          <Input name="password" type="password" autoComplete="new-password" invalid={!!e.password} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={cur ? cur.isActive : true} disabled={editing?.id === selfId} className="size-4 accent-teal-700" />
          Aktif
          {editing?.id === selfId && <input type="hidden" name="isActive" value="on" />}
        </label>
        <Button disabled={pending} className="w-full">{pending ? "Menyimpan…" : "Simpan"}</Button>
      </form>
    </Card>
  );
}
