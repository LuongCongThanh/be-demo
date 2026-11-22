# Claude Code Instructions

Follow root [`AGENTS.md`](AGENTS.md) for repository conventions, task execution, code review, Git, and GitHub operations. For Claude-specific tool, command, and hook behavior, follow [`docs/agents/workflows/claude.md`](docs/agents/workflows/claude.md).

## Triage labels

Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` as the canonical triage state labels. See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

## Agent configuration

Follow the [shared agent configuration synchronization policy](AGENTS.md#agent-configuration-synchronization). Run `npm run agents:watch` while editing mirrored skills or hooks; keep Claude settings and commands in their native format.
