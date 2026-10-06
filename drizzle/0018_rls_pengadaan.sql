GRANT SELECT, INSERT, UPDATE, DELETE ON budget_ceilings, proposals, proposal_lines, procurements, procurement_lines TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON proposal_events TO inventaris_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE proposal_events_id_seq TO inventaris_app;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['budget_ceilings','proposals','proposal_lines','proposal_events','procurements','procurement_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER proposal_events_immutable BEFORE UPDATE OR DELETE ON proposal_events
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_riwayat();
