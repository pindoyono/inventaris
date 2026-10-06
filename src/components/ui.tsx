import type { ComponentProps, ReactNode } from "react";

const control =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-100 aria-invalid:border-red-500";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="block text-xs text-red-600">{error}</span> : hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input({ invalid, className = "", ...p }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={`${control} ${className}`} {...p} />;
}

export function Select({ invalid, className = "", ...p }: ComponentProps<"select"> & { invalid?: boolean }) {
  return <select aria-invalid={invalid || undefined} className={`${control} ${className}`} {...p} />;
}

export function Textarea({ invalid, className = "", ...p }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={`${control} ${className}`} {...p} />;
}

const variants = {
  primary: "bg-teal-700 text-white hover:bg-teal-800",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

export function Button({ variant = "primary", className = "", ...p }: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${variants[variant]} ${className}`}
      {...p}
    />
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success" | "warning"; children: ReactNode }) {
  const t = {
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${t}`}>{children}</div>;
}

export function Card({ title, children, actions }: { title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Pernyataan lingkup layanan — wajib tampil di halaman depan & pendaftaran */
export function ScopeNotice() {
  return (
    <Alert tone="info">
      <strong>Khusus sekolah negeri milik Pemerintah Daerah.</strong> Inventaris diperuntukkan bagi SD/SMP Negeri
      (milik kabupaten/kota) serta SMA/SMK/SLB Negeri (milik provinsi), yang barangnya merupakan Barang Milik Daerah
      menurut Permendagri 19/2016 jo. 7/2024 dan 47/2021. Belum melayani madrasah dan sekolah swasta.
    </Alert>
  );
}

/** Pesan hasil server action (error umum / sukses) */
export function FormMessage({ state }: { state: { errors?: Record<string, string>; ok?: string } }) {
  if (state.errors?._form) return <Alert>{state.errors._form}</Alert>;
  if (state.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

export function PageTitle({ title, desc, back }: { title: string; desc?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && <a href={back.href} className="text-sm text-teal-700 hover:underline">← {back.label}</a>}
      <h1 className="text-xl font-semibold">{title}</h1>
      {desc && <p className="mt-1 text-sm text-slate-600">{desc}</p>}
    </div>
  );
}
