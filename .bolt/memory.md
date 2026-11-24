# Project memory

## Product intent & audience

- Driver registration & management app (likely ride-hailing or delivery service).
- Arabic-speaking users; UI text in Arabic.
- Built with Next.js + Supabase (storage bucket for images, `drivers` table).
- Uses Capacitor for mobile app packaging (web + native camera access).
- Includes an admin dashboard with a drivers tab for managing driver activation status.

## Brand personality & voice

- Arabic-first communication; user-facing messages in Arabic.
- Helpful, direct tone in support responses.

## Visual design & UX direction

- Driver registration form uses a tabbed or sectioned layout ("تبويب").
- Form fields appear in order: national ID → license number → vehicle number.
- Image upload UI must work across all phone types and accept all image formats (HEIC, HEIF, WebP, PNG, JPEG).
- Images normalized to JPEG via Canvas at max 1600px, quality 85% before upload.
- On mobile (Capacitor): uses native camera; on web: uses persistent file picker element (not transient input).
- Admin drivers table: toggle button per driver showing "مفعّل" (green) or "مفصول" (red); separate connection status column retained.
- Bulk action buttons: "تفعيل كل السائقين" and "فصل كل السائقين" placed before the drivers table.

## Decisions, constraints & rationale

- `drivers` table has `license_number` column; `license_number` added to Driver type and form state; required field.
- Image upload pipeline: Canvas-based JPEG conversion at max 1600px; `heic2any` fallback for HEIC/HEIF.
- Previous file-picker bug fixed by anchoring input to DOM.
- Supabase storage bucket has public insert/select policies; confirmed working.
- Environment variables via `.env` at project root; Bolt auto-reloads on file changes.
- Admin driver activation: toggling `is_approved` on a driver activates/deactivates them; deactivating disconnects driver and clears their map location.
- `availableDrivers` filter updated to include suspended drivers so they appear in the table with a reactivate option.
- Bulk activate/deactivate functions added after existing `rejectDriver` function, with bulk loading state.
- Overview tab counts drivers generically ("السائقين"), not split by approval status.
- Build verified passing after all changes.

## Open questions & assumptions

- Assumes user relies on Bolt's managed dev server (no manual `next dev`).
- Next.js router mode (App Router vs Pages Router) still undetermined.
- Whether other registration forms or flows exist beyond driver registration is unknown.
- Specific Supabase env variable names not yet documented.
- Admin dashboard structure beyond the drivers tab not fully mapped.