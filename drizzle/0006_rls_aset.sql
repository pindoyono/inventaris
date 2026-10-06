-- Hak akses & RLS aset. Riwayat aset hanya tambah & baca.
GRANT SELECT, INSERT, UPDATE ON assets TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON asset_events, qr_tokens TO inventaris_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE asset_events_id_seq TO inventaris_app;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assets','asset_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION tolak_ubah_riwayat() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Riwayat tidak boleh diubah atau dihapus' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER asset_events_immutable BEFORE UPDATE OR DELETE ON asset_events
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_riwayat();
