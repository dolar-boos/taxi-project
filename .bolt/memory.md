# Project memory

## Product intent & audience

- Next.js project under development in Bolt.

## Brand personality & voice

- Not yet established.

## Visual design & UX direction

- Not yet established.

## Decisions, constraints & rationale

- Environment variables are managed via a `.env` file at the project root.
- In Bolt, the dev server starts automatically and reloads on file changes; `.env` is loaded automatically on server start. Manual restart is not available.
- If env vars appear stale, trigger an automatic reload via a small file edit or refresh the preview.

## Open questions & assumptions

- Assumes the user relies on Bolt's managed dev server rather than a local `next dev` process.
- Specific env variables and their intended usage are not yet known.
- Whether the project uses Next.js App Router or Pages Router is undetermined.