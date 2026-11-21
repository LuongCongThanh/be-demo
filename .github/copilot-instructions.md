# GitHub Copilot Instructions

Follow root [`AGENTS.md`](../AGENTS.md) for repository conventions and policies.

For repository analysis, planning, implementation, documentation, Git, or GitHub tasks, follow [`docs/agents/execution-workflow.md`](../docs/agents/execution-workflow.md). Before a code review, follow the [repository review policy](../AGENTS.md#shared-ai-code-review) and keep the review read-only.

For Copilot-specific workflow in VS Code, follow [`docs/agents/workflows/copilot.md`](../docs/agents/workflows/copilot.md).

Use project skills from `.github/skills/`. File-scoped conventions are in `.github/instructions/`.

The Copilot harness also reads `.claude/settings.json`; its hook definitions are intentionally shared there. Do not register duplicate copies in `.github/hooks/`.
