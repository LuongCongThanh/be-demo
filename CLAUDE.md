## Agent skills

### Issue tracker

Issues live as GitHub Issues on this repo (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Conventions (coding style, config, error handling, API, schema)

Top-down index and reading order for all convention docs: `docs/convention`.

### API conventions (NestJS)

Single generic convention doc — flow for any API (CRUD or business/use-case), step-by-step CRUD walkthrough using a placeholder `Resource` entity (module/controller/service/DTO, Prisma migration, Swagger, testing), Definition of Done and checklist. Written for devs to read and write the code themselves, not as agent context for autogenerating code. See `docs/convention`. Resource-specific business rules and real implementation status live in that resource's own plan doc (e.g. `docs/categories-module-plan.md`), not in this convention doc.

### Config & environment conventions

Naming, required-vs-optional env vars, startup fail-fast validation (`src/config/env.validation.ts`), `.env.example` sync rule, and secrets handling. See `docs/convention`.

### Coding style & naming conventions

File/class naming, folder structure per module, barrel files banned, `@src/*` import alias scoped to test files only (never in runtime `src/` code — see the doc for the two DI-breaking bugs that forced this scope), `no-explicit-any` lint rule, when to split large files. See `docs/convention`.

### Error handling & logging conventions

Global `AllExceptionsFilter` (`src/common/filters/all-exceptions.filter.ts`) unifying HttpException/Prisma/unexpected-error responses, log-level policy (log 5xx only, never 4xx), request-id tracing via `AsyncLocalStorage` + `AppLogger` (auto-injected into every existing `Logger` call site, no code changes needed at call sites). See `docs/convention`.

### Prisma schema convention

Step-by-step guide for writing `schema.prisma` for the 15-table ecommerce domain (enums, table order, relations, migrations) and using Prisma Client in NestJS (CRUD, transactions, pagination, N+1). See `docs/convention`.
