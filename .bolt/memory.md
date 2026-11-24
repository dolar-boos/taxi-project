# Project memory

## Product intent & audience

- Driver registration app (likely ride-hailing or delivery service).
- Arabic-speaking users; UI text in Arabic.
- Driver registration flow includes fields: national ID, license number, vehicle number, and image uploads.
- Built with Next.js + Supabase (storage bucket for images, `drivers` table).
- Uses Capacitor for mobile app packaging (web + native camera access).

## Brand personality & voice

- Arabic-first communication; user-facing messages in Arabic.
- Helpful, direct tone in support responses.

## Visual design & UX direction

- Driver registration form uses a tabbed or sectioned layout ("تبويب").
- Form fields appear in order: national ID → license number → vehicle number.
- Image upload UI must work across all phone types and accept all image formats (HEIC, HEIF, WebP, PNG, JPEG).
- Images are normalized to JPEG via Canvas at max 1600px, quality 85% before upload.
- On mobile (Capacitor): uses native camera; on web: uses a persistent file picker element (not transient input).

## Decisions, constraints & rationale

- `drivers` table has `license_number` column; `license_number` added to Driver type and form state; required field.
- Image upload pipeline rewritten: Canvas-based conversion to JPEG with max 1600px resize; `heic2any` as fallback for HEIC/HEIF when Canvas fails.
- Previous file-picker bug: input element was garbage-collected before `onchange` fired on some browsers; fixed by anchoring the input to the DOM.
- Supabase storage bucket has public insert/select policies; bucket confirmed working.
- Environment variables via `.env` at project root; Bolt auto-reloads on file changes.
- Build verified passing after changes.

## Open questions & assumptions

- Assumes user relies on Bolt's managed dev server (no manual `next dev`).
- Next.js router mode (App Router vs Pages Router) still undetermined.
- Whether other registration forms or flows exist beyond driver registration is unknown.
- Specific Supabase env variable names not yet documented.