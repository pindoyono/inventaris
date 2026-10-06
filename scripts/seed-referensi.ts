/**
 * Mengisi tabel rujukan platform: kode wilayah (Kepmendagri) & kode barang BMD (Permendagri 108/2016).
 * Idempoten (upsert). Dijalankan sebagai pemilik tabel:  bun scripts/seed-referensi.ts
 */
import postgres from "postgres";
import wilayah from "../data/wilayah-provinsi-kabkota.json";
import kodeBmd from "../data/bmd/kode-barang-permendagri-108-2016.json";

const url = process.env.DATABASE_URL_OWNER;
if (!url) throw new Error("DATABASE_URL_OWNER belum di-set");

const sql = postgres(url, { max: 1 });

type Wilayah = { kode: string; nama: string; tingkat: number; induk: string | null };
type Kode = { kode: string; tingkat: number; uraian: string; induk: string | null; golongan: string | null; bisa_dipilih: boolean };

async function upsertBatches<T>(rows: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

await sql.begin(async (tx) => {
  const regions = (wilayah.wilayah as Wilayah[]).map((w) => ({
    code: w.kode,
    name: w.nama,
    level: w.tingkat,
    parent_code: w.induk,
  }));
  await upsertBatches(regions, 500, (b) =>
    tx`insert into regions ${tx(b)} on conflict (code) do update set name = excluded.name, level = excluded.level, parent_code = excluded.parent_code`,
  );

  // Induk harus ada lebih dulu → urutkan menurut tingkat
  const codes = (kodeBmd.kode as Kode[])
    .slice()
    .sort((a, b) => a.tingkat - b.tingkat)
    .map((k) => ({
      code: k.kode,
      level: k.tingkat,
      name: k.uraian,
      parent_code: k.induk,
      class: k.golongan,
      selectable: k.bisa_dipilih,
    }));
  await upsertBatches(codes, 1000, (b) =>
    tx`insert into bmd_codes ${tx(b)} on conflict (code) do update set level = excluded.level, name = excluded.name,
       parent_code = excluded.parent_code, class = excluded.class, selectable = excluded.selectable`,
  );

  const [{ r }] = await tx`select count(*)::int as r from regions`;
  const [{ c }] = await tx`select count(*)::int as c from bmd_codes`;
  console.log(`Wilayah: ${r} · Kode BMD: ${c}`);
});

await sql.end();
