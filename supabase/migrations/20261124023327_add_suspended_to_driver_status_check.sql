/*
# Add 'suspended' to allowed driver status values

## Problem
The `drivers` table has a CHECK constraint `drivers_status_check` that only allows
`pending_approval`, `approved`, or `rejected`. The admin dashboard activation/deactivation
feature sets a deactivated driver's status to `'suspended'`, which violates this constraint
and causes every activate/deactivate call (both single and bulk) to fail silently.

## Change
Drop the old `drivers_status_check` constraint and recreate it to also allow `'suspended'`.
This is a non-destructive schema change — no columns are added, removed, or renamed,
and no data is modified.

## Affected tables
- `drivers`: only the CHECK constraint on the `status` column is modified.

## Security
- No RLS policy changes.
- No grant changes.
*/

ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_status_check;

ALTER TABLE drivers ADD CONSTRAINT drivers_status_check
  CHECK (status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'rejected'::text, 'suspended'::text]));