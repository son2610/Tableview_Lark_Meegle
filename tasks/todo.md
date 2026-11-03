# Pipeline View (Lark Base table view extension) — todo

Goal: Meegle-style pipeline view on a Lark Base table. Stage = single-select field (unlimited nodes,
branching DAG), status = second single-select, per-node required fields. Spec: pipeline-view/DESIGN.md

## Status at pause (2026-11-02 ~20:36) — paused by user (daily quota)
Implementation workflow `wf_f0fa7b65-75f` was STOPPED mid-run. Files on disk are committed as WIP.
- [x] Research SDK, scaffold, contracts (types.ts, sdk/adapter.ts, core stubs, i18n infra, tokens.css, DESIGN.md)
- [x] sdk workstream FINISHED (agent returned): larkAdapter, palette, mock data/adapter/hostDialog, 35 tests pass
- [~] core workstream: all 7 modules + tests written, `npx vitest run src/core` = 327/327 pass; agent had not
      returned its final report — treat as done, review later
- [~] detail-ui workstream (PipelineGraph, OptionTag, RecordList, RecordDetail, NodePanel, FieldEditor,
      i18n/parts/detail): files exist but INCOMPLETE — e.g. RecordList / settings/StatusesTab import `StatusDot`
      from OptionTag, which does not exist yet
- [~] app-shell workstream (index, App, Toolbar, EmptyState, Overview, SettingsPanel + settings/*, usePipelineData,
      theme, i18n parts common/settings): files exist, completeness unknown

## Progress 2026-11-03
- [x] Typecheck clean (after pinning @types/node@20), 362/362 tests, prod build + demo build OK
- [x] Browser check (playwright, 1440x900): overview, detail, advance, required-field block, branch choice,
      settings designer, onboarding, dark + read-only all work. Observed: chip text descenders clipped, action
      dropdown stays open, active-node tag label confusing, finished record not counted at terminal node.
- [x] Review+fix workflow wf_3e3ce106-098: 30 findings (dupes incl.), all verified real & fixed; re-verified
      independently: 372/372 tests, tsc clean, prod build OK, browser: rollback, chips, menus, overview counts

## Resume plan (from pause)
1. `cd pipeline-view && npx tsc --noEmit -p tsconfig.json` to list what is missing/broken.
2. Option A (recommended, cheaper): finish the UI files directly from the tsc errors + DESIGN.md §4.2/§5.
   Option B: resume the workflow (sdk agent is cached; the other 3 re-run from scratch and overwrite partial files):
   Workflow({scriptPath: "C:\\Users\\Admin\\.claude\\projects\\D--Lark-table-view-Lark-Meegle-pipeline-view\\73e7b44e-b394-42e9-9cf7-a779cd3f1cd5\\workflows\\scripts\\pipeline-view-implement-wf_f0fa7b65-75f.js", resumeFromRunId: "wf_f0fa7b65-75f"})
3. Then: `npm test`, `npm run typecheck`, `npm run build`, `npm run demo` → verify in browser (preview config
   `pipeline-view/.claude/launch.json`, port 5180): demo preset, `?preset=none&reset=1`, `?readonly=1`,
   `?theme=dark`, narrow width.
4. Adversarial review workflow (SDK correctness, logic edge cases, UX vs requirements) → fixes.
5. Finalize README.md (vi, drafted); fill app.json appId / block.json blockTypeID (placeholders now); final report.

## Review
Done: working table-view extension (pipeline-view/), demo with mock Base, Vietnamese README, DESIGN.md.
Verified: 372 unit tests (core logic, mock + fake-SDK adapter, hook write-race helper), typecheck, prod build emitting
project.config.json/index.json, headless browser walk-through of all main flows (light/dark/read-only/onboarding/narrow).
NOT verified: running inside real Lark (needs App ID + BlockTypeID + opdev login by the user); SDK write shapes for
Email and loadConfig error semantics are verified only against typings/JS + fake SDK.
Follow-ups: parallel nodes via a multi-select stage field; server-side guard (Base automation) for stage edits made
in the grid; dark-mode option colours; cheaper source-view membership check; vendor.js is 1.7 MB (Semi + SDK).
