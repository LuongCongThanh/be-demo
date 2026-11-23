# GitHub Copilot Workflow

This is the Copilot-specific entrypoint. Follow [`../execution-workflow.md`](../execution-workflow.md) for shared repository behavior.

## Load the right context

1. Follow `.github/copilot-instructions.md` and root `AGENTS.md`.
2. Read the relevant task, acceptance criteria, business rules, architecture docs, ADRs, and conventions before changing behavior.
3. Use repository scripts and configuration as the source of truth; for this repository, run npm scripts from `package.json`.

## Work in VS Code

- Use only tools and skills available in the active Copilot surface. Do not assume Claude slash commands or Claude-only skills are available; the shared hook behavior is the explicit compatibility exception below.
- Project skills are in `.github/skills/`; file-scoped conventions are in `.github/instructions/`. Invoke `feature` for implementation workflows and `ship` only for an explicitly requested PR workflow.
- Repository hooks come only from `.claude/settings.json`, which Copilot in VS Code reads through its Claude-compatible events (snake_case `tool_input`, Claude tool names such as `Bash`, `Edit`, `Write`). Do not add `.github/hooks/*.json`; they would run every check twice, and `agents:check` rejects them. This setup covers Copilot in VS Code; the cloud Copilot coding agent reads only `.github/hooks/` and therefore runs no repository hooks. Open the repository root as the workspace so the hook commands can resolve it with Git.
- Hooks read commands through `scripts/hooks/read-tool-command.js` and file paths through `scripts/hooks/read-tool-paths.js`, which accept every agent's payload shape. `scripts/hooks/hook-parity.spec.ts` (run by `npm run agents:test`) proves Claude, Codex, and Copilot payloads get the same allow/block decision; keep it passing when changing hooks.
- Every skill named by the shared flows is vendored in the repository, so Copilot can call it by name. [The Claude skill guide](../../../.claude/skill-guide/) is a user-global inventory reference; it does not mean other global skills or MCP servers are available in Copilot.
- For code review, follow the [repository review policy](../../../AGENTS.md#shared-ai-code-review) and keep the review read-only.
- When implementation is requested, complete it and verify it rather than stopping at a plan. Ask only for a consequential unresolved decision, blocker, or separately authorized operation.
- Before GitHub writes or Git operations that publish or rewrite history, verify the intended account and follow `docs/convention/git-workflow.md`.
- The PR title/body workflows run in GitHub Actions; report their results only after CI returns them.

## Finish

Inspect the final diff for unrelated changes and unexpected deletions. Report what changed, the exact checks run, and anything blocked or incomplete.
