-- Hak akses & RLS tabel audit.
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_opnames, stock_opname_lines, asset_inventories, asset_inventory_lines, disposals, disposal_lines TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON maintenances TO inventaris_app;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_opnames','stock_opname_lines','asset_inventories','asset_inventory_lines','disposals','disposal_lines','maintenances'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
