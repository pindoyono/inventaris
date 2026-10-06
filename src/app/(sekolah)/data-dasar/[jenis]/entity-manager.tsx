"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Button, Card, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import type { EntityDef, RefKey } from "../config";
import { deleteEntity, saveEntity } from "../actions";

type Row = Record<string, string | boolean | null>;
type Refs = Partial<Record<RefKey, { id: string; name: string }[]>>;

export function EntityManager({ slug, def, rows, refs, editing }: { slug: string; def: EntityDef; rows: Row[]; refs: Refs; editing: Row | null }) {
  const listFields = def.fields.filter((f) => f.list);
  const refName = (key: RefKey | undefined, id: unknown) => refs[key!]?.find((o) => o.id === id)?.name ?? "—";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {listFields.map((f) => (
                <th key={f.name} className="px-3 py-2 font-medium">{f.label}</th>
              ))}
              <th className="w-px px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={listFields.length + 1} className="px-3 py-6 text-center text-slate-500">Belum ada data.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={String(r.id)} className={editing?.id === r.id ? "bg-teal-50" : ""}>
                {listFields.map((f) => (
                  <td key={f.name} className="px-3 py-2">
                    {f.type === "checkbox" ? (r[f.name] ? "Ya" : "—") : f.type === "select" ? refName(f.ref, r[f.name]) : String(r[f.name] ?? "—")}
                  </td>
                ))}
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`?ubah=${r.id}`} className="text-teal-700 hover:underline">Ubah</Link>
                  <DeleteButton slug={slug} id={String(r.id)} label={String(r.name ?? r.code)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EntityForm key={String(editing?.id ?? "baru")} slug={slug} def={def} refs={refs} editing={editing} />
    </div>
  );
}

function EntityForm({ slug, def, refs, editing }: { slug: string; def: EntityDef; refs: Refs; editing: Row | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntity.bind(null, slug), {});
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};
  // Form tambah dikosongkan setelah berhasil
  useEffect(() => {
    if (state.ok && !editing) formRef.current?.reset();
  }, [state, editing]);
  const val = (name: string) => state.values?.[name] ?? (editing?.[name] as string | null) ?? "";
  const checked = (name: string) => (state.values ? state.values[name] === "on" : editing ? !!editing[name] : name === "isActive");

  return (
    <Card title={editing ? `Ubah ${def.singular}` : `Tambah ${def.singular}`} actions={editing && <Link href="?" className="text-sm text-slate-600 hover:underline">Batal</Link>}>
      <form ref={formRef} action={action} className="space-y-4">
        <FormMessage state={state} />
        {editing && <input type="hidden" name="id" value={String(editing.id)} />}
        {def.fields.map((f) => {
          if (f.type === "checkbox")
            return (
              <label key={f.name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={f.name} defaultChecked={checked(f.name)} className="size-4 accent-teal-700" />
                {f.label}
              </label>
            );
          return (
            <Field key={f.name} label={f.label + (f.required ? "" : " (opsional)")} error={e[f.name]} hint={f.hint}>
              {f.type === "select" ? (
                <Select name={f.name} defaultValue={val(f.name)} invalid={!!e[f.name]}>
                  <option value="">{f.required ? `Pilih ${f.label.toLowerCase()}…` : "—"}</option>
                  {refs[f.ref!]?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea name={f.name} rows={2} defaultValue={val(f.name)} maxLength={f.max} invalid={!!e[f.name]} />
              ) : (
                <>
                  <Input name={f.name} defaultValue={val(f.name)} maxLength={f.max} list={f.suggestions ? `${f.name}-saran` : undefined} invalid={!!e[f.name]} />
                  {f.suggestions && (
                    <datalist id={`${f.name}-saran`}>{f.suggestions.map((x) => <option key={x} value={x} />)}</datalist>
                  )}
                </>
              )}
            </Field>
          );
        })}
        <Button disabled={pending} className="w-full">{pending ? "Menyimpan…" : "Simpan"}</Button>
      </form>
    </Card>
  );
}

function DeleteButton({ slug, id, label }: { slug: string; id: string; label: string }) {
  const [state, action, pending] = useActionState<FormState>(deleteEntity.bind(null, slug, id), {});
  return (
    <form action={action} className="ml-3 inline" onSubmit={(ev) => { if (!confirm(`Hapus "${label}"?`)) ev.preventDefault(); }}>
      <button disabled={pending} className="text-red-600 hover:underline disabled:opacity-50">Hapus</button>
      {state.errors?._form && <span className="ml-2 text-xs text-red-600" role="alert">{state.errors._form}</span>}
    </form>
  );
}
