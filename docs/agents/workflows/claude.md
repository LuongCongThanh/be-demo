# Claude Code Workflow

This is the Claude-specific entrypoint. Follow [`../execution-workflow.md`](../execution-workflow.md) for shared repository behavior.

## Load the right context

1. Follow root `CLAUDE.md` and `AGENTS.md`.
2. Read the applicable files in `.claude/rules/` and their full source documents under `docs/convention/`.
3. Read the relevant task, acceptance criteria, business rules, architecture docs, and ADRs before changing behavior.

## Choose the workflow

- Use the `feature` skill (`/feature`) for a feature, behavior change, or fix; it runs [`../flows/feature.md`](../flows/feature.md).
- Use the `ship` skill (`/ship`) only when the user asks to ship or open a PR; it runs [`../flows/ship.md`](../flows/ship.md), including its authorization rule.
- For code review, follow the [repository review policy](../../../AGENTS.md#shared-ai-code-review) and keep the review read-only.
- Call project skills by their plain names (`tdd`, `to-spec`, …). Prefer them over user-global plugin copies such as `mattpocock-skills:tdd`, so Claude runs the same pinned version as Codex and Copilot.

## Use Claude controls accurately

- `.claude/skills/` mirrors every project skill from `.agents/skills/`, including `feature` and `ship`; `.claude/rules/` applies file-scoped conventions.
- `.claude/skill-guide/` is an inventory of this user's global Claude skills and MCP setup, not a guarantee that another machine or harness has those tools installed.
- `.claude/settings.json` registers hooks for specific tool events. Follow a blocking hook and report the blocker; do not bypass it to force completion.
- Hooks are not proof that unrelated checks passed and do not protect every file or every command path. Inspect the final diff yourself.
- Use the repository's npm scripts from `package.json`; report only checks that actually ran.

## Finish

Before reporting completion, compare the result to the request, inspect the diff for unexpected files or deletions, and state actual checks, gaps, and remaining work.
