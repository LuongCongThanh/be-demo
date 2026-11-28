# `prisma/` conventions

Codex entrypoint for file-scoped rules; the same rule file is applied by Claude Code (`.claude/rules/` `paths:`) and Copilot (`.github/instructions/` `applyTo`).

Before changing the schema, migrations, or `seed.ts`, read the [Prisma rules](../.claude/rules/prisma-schema.md), the canonical [Prisma conventions](../docs/conventions/prisma-conventions.md), and the target schema in [`docs/architecture/11-database.md`](../docs/architecture/11-database.md).
