# GitHub Copilot Instructions

Follow root [`AGENTS.md`](../AGENTS.md) for repository conventions and policies.

For repository analysis, planning, implementation, documentation, Git, or GitHub tasks, follow [`docs/agents/execution-workflow.md`](../docs/agents/execution-workflow.md). Before a code review, follow the [repository review policy](../AGENTS.md#shared-ai-code-review) and keep the review read-only.

For Copilot-specific workflow in VS Code, follow [`docs/agents/workflows/copilot.md`](../docs/agents/workflows/copilot.md).

Use project skills from `.github/skills/`. File-scoped conventions are in `.github/instructions/`.
Follow [`AGENTS.md`](../AGENTS.md#agent-configuration-synchronization) when changing shared skills, rules, or hooks; run `npm run agents:check` before finishing.

Repository hooks are registered once in `.claude/settings.json`, which Copilot in VS Code runs through its Claude-compatible hook events. Do not add `.github/hooks/*.json`: those hooks would run a second time, and `agents:check` rejects them.
