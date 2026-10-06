-- Hak akses & RLS peminjaman/notifikasi; antrean email tanpa RLS (diproses lintas sekolah oleh pengirim).
GRANT SELECT, INSERT, UPDATE, DELETE ON loans, loan_lines TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON notifications TO inventaris_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE notifications_id_seq TO inventaris_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON email_outbox TO inventaris_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE email_outbox_id_seq TO inventaris_app;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['loans','loan_lines','notifications'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
