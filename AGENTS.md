## Agent skills

### Git, worktree, commit, and PR preflight

Before `git commit`, `git push`, `git worktree`, or `gh pr create`, read:

- `docs/convention/git-workflow.md`
- `.github/pull_request_template.md`
- Run `npm run git-policy:test`

### Matt Pocock skill artifacts

For Matt Pocock planning/spec/report/retro/handoff skills, follow the output format defined by the invoked skill. This repository does not maintain a shared Matt Pocock artifact template.

For repository analysis, planning, implementation, documentation, Git, or GitHub tasks, follow [`docs/agents/execution-workflow.md`](docs/agents/execution-workflow.md). It is the source of truth for scope, preserving existing work, verification, and completion reports.

When using Codex, also follow [`docs/agents/workflows/codex.md`](docs/agents/workflows/codex.md). Other agents should follow their platform-specific workflow when one is configured.

### Natural-language skill routing and continuation

Apply this routing to ordinary prompts; the user does not need to type a slash command. If the user says “continue”, “tiếp tục đi”, “go on”, or similar, resume the latest active request at its first unfinished phase. Use the conversation and current worktree as state; do not restart completed phases or ask the user to repeat settled requirements.

- Unclear requirements or behavior → `grill-with-docs`.
- Requirements clarified but a medium/large change still needs a single spec → `to-spec`.
- A large change needs several vertical slices → `to-tickets`.
- Implementation is authorized and ready → `implement`, using `tdd` for behavior-changing work.
- A refactor is requested → first preserve the existing behavior and classify its scope. For a clear, local refactor, use the quick execution path; use `implement` and focused tests for larger changes, adding `tdd` when behavior or regression risk warrants it. Use `grill-with-docs`/`to-spec` only when the goal or scope is genuinely unclear or consequential.
- A bug has an unclear technical root cause → `diagnosing-bugs`.
- A code review is requested → `code-review`, subject to the read-only policy below.
- Implementing a feature, behavior change, or fix → the `feature` skill, which runs [`docs/agents/flows/feature.md`](docs/agents/flows/feature.md).
- An explicitly requested PR → the `ship` skill, which runs [`docs/agents/flows/ship.md`](docs/agents/flows/ship.md). “Continue” alone never authorizes GitHub writes.
- NestJS modules, controllers, providers, dependency injection, guards, security, or performance → `nestjs-best-practices`.
- Prisma CLI, schema validation/formatting, client generation, migration commands, or migration status → `prisma-cli`. Treat `prisma-database-setup` as a legacy compatibility pointer; use current CLI guidance for actual commands.
- Prisma Client CRUD, filters, relations, transactions, or raw SQL → `prisma-client-api`.
- Vitest tests, mocks, coverage, configuration, or test selection → `vitest`.
- Docker Compose services, health checks, dependency order, volumes, networks, environment, or overrides → `docker-compose-patterns`.
- API authentication/authorization or OWASP API security review → `api-security-review` for read-only code/spec review. Active testing requires explicit authorization and a scoped, controlled test environment.
- Ambiguous domain terms, entity boundaries, or relationships → `domain-modeling`, with `docs/agents/domain.md` for this repository's layout.

Continue the current skill if its phase is still unresolved; otherwise select the next unfinished phase. Skip phases already completed, and skip the full pipeline for quick, well-specified work. If there is no active request, or multiple plausible requests to continue, ask one focused question. Invoke a named skill only if the active agent actually has it; otherwise follow the equivalent repository workflow and do not claim the skill was invoked.

### Issue tracker

Work is tracked as local Markdown tasks in `docs/plan/` (not GitHub Issues). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Specialized routing

- NestJS modules, controllers, providers, dependency injection, guards, security, or performance -> `nestjs-best-practices`.
- Prisma CLI, schema validation/formatting, client generation, migration commands, or migration status -> `prisma-cli`. Treat `prisma-database-setup` as a legacy compatibility pointer.
- Prisma Client CRUD, filters, relations, transactions, or raw SQL -> `prisma-client-api`.
- Vitest tests, mocks, coverage, configuration, or test selection -> `vitest`.
- Docker Compose services, health checks, dependency order, volumes, networks, environment, or overrides -> `docker-compose-patterns`.
- API authentication/authorization or OWASP API security review -> `api-security-review` for read-only review.
- Ambiguous domain terms, entity boundaries, or relationships -> `domain-modeling`, with `docs/agents/domain.md` for this repository's layout.

### Conventions (coding style, config, error handling, API, schema)

Top-down index and reading order for all convention docs: `docs/convention`.

### API conventions (NestJS)

Two docs: `api-rules.md` (flow for any API — CRUD or business/use-case — plus rules, Definition of Done, checklists) and `api-crud-walkthrough.md` (step-by-step CRUD code using a placeholder `Resource` entity, CLI appendix). Written for devs to read and write the code themselves, not as agent context for autogenerating code. See `docs/convention`. Resource-specific business rules and real implementation status live in that resource's own plan doc (`docs/architecture/modules/<module>.md`), not in this convention doc.

### Config & environment conventions

