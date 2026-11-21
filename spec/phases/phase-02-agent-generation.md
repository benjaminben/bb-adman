# Phase 2 leftovers, group 3: agents generate through the MCP server

This is group 3 of the Phase 2 leftovers. Groups 2, 4 and 5 are in `spec/phases/phase-02-leftovers.md`.

**Goal.** An agent connected through the MCP server can start, follow and cancel its own picture and video runs on every provider the user has allowed for agents in Settings [D-080].

**State on `main`.** All of it is built: the gate, the tick, the limit, the runner's untick check, the paid tick (Gemini can be ticked), the Settings block "Agent runs", "Started by an agent" on a run row, and the tools `generate_images`, `generate_video` and `cancel_job` (11 tools). The rules are in `spec/agent-runs.md`, `spec/mcp-and-agents.md` and `spec/cancel.md`. What is left is one hand run on the real server, and one change that waits on an answer.

## Order

1. The first agent run on the user's ComfyUI server.
2. If OI-90 is answered "no ticks", that change, whenever the answer comes.

## First agent run on the user's ComfyUI server

- **What it is:** the proof of this feature on the real server, done once.
- **Who:** the stakeholder, by hand. He turns the MCP server on, ticks ComfyUI (not Gemini), and pastes the Connect line into the agent's Claude Code.
- **What:** the agent makes one picture and one video from a first frame through the tools, one attempt each, dev tools on. No Gemini run here. Each run leaves on the server what `spec/comfyui.md` lists as left behind by a run.
- **Paid calls.** Under D-085 one low-cost paid run may confirm the agent Gemini path once, at the smallest size. No automatic test makes a paid call.

## If OI-90 is answered "no ticks"

- Gate step 2 always passes (one line), and the Settings tick block is removed. Nothing else moves.
