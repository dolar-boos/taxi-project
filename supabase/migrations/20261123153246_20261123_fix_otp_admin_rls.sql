/*
# Fix OTP RLS and Admin Profile

1. Security - otp_codes
   - RLS already enabled. Policies already allow anon/authenticated CRUD (open).
   - No changes needed - the table is intentionally open for OTP flow since
     users are not authenticated when requesting/verifying OTP.

2. Security - Rides table
   - RLS was disabled in a previous migration. Re-enable it and add open policies
     to match the rest of the schema (anon+authenticated full CRUD).
   - This ensures the admin (authenticated) can SELECT/INSERT/UPDATE/DELETE.

3. Admin profile
   - Update the existing admin profile row to use admin@fontaxi.io email.
   - Ensure role = admin.

4. Notes
   - All other tables already have open RLS policies for anon+authenticated.
   - The admin uses Supabase Auth (email/password) and the profiles table to check role.
   - The profiles.user_id column links to auth.users.id once the admin logs in.
*/

-- Re-enable RLS on rides and add policies
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON rides TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_rides" ON rides;
CREATE POLICY "anon_select_rides" ON rides FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_rides" ON rides;
CREATE POLICY "anon_insert_rides" ON rides FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_rides" ON rides;
CREATE POLICY "anon_update_rides" ON rides FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_rides" ON rides;
CREATE POLICY "anon_delete_rides" ON rides FOR DELETE TO anon, authenticated USING (true);

-- Update admin profile email to admin@fontaxi.io
UPDATE profiles SET email = 'admin@fontaxi.io', role = 'admin' WHERE phone = 'admin';