Naming, required-vs-optional env vars, startup fail-fast validation (`src/config/env.validation.ts`), `.env.example` sync rule, and secrets handling. See `docs/convention`.

### Coding style & naming conventions

File/class naming, folder structure per module, barrel files banned, `#src/*` import alias (Node subpath imports) for every import into `src/` — never relative, never `@src/*` (see the doc for why), `no-explicit-any` lint rule, when to split large files. See `docs/convention`.

### Error handling & logging conventions

Global `AllExceptionsFilter` (`src/http/filters/all-exceptions.filter.ts`) unifying HttpException/Prisma/unexpected-error responses, log-level policy (log 5xx only, never 4xx), request-id tracing via `AsyncLocalStorage` + `AppLogger` (auto-injected into every existing `Logger` call site, no code changes needed at call sites). See `docs/convention`.

### Prisma schema convention

Schema/migration/Prisma Client rules (naming & mapping, hand-written SQL migrations, safe schema changes, transactions & row locks, pagination, N+1, seeding, testing) in `docs/convention/prisma-conventions.md`. Target schema itself lives in `docs/architecture/11-database.md`. See `docs/convention`.

### Docs layout

Index: `docs/README.md`. Business requirements (`docs/business/`) take priority over `docs/architecture/`, `docs/architecture/11-database.md` and `docs/adr/` when they conflict.

## Agent configuration synchronization

Shared repository policy lives in this file and `docs/agents/` / `docs/convention/`; platform files are entrypoints or adapters. Edit the shared source instead of duplicating a rule in a platform file.

- `.agents/skills/` is canonical for every project skill, mirrored byte-for-byte to `.github/skills/` (Copilot) and `.claude/skills/` (Claude Code); Codex reads `.agents/skills/` directly. Vendored skills are pinned in `skills-lock.json` and must not be edited locally.
- `feature` and `ship` are defined once in `docs/agents/flows/`; their entry skills only point there. A shared flow may name only skills vendored in `.agents/skills/`, and no agent keeps a private copy of a flow (for example a Claude `.claude/commands/` file). See [ADR 0014](docs/adr/0014-shared-agent-flow-native-adapters.md).
- `.claude/hooks/` is canonical for the byte-for-byte `.codex/hooks/` mirror. Claude Code and Copilot in VS Code both run them from `.claude/settings.json`; Codex runs the mirror from `.codex/hooks.json`. Do not add `.github/hooks/*.json` (Copilot would run every hook twice). `scripts/hooks/hook-parity.spec.ts` checks that all three agents reach the same allow/block decision for the same action.
- `.claude/settings.json`, `.codex/config.toml`, hook registries, and `.github/instructions/` keep their native formats. Do not copy agent-specific permissions, MCP servers, or settings such as `.claude/settings.local.json` between agents.
- Run `npm run agents:watch` to propagate a single edit in a mirrored file immediately. If two copies of that file change differently, the watcher stops with a conflict; resolve it and run `npm run agents:sync -- --from <mirror-root>` to choose the intended copy. `npm run agents:sync -- --force` explicitly overwrites target files from the canonical source. `npm run agents:check` detects drift, and `npm run agents:test` verifies sync and conflict behavior.
- The pre-commit hook and CI run `agents:check`; CI also runs `agents:test`. This enforces mirrored-file, hook-registration, and shared-flow consistency, not every natural-language decision made by an agent.

## Shared AI Code Review

Whenever any agent is asked to review code, including by a slash skill such as `/code-review`, or by phrases such as "review code", "review this PR", "review this branch", "review since X", or "review the current diff":

1. Perform a read-only review.
2. Follow this section as the repository review policy; use the invoked review skill's report format unless it conflicts with this policy.
3. If a code-review skill or sub-agent is used, apply this section alongside its Standards/Spec workflow. Repository policy overrides the skill where they conflict.
4. Read the relevant Task/User Story and acceptance criteria under `docs/plan/`, applicable business rules, architecture docs, ADRs and conventions.
5. Prioritize correctness, security, data integrity, module boundaries, regressions and compatibility.
6. Report only actionable findings backed by exact code and diff evidence.
7. Separate confirmed defects from verification gaps.
8. Do not edit, create, delete, commit, push, merge or rebase during review.

## Git Worktree Policy

Agents MUST NOT create, add, remove, or switch to a new Git worktree unless the user explicitly requests it or confirms after being asked. A request to create a separate branch or PR does not imply permission to create a worktree. Prefer the current checkout; if its state makes the task unsafe, explain the constraint and ask before isolating the work. Never remove an existing worktree unless the user explicitly requests removal.

## Git Commit Identity & AI Attribution Policy

All AI agents MUST NOT identify themselves in Git commit metadata or commit messages.

Prohibited:

- AI/tool/agent names in subjects, bodies, footers or tags.
- AI attribution trailers such as `Co-authored-by`, `Generated-by`, `Assisted-by`, `Reviewed-by` or equivalents.
- AI-specific author/committer metadata or changing the authorized human identity.

Required:

- Follow Conventional Commits.
- Describe the actual code change, not the tool used.
- Preserve the authorized human Git identity.
- Ask before committing if the authorized identity is unclear.
