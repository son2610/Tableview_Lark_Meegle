# Lessons

- Lark table-view extensions use `@lark-opdev/block-bitable-api` (latest stable 0.4.0, mid-2024). 0.1.x lacks
  `table.getRecords` and keyed `bridge.getData/setData`; prefer 0.4.0. Why: picking the old version silently
  removes pagination and per-key storage.
- `@lark-opdev/block-bitable-webpack-utils` reads `../app.json` (parent of the view dir) and `block.json`, and the
  dev middleware requires `opdev login`. Why: any offline/demo build must skip both or it exits.
- Downloaded npm tarballs for API inspection: use `npm pack` into a fresh scratch dir (no install scripts run).
