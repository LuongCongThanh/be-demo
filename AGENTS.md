## Agent skills

### Issue tracker

Work is tracked as local Markdown tasks in `docs/plan/` (not GitHub Issues). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Conventions (coding style, config, error handling, API, schema)

Top-down index and reading order for all convention docs: `docs/convention`.

### API conventions (NestJS)

Two docs: `api-rules.md` (flow for any API — CRUD or business/use-case — plus rules, Definition of Done, checklists) and `api-crud-walkthrough.md` (step-by-step CRUD code using a placeholder `Resource` entity, CLI appendix). Written for devs to read and write the code themselves, not as agent context for autogenerating code. See `docs/convention`. Resource-specific business rules and real implementation status live in that resource's own plan doc (`docs/architecture/modules/<module>.md`), not in this convention doc.

### Config & environment conventions

Naming, required-vs-optional env vars, startup fail-fast validation (`src/config/env.validation.ts`), `.env.example` sync rule, and secrets handling. See `docs/convention`.

### Coding style & naming conventions

File/class naming, folder structure per module, barrel files banned, `#src/*` import alias (Node subpath imports) for every import into `src/` — never relative, never `@src/*` (see the doc for why), `no-explicit-any` lint rule, when to split large files. See `docs/convention`.

### Error handling & logging conventions

Global `AllExceptionsFilter` (`src/common/filters/all-exceptions.filter.ts`) unifying HttpException/Prisma/unexpected-error responses, log-level policy (log 5xx only, never 4xx), request-id tracing via `AsyncLocalStorage` + `AppLogger` (auto-injected into every existing `Logger` call site, no code changes needed at call sites). See `docs/convention`.

### Prisma schema convention

Schema/migration/Prisma Client rules (naming & mapping, hand-written SQL migrations, safe schema changes, transactions & row locks, pagination, N+1, seeding, testing) in `docs/convention/prisma-conventions.md`. Target schema itself lives in `docs/architecture/11-database.md`. See `docs/convention`.

### Docs layout

Index: `docs/README.md`. Business requirements (`docs/business/`) take priority over `docs/architecture/`, `docs/architecture/11-database.md` and `docs/adr/` when they conflict.

## Shared AI Code Review

Whenever any agent is asked to review code, including by slash skill such as `/mattpocock-skills:code-review`, or by phrases such as "review code", "review this PR", "review this branch", "review since X", or "review the current diff":

1. Perform a read-only review.
2. Read and follow `docs/ai/code-review.md`; it is the single source of truth for review workflow, severity and report format.
3. If a code-review skill or sub-agent is used, load this repository file before review and merge it with the skill's Standards/Spec workflow. Repository policy overrides the skill where they conflict.
4. Read the relevant Task/User Story and acceptance criteria under `docs/plan/`, applicable business rules, architecture docs, ADRs and conventions.
5. Prioritize correctness, security, data integrity, module boundaries, regressions and compatibility.
6. Report only actionable findings backed by exact code and diff evidence.
7. Separate confirmed defects from verification gaps.
8. Do not edit, create, delete, commit, push, merge or rebase during review.

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
