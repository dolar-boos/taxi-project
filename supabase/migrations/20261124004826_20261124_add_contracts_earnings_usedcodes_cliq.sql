/*
# Add driver contracts, trip earnings, used codes, and CliQ transfer tables

1. New Tables
- `used_codes`: tracks redemption of promo_codes and wallet_bonus_codes per user.
  - id (uuid PK)
  - code_type ('discount' | 'bonus')
  - code (text)
  - phone (text) — the user who redeemed
  - user_id (text, nullable) — optional profile id
  - used_at (timestamptz, default now())
  - unique constraint on (code, phone) to prevent double redemption
- `driver_contracts`: the agreement between admin and a driver.
  - id (uuid PK)
  - driver_id (uuid FK -> drivers.id ON DELETE CASCADE)
  - driver_phone (text) — for easy lookup before driver row exists
  - admin_percentage (numeric, 10-40)
  - driver_percentage (numeric, = 100 - admin_percentage)
  - accepted_at (timestamptz, nullable) — set when driver accepts
  - is_active (boolean, default true)
  - created_at (timestamptz, default now())
- `trip_earnings`: profit distribution record per ride.
  - id (uuid PK)
  - ride_id (uuid FK -> rides.id ON DELETE CASCADE)
  - total (numeric) — total fare paid by rider
  - admin_share (numeric) — admin's portion
  - driver_share (numeric) — driver's portion
  - admin_percentage (numeric) — snapshot of contract at time of ride
  - payment_method (text, 'cash' | 'wallet')
  - driver_id (uuid, nullable)
  - driver_phone (text, nullable)
  - customer_phone (text, nullable)
  - created_at (timestamptz, default now())
- `cliq_transfers`: record of CliQ transfer attempts.
  - id (uuid PK)
  - trip_earning_id (uuid FK -> trip_earnings.id)
  - ride_id (uuid, nullable)
  - amount (numeric) — amount transferred to driver
  - driver_cliq_number (text, nullable)
  - admin_cliq_number (text, nullable)
  - status (text, 'pending' | 'completed', default 'completed')
  - transferred_at (timestamptz, default now())
  - unique on trip_earning_id to prevent double transfer

2. Modified Tables
- `drivers`: add `cliq_number` (text, nullable) and `iban_number` (text, nullable)
  for CliQ / IBAN payout details the driver provides in his profile.

3. Security
- Enable RLS on all new tables.
- Grant CRUD to anon, authenticated (app uses anon key for all operations).
- All policies allow anon+authenticated access (single-tenant app model used elsewhere).
*/

-- 1. used_codes
CREATE TABLE IF NOT EXISTS used_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_type text NOT NULL CHECK (code_type IN ('discount', 'bonus')),
  code text NOT NULL,
  phone text NOT NULL,
  user_id text,
  used_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE used_codes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON used_codes TO anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS used_codes_code_phone_key ON used_codes (code, phone);
DROP POLICY IF EXISTS "anon_crud_used_codes" ON used_codes;
CREATE POLICY "anon_select_used_codes" ON used_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_used_codes" ON used_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_used_codes" ON used_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_used_codes" ON used_codes FOR DELETE TO anon, authenticated USING (true);

-- 2. driver_contracts
CREATE TABLE IF NOT EXISTS driver_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  driver_phone text NOT NULL,
  admin_percentage numeric NOT NULL DEFAULT 20 CHECK (admin_percentage >= 10 AND admin_percentage <= 40),
  driver_percentage numeric NOT NULL DEFAULT 80,
  accepted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE driver_contracts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON driver_contracts TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_driver_contracts" ON driver_contracts;
CREATE POLICY "anon_select_driver_contracts" ON driver_contracts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_driver_contracts" ON driver_contracts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_driver_contracts" ON driver_contracts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_driver_contracts" ON driver_contracts FOR DELETE TO anon, authenticated USING (true);

-- 3. trip_earnings
CREATE TABLE IF NOT EXISTS trip_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES rides(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0,
  admin_share numeric NOT NULL DEFAULT 0,
  driver_share numeric NOT NULL DEFAULT 0,
  admin_percentage numeric NOT NULL DEFAULT 20,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wallet')),
  driver_id uuid,
  driver_phone text,
  customer_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trip_earnings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_earnings TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_trip_earnings" ON trip_earnings;
CREATE POLICY "anon_select_trip_earnings" ON trip_earnings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_trip_earnings" ON trip_earnings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_trip_earnings" ON trip_earnings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_trip_earnings" ON trip_earnings FOR DELETE TO anon, authenticated USING (true);

-- 4. cliq_transfers
CREATE TABLE IF NOT EXISTS cliq_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_earning_id uuid REFERENCES trip_earnings(id) ON DELETE CASCADE,
  ride_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  driver_cliq_number text,
  admin_cliq_number text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
  transferred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cliq_transfers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON cliq_transfers TO anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS cliq_transfers_trip_earning_id_key ON cliq_transfers (trip_earning_id);
DROP POLICY IF EXISTS "anon_select_cliq_transfers" ON cliq_transfers;
CREATE POLICY "anon_select_cliq_transfers" ON cliq_transfers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_cliq_transfers" ON cliq_transfers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_cliq_transfers" ON cliq_transfers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_cliq_transfers" ON cliq_transfers FOR DELETE TO anon, authenticated USING (true);

-- 5. Add cliq_number and iban_number to drivers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'cliq_number') THEN
    ALTER TABLE drivers ADD COLUMN cliq_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'iban_number') THEN
    ALTER TABLE drivers ADD COLUMN iban_number text;
  END IF;
END $$;

-- 6. Add admin_cliq_number to payment_settings for admin's CliQ account
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'admin_cliq_number') THEN
    ALTER TABLE payment_settings ADD COLUMN admin_cliq_number text;
  END IF;
END $$;

-- 7. Add default admin percentage setting to pricing_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_settings' AND column_name = 'default_admin_percentage') THEN
    ALTER TABLE pricing_settings ADD COLUMN default_admin_percentage numeric NOT NULL DEFAULT 20;
  END IF;
END $$;

-- Grant on the new columns' tables is already covered by table-level grants above.
-- drivers/payment_settings/pricing_settings already have grants from prior migrations.
