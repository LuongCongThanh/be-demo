## Agent skills

### Issue tracker

Work is tracked as local Markdown tasks in `docs/plan/` (not GitHub Issues). See `docs/agents/issue-tracker.md`.

### Triage labels

Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` as the canonical triage state labels. See `docs/agents/triage-labels.md`.

### Pull requests

Before creating or editing a PR, read `.github/pull_request_template.md` and `.github/workflows/pr-title.yml` plus `.github/workflows/pr-body.yml`. Use the repository template headings and required Vietnamese fields verbatim; fill every placeholder, check exactly one type, and include every required checklist section. The title must follow Conventional Commits and use a type allowed by `pr-title.yml`. Keep the body factual: report only validations actually run, describe gaps and rollout risks, and mark non-applicable API/config items as `Không` or `N/A`. Verify the title and body against the workflow requirements before publishing.

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

Global `AllExceptionsFilter` (`src/http/filters/all-exceptions.filter.ts`) unifying HttpException/Prisma/unexpected-error responses, log-level policy (log 5xx only, never 4xx), request-id tracing via `AsyncLocalStorage` + `AppLogger` (auto-injected into every existing `Logger` call site, no code changes needed at call sites). See `docs/convention`.

### Prisma schema convention

Schema/migration/Prisma Client rules (naming & mapping, hand-written SQL migrations, safe schema changes, transactions & row locks, pagination, N+1, seeding, testing) in `docs/convention/prisma-conventions.md`. Target schema itself lives in `docs/architecture/11-database.md`. See `docs/convention`.

### Docs layout

Index: `docs/README.md`. Business requirements (`docs/business/`) take priority over `docs/architecture/`, `docs/architecture/11-database.md` and `docs/adr/` when they conflict.

## Shared AI Code Review

For every code review, including `/mattpocock-skills:code-review`, read and follow `docs/ai/code-review.md` before reviewing. Merge it with the skill's Standards/Spec workflow; repository policy and severity/format rules win conflicts. Apply it to PRs, branches, commits, working-tree diffs, file reviews and "review since X". Do not modify files or automatically fix findings during a review.

## Git Commit Identity & AI Attribution Policy

Do not identify any AI tool or agent in commit subjects, bodies, footers, tags or author/committer metadata. Do not add AI attribution trailers or change the authorized human identity. Use Conventional Commits and describe the code change itself.
