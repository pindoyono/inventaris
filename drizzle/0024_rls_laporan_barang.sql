GRANT SELECT, INSERT, UPDATE ON transfers TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON password_resets TO inventaris_app;
--> statement-breakpoint
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE transfers FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Terlihat oleh sekolah pengirim dan sekolah penerima; baris baru hanya boleh dibuat pengirim
CREATE POLICY pengirim_atau_penerima ON transfers FOR SELECT TO inventaris_app
  USING (from_school_id = app_school_id() OR to_school_id = app_school_id());
--> statement-breakpoint
CREATE POLICY pengirim_tambah ON transfers FOR INSERT TO inventaris_app
  WITH CHECK (from_school_id = app_school_id());
--> statement-breakpoint
CREATE POLICY pengirim_atau_penerima_ubah ON transfers FOR UPDATE TO inventaris_app
  USING (from_school_id = app_school_id() OR to_school_id = app_school_id())
  WITH CHECK (from_school_id = app_school_id() OR to_school_id = app_school_id());
