# DECISIONS.md

Append-only log of questions raised by agents and the stakeholder's answers. Newest entries at the bottom.

## 2026-11-20

| # | Question / topic | Decision | Source |
|---|------------------|----------|--------|
| D-001 | Which models do the agents run on? | Architect and analyst run on Fable. Developers run on Opus. | Stakeholder, build kickoff |
| D-002 | How is development work dispatched? | Developers run in parallel git worktrees where the work allows it. An architect and an analyst are on call to answer questions that come out of development. | Stakeholder, build kickoff |
| D-003 | Code rules | No semicolons in JS/TS. Source files aim for 200 lines, 300 is the hard limit (large static data exempt). | Stakeholder standing rules, SPEC.md Section 12 |
| D-004 | Where SPEC.md and REQUIREMENTS.md differ, which wins? | SPEC.md wins. Section 0 of SPEC.md lists every difference (R-01 to R-19). REQUIREMENTS.md is being updated to match (OI-13). | SPEC.md header |
| D-005 | Should a designer run now? (was Q-002) | Yes. A designer builds an interactive dummy UI (clickable, fake data, no backend) in `design/prototype/` so the general feel can be iterated on and locked in. SPEC-Design.md is written after the feel is agreed. | Stakeholder |
| D-006 | What do developers work on first? | Backend and logic first (main process, shared logic, commands, data, providers, export). Real UI screens wait until the look and feel is locked in through the prototype. The Phase 1 developer was already running with the full Phase 1 scope when this was decided, so Phase 1 may include basic screens; they are placeholders. | Stakeholder |

## Open, waiting on the stakeholder

| # | Question | Raised by | Blocks |
|---|----------|-----------|--------|
| Q-001 | Dropbox app key (SPEC OI-08): register a Dropbox app with full Dropbox access and redirect `http://127.0.0.1:47822/oauth/dropbox`, then supply the app key. | Architect (SPEC.md 6.5) | Phase 9 |
| Q-003 | Is there a GitHub remote for this repository, or should one be created? Until answered, work is committed locally only and nothing is pushed. | Orchestrator | CI runs, Phase 11 release |
