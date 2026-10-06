-- Hak akses & RLS tabel persediaan (lihat 0001 untuk pola).
GRANT SELECT, INSERT, UPDATE, DELETE ON supply_items, stock_docs, stock_doc_lines TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON doc_counters, stock_lots, stock_balances TO inventaris_app;
--> statement-breakpoint
-- Buku besar: hanya tambah & baca
GRANT SELECT, INSERT ON stock_movements TO inventaris_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE stock_movements_id_seq TO inventaris_app;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['supply_items','doc_counters','stock_docs','stock_doc_lines','stock_lots','stock_balances','stock_movements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
--> statement-breakpoint
-- Pengaman kedua (berlaku juga untuk pemilik tabel): buku besar tidak boleh diubah/dihapus
CREATE OR REPLACE FUNCTION tolak_ubah_buku_besar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Buku besar persediaan tidak boleh diubah atau dihapus (gunakan pembatalan dokumen)'
    USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER stock_movements_immutable BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_buku_besar();
