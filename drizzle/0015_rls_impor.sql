GRANT SELECT, INSERT, UPDATE, DELETE ON import_jobs TO inventaris_app;
--> statement-breakpoint
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sekolah_sendiri ON import_jobs FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id());
