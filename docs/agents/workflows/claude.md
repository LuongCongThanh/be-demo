# Claude Code Workflow

This is the Claude-specific entrypoint. Follow [`../execution-workflow.md`](../execution-workflow.md) for shared repository behavior.

## Load the right context

1. Follow root `CLAUDE.md` and `AGENTS.md`.
2. Read the applicable files in `.claude/rules/` and their full source documents under `docs/convention/`.
3. Read the relevant task, acceptance criteria, business rules, architecture docs, and ADRs before changing behavior.

## Choose the workflow

- Use `/feature` for a new feature or fix whose behavior needs discovery and specification. Continue through implementation and verification when the user requested implementation; ask only for unresolved consequential decisions.
- Use `/ship` only when the user asks to prepare or publish a PR. It includes Git operations such as rebase and push; an implementation request alone does not authorize those actions.
- For code review, follow the [repository review policy](../../../AGENTS.md#shared-ai-code-review) and keep the review read-only.
- Invoke a skill or slash command only when it is available in this Claude environment. Do not treat Claude commands as available to other agents.

## Use Claude controls accurately

- `.claude/commands/` provides `/feature` and `/ship`; `.claude/skills/` contains project Prisma skills; `.claude/rules/` applies file-scoped conventions.
- `.claude/skill-guide/` is an inventory of this user's global Claude skills and MCP setup, not a guarantee that another machine or harness has those tools installed.
- `.claude/settings.json` registers hooks for specific tool events. Follow a blocking hook and report the blocker; do not bypass it to force completion.
- Hooks are not proof that unrelated checks passed and do not protect every file or every command path. Inspect the final diff yourself.
- Use the repository's npm scripts from `package.json`; report only checks that actually ran.

## Finish

Before reporting completion, compare the result to the request, inspect the diff for unexpected files or deletions, and state actual checks, gaps, and remaining work.
