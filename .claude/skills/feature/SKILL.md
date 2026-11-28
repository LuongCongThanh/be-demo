---
name: feature
description: Use when the user asks to implement a feature, behavior change, or bug fix, or types `/feature`. Carries the request through discovery, specification, implementation, and verification.
---

# Feature

Run the shared [feature flow](../../../docs/agents/flows/feature.md) (`docs/agents/flows/feature.md`) exactly as written: same steps, same order, same stop points, same Definition of Done for every agent.

This entry skill only adapts invocation to the active agent:

- Call each step's skill by its plain name (`grill-with-docs`, `to-spec`, `implement`, `tdd`, …). They are vendored in this repository for every agent, so a Claude user-global copy such as `mattpocock-skills:tdd` is not needed.
- Load the agent's native file-scoped conventions for the files you touch: `.claude/rules/` (Claude Code), `.github/instructions/` (Copilot), or the nearest `AGENTS.md` (Codex). All of them point at `docs/conventions/`.
- Use the agent's own exploration/subagent tool where the flow mentions one; if the agent has none, do that step inline.

If the user also asks to publish, hand over to the `ship` skill after Step 5.
