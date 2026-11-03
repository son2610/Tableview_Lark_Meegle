# Lessons

- Lark table-view extensions use `@lark-opdev/block-bitable-api` (latest stable 0.4.0, mid-2024). 0.1.x lacks
  `table.getRecords` and keyed `bridge.getData/setData`; prefer 0.4.0. Why: picking the old version silently
  removes pagination and per-key storage.
- `@lark-opdev/block-bitable-webpack-utils` reads `../app.json` (parent of the view dir) and `block.json`, and the
  dev middleware requires `opdev login`. Why: any offline/demo build must skip both or it exits.
- Downloaded npm tarballs for API inspection: use `npm pack` into a fresh scratch dir (no install scripts run).
- Any later `npm install <pkg>` prunes the modules that `@lark-opdev/cli`'s postinstall copied into its own
  node_modules (they are not in the lockfile), breaking `npm run build` with "Cannot find module
  '@bdeefe/feishu-devtools-core/...'". Fix: delete node_modules/@lark-opdev/cli and `npm install` again (scripts on).
- Latest @types/node (pulled in via vitest/vite) does not parse under TypeScript 4.9; pin `@types/node@20` as a devDependency.
- The in-app browser pane screenshots scale an emulated desktop viewport down to unreadable size; for UI review use
  headless `playwright-cli` screenshots at 1440x900 instead.
