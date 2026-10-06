GRANT SELECT, INSERT, UPDATE, DELETE ON constructions, utilizations, utilization_lines TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON asset_value_changes, asset_changes TO inventaris_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE asset_value_changes_id_seq, asset_changes_id_seq TO inventaris_app;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['asset_value_changes','asset_changes','constructions','utilizations','utilization_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER asset_value_changes_immutable BEFORE UPDATE OR DELETE ON asset_value_changes
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_riwayat();
--> statement-breakpoint
CREATE TRIGGER asset_changes_immutable BEFORE UPDATE OR DELETE ON asset_changes
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_riwayat();
