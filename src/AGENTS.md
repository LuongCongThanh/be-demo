# `src/` conventions

Codex entrypoint for file-scoped rules; the same rule files are applied by Claude Code (`.claude/rules/` `paths:`) and Copilot (`.github/instructions/` `applyTo`). Read the rules that match the files you change, then their canonical sources under `docs/conventions/`.

| Files                                                                                                                         | Rule                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Every `*.ts`                                                                                                                  | [coding style](../.claude/rules/coding-style.md)                 |
| Every `*.ts`                                                                                                                  | [config and environment](../.claude/rules/config-environment.md) |
| Every `*.ts`                                                                                                                  | [errors and logging](../.claude/rules/error-logging.md)          |
| `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.module.ts`, `*.guard.ts`, `*.decorator.ts`, `http/`, `security/`, `main.ts` | [API conventions](../.claude/rules/api-conventions.md)           |
| `*.service.ts` (Prisma Client usage)                                                                                          | [Prisma](../.claude/rules/prisma-schema.md)                      |
| `src/modules/**`, `src/infrastructure/**/*.port.ts`                                                                           | [module architecture](../.claude/rules/module-architecture.md)   |
