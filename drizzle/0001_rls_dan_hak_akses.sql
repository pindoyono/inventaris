-- Hak akses role aplikasi & Row-Level Security per sekolah.
-- Migrasi dijalankan oleh inventaris_owner (pemilik tabel). Aplikasi terhubung sebagai inventaris_app,
-- yang terkena RLS: hanya melihat baris dengan school_id = current_setting('app.school_id').
-- Bila app.school_id tidak di-set, nilainya NULL → tidak ada baris yang terlihat (default menolak).

-- 1) Tabel platform: aplikasi boleh membaca/menulis seperlunya
GRANT SELECT ON regions, bmd_codes TO inventaris_app;
GRANT SELECT, INSERT, UPDATE ON schools, platform_admins TO inventaris_app;
GRANT SELECT, INSERT ON platform_logs TO inventaris_app;
GRANT USAGE ON SEQUENCE platform_logs_id_seq TO inventaris_app;

-- 2) Tabel sekolah: DML penuh, dibatasi RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON
  school_settings, users, user_roles, units, buildings, rooms, warehouses, user_units, user_warehouses,
  uoms, funding_sources, funding_components, vendors, local_bmd_codes, favorite_bmd_codes
TO inventaris_app;

-- Log aktivitas: hanya tambah & baca (tidak bisa diubah/dihapus)
GRANT SELECT, INSERT ON activity_logs TO inventaris_app;
GRANT USAGE ON SEQUENCE activity_logs_id_seq TO inventaris_app;

-- 3) school_id aktif dari konteks transaksi (di-set aplikasi dengan set_config(..., true))
CREATE OR REPLACE FUNCTION app_school_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.school_id', true), '')::uuid $$;

-- 4) Aktifkan & paksakan RLS + kebijakan isolasi untuk setiap tabel ber-school_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'school_settings','users','user_roles','units','buildings','rooms','warehouses','user_units',
    'user_warehouses','uoms','funding_sources','funding_components','vendors','local_bmd_codes',
    'favorite_bmd_codes','activity_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY sekolah_sendiri ON %I FOR ALL TO inventaris_app USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())',
      t
    );
  END LOOP;
END $$;
