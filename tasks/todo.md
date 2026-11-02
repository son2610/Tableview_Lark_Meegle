# Pipeline View (Lark Base table view extension) — todo

Goal: Meegle-style pipeline view on a Lark Base table. Stage = single-select field (unlimited nodes,
branching DAG), status = second single-select, per-node required fields. Spec: pipeline-view/DESIGN.md

## Plan
- [x] Research SDK (@lark-opdev/block-bitable-api 0.4.0 typings, webpack utils, user's prior projects)
- [x] Scaffold project (pinned versions from user's working table-view project), install deps
- [x] Contracts: types.ts, sdk/adapter.ts, core stubs, i18n infra, tokens.css, DESIGN.md
- [ ] Workflow 1 — implement in parallel: core+tests | adapters+mock | detail UI | app/hook/settings
- [ ] Integrate: typecheck, unit tests, production build, demo build
- [ ] Browser verification against mock (demo preset, onboarding, readonly, dark, narrow)
- [ ] Workflow 2 — adversarial review (SDK correctness, logic edge cases, UX vs requirements), fix
- [ ] README (vi): setup in Lark developer console, dev/debug/upload, usage guide, limitations
- [ ] Final report

## Review
(filled at the end)
