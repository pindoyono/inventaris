import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { schoolSettings } from "@/db/schema";
import { loadRegisterParts } from "@/lib/server/register";
import { depreciationAt, loadTimelines } from "@/lib/server/bmd-ledger";
import type { Cell } from "@/lib/server/csv";
import { ACQUISITION_LABEL, CONDITION_LABEL, KIB_ATTRS, KIB_LABEL, kodeBarang, registerCode, STATUS_LABEL } from "@/lib/assets-shared";
import { semIndex } from "@/lib/depreciation-shared";
import { todayWita } from "@/lib/server/ledger";
import { parseDec } from "@/lib/decimal";

type AssetRow = {
  id: string; bmd_code: string; funding_source_id: string | null; code_name: string | null; kib: string; reg_no: number; name: string; brand: string | null; attrs: Record<string, string>;
  acq_date: string; acq_price: string; acquisition: string; is_intra: boolean; condition: keyof typeof CONDITION_LABEL; status: keyof typeof STATUS_LABEL;
  room: string | null; funding: string | null; ref_number: string | null; note: string | null;
};

/**
 * Ekspor KIB per register (satu baris per unit) untuk rekonsiliasi dengan aplikasi BMD Pemda (SIMDA BMD / SIPD-RI).
 * Kolom mengikuti KIB Permendagri 47/2021 + kode lokasi, nilai buku, dan sumber dana.
 */
export async function kibSheets(tx: Tx, schoolId: string) {
  const today = todayWita();
  const parts = await loadRegisterParts(tx, schoolId);
  const [st] = await tx.select({ life: schoolSettings.usefulLife }).from(schoolSettings);
  const tl = new Map((await loadTimelines(tx, schoolId)).map((t) => [t.id, t]));
  const rows = [...(await tx.execute(sql`
    select a.id, a.bmd_code, a.funding_source_id, b.name as code_name, a.kib, a.reg_no, a.name, a.brand, a.attrs, a.acq_date::text, a.acq_price::text, a.acquisition, a.is_intra,
      a.condition, a.status, r.name as room, f.name as funding, a.ref_number, a.note
    from assets a left join bmd_codes b on b.code = a.bmd_code left join rooms r on r.id = a.room_id left join funding_sources f on f.id = a.funding_source_id
    where a.status <> 'DIHAPUS' order by a.bmd_code, a.reg_no`))] as unknown as AssetRow[];
  const x = semIndex(today);
  const sheets: { name: string; rows: Cell[][] }[] = [];
  const rekap: Cell[][] = [];
  for (const kib of ["A", "B", "C", "D", "E", "F", "ATB"]) {
    const list = rows.filter((r) => r.kib === kib);
    const attrs = KIB_ATTRS[kib] ?? [];
    let total = 0n, book = 0n;
    const body = list.map((r, i) => {
      const reg = registerCode(parts, { isIntra: r.is_intra, acqDate: r.acq_date, bmdCode: r.bmd_code, regNo: r.reg_no, fundingSourceId: r.funding_source_id });
      const t = tl.get(r.id);
      const d = t ? depreciationAt(t, x, st?.life ?? {}) : null;
      const v = parseDec(r.acq_price);
      total += v;
      book += d ? v - d.acc : v;
      return [
        i + 1, reg.top, kodeBarang(r.bmd_code), r.code_name ?? "", r.name, String(r.reg_no).padStart(6, "0"), r.brand ?? "", ...attrs.map((a) => r.attrs[a.key] ?? ""),
        r.acq_date.slice(0, 4), r.acq_date, ACQUISITION_LABEL[r.acquisition] ?? r.acquisition, v, r.is_intra ? "Intrakomptabel" : "Ekstrakomptabel",
        CONDITION_LABEL[r.condition], STATUS_LABEL[r.status], r.room ?? "", r.funding ?? "", r.ref_number ?? "", d?.acc ?? 0n, d ? v - d.acc : v, r.note ?? "",
      ] as Cell[];
    });
    sheets.push({
      name: kib === "ATB" ? "ATB" : `KIB ${kib}`,
      rows: [
        [KIB_LABEL[kib]], [`${parts.schoolName} — keadaan per ${today}`], [],
        ["No", "Kode Lokasi", "Kode Barang", "Nama Barang (kodefikasi)", "Nama di sekolah", "No. Register", "Merk/Tipe", ...attrs.map((a) => a.label), "Tahun", "Tgl Perolehan", "Asal-usul", "Harga Perolehan (Rp)", "Intra/Ekstra", "Kondisi", "Status", "Ruangan", "Sumber Dana", "No. Bukti", "Akumulasi Penyusutan (Rp)", "Nilai Buku (Rp)", "Keterangan"],
        ...body,
      ],
    });
    rekap.push([KIB_LABEL[kib], list.length, total, book]);
  }
  sheets.unshift({ name: "Rekap", rows: [["Rekapitulasi KIB"], [`${parts.schoolName} — keadaan per ${today}`], [], ["Golongan", "Jumlah Unit", "Nilai Perolehan (Rp)", "Nilai Buku (Rp)"], ...rekap] });
  return sheets;
}

/** Saldo persediaan per barang × gudang saat ini */
export async function persediaanSheet(tx: Tx) {
  const rows = [...(await tx.execute(sql`
    select i.nusp, i.name, u.name as uom, w.name as warehouse, b.qty::text, b.value::text
    from stock_balances b join supply_items i on i.id = b.item_id join warehouses w on w.id = b.warehouse_id left join uoms u on u.id = i.uom_id
    where b.qty <> 0 order by i.nusp, w.name`))] as unknown as { nusp: string; name: string; uom: string | null; warehouse: string; qty: string; value: string }[];
  return {
    name: "Persediaan",
    rows: [["Saldo persediaan"], [`Keadaan per ${todayWita()}`], [], ["No", "Kode (NUSP)", "Nama Barang", "Satuan", "Gudang", "Jumlah", "Nilai (Rp)"],
      ...rows.map((r, i) => [i + 1, r.nusp, r.name, r.uom ?? "", r.warehouse, Number(r.qty), parseDec(r.value)] as Cell[])],
  };
}
