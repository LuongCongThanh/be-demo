# Codex Workflow

This is the Codex-specific entrypoint. Follow [`../execution-workflow.md`](../execution-workflow.md) for shared repository behavior.

## Load the right context

1. Read root `AGENTS.md` and any nested `AGENTS.md` that applies to changed files.
2. Read the relevant task, acceptance criteria, business rules, architecture docs, ADRs, and conventions before changing behavior.
3. Use repository scripts and configuration as the source of truth; for this repository, run npm scripts from `package.json`.

## Work with Codex capabilities

- Use only tools, skills, and subagents available in the active Codex environment. Check availability instead of assuming Claude slash commands or hooks can run.
- Project skills are in `.agents/skills/`; invoke `feature` for implementation workflows and `ship` only for an explicitly requested PR workflow.
- Every skill named by the shared flows is vendored in the repository, so Codex can call it by name. [The Claude skill guide](../../../.claude/skill-guide/) is a user-global inventory reference; it does not mean other global skills or MCP servers are available in Codex.
- `.codex/config.toml` configures project MCP servers, while `.codex/hooks.json` registers repo hooks. Review and trust project hooks in Codex before relying on them.
- Follow `AGENTS.md#agent-configuration-synchronization` when changing mirrored skills or hooks; run `npm run agents:watch` for live sync and `npm run agents:check` before finishing.
- For a code review, follow the [repository review policy](../../../AGENTS.md#shared-ai-code-review) and keep the review read-only.
- Continue through implementation and verification when implementation was requested. Stop only for a consequential unresolved decision, a blocker, or an operation that needs separate authorization.
- Treat GitHub writes, commits, pushes, rebases, merges, and PR creation as separate actions: perform them only when requested and follow `docs/convention/git-workflow.md`.

## Finish

Inspect the final diff for unrelated changes and unexpected deletions. Report what changed, the exact checks run, and anything blocked or incomplete.
