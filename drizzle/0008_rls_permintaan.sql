-- Hak akses & RLS permintaan persediaan. Jejak alur hanya tambah & baca.
GRANT SELECT, INSERT, UPDATE, DELETE ON supply_requests, supply_request_lines TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON request_events TO inventaris_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE request_events_id_seq TO inventaris_app;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['supply_requests','supply_request_lines','request_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER request_events_immutable BEFORE UPDATE OR DELETE ON request_events
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_riwayat();
