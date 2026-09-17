## Agent skills

### Issue tracker

Issues live as GitHub Issues on this repo (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### API conventions (NestJS)

Single generic convention doc — flow for any API (CRUD or business/use-case), step-by-step CRUD walkthrough using a placeholder `Resource` entity (module/controller/service/DTO, Prisma migration, Swagger, testing), Definition of Done and checklist. Written for devs to read and write the code themselves, not as agent context for autogenerating code. See `doc/api-conventions.md`. Resource-specific business rules and real implementation status live in that resource's own plan doc (e.g. `doc/categories-module-plan.md`), not in this convention doc.
