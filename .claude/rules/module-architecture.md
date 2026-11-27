---
paths:
  - 'src/modules/**/*.ts'
  - 'src/infrastructure/**/*.port.ts'
---

# Module architecture (condensed — canonical standard: docs/convention/module-architecture-conventions.md; code quality: docs/convention/code-quality-conventions.md; decision: docs/adr/0015-one-layered-architecture-for-every-module.md)

Every module in `src/modules` uses one Hexagonal architecture. No module is exempt. This file is the short form for agents; when it and the convention documents differ, the convention documents win, so fix this file.

## Migration status

Apply the full rule set to **new modules, new features, and modules listed as migrated**. In a module not yet migrated, keep small fixes consistent with that module's current structure and do not migrate it partially; its refactor happens in a dedicated task from `docs/plan/tasks/`.

Migrated modules: `inventory`, `voucher` (each refactor PR adds its module here and to the lint boundary list).

## Folder layout (create a folder only when it has a file)

- `domain/`: pure business rules, constants, and Domain Models declared as plain `type`/`interface` (no classes with behavior, no NestJS, no Prisma).
- `application/`: services/use cases and `ports/`. Do not repeat `application/` inside surface folders.
- `infrastructure/`: Prisma adapters (`prisma-<name>.repository.ts`) and other technology adapters.
- `presentation/`: HTTP pieces used by both surfaces (strategy, interceptor, a DTO whose meaning is identical for both).
- `admin/` (the Back-office surface, not the Admin role) and `storefront/`: only `controllers/`, `dto/`, `mappers/`, and surface-specific guards.
- `<module>.module.ts`. A multi-feature module (`catalog`) repeats the layout inside each feature. Only Category splits Core/Admin/Storefront Nest modules.

## Ports and DI

- Services never use `PrismaService` or `#src/generated/**`. All database access goes through a Persistence Port; by default one port per feature, split only when a port serves unrelated use-case groups.
- Declare a port as an `abstract class` used as both type and DI token: `constructor(private readonly carts: CartRepository) {}`, bound with `{ provide: CartRepository, useExisting: PrismaCartRepository }` in the module. Do not add `Symbol` tokens or `@Inject(TOKEN)`.
- Ports never expose Prisma types; adapters map Prisma records to Domain Models.
- Mail, Storage, AuditLog, and Idempotency use one shared port next to their code in `src/infrastructure/` (`*.port.ts`); modules do not wrap them again. I/O owned by one module (for example Google `OAuth2Client`) gets a port in that module's `application/ports/`. Pure in-process libraries (`JwtService` signing) need no port.

## Errors

- `domain/` and `application/` throw only the shared business errors from `src/common/errors/` (`NotFoundError`, `ConflictError`, `InvalidInputError`, `UnprocessableError`, `UnauthenticatedError`, `ForbiddenError`) or subclasses; `AllExceptionsFilter` maps them to HTTP. Keep the existing status codes and messages.
- `admin/`, `storefront/`, and `presentation/` (controllers, guards, strategies) may throw NestJS HTTP exceptions.
- The filter keeps mapping Prisma errors as a safety net; an adapter catches a Prisma error only to raise a specific business message.

## Transactions

- Services open a transaction with the project's `TransactionRunner` port: `await this.transactionRunner.run(async () => { ... })`. Adapters join the active transaction automatically (implemented with `@nestjs-cls/transactional` inside `infrastructure/` only).
- Do not pass `tx` through ports, do not use `@Transactional()` in services, and do not import `nestjs-cls` outside `infrastructure/`.
- A nested `run()` joins the outer transaction.
- Never send mail, upload files, or call external providers inside `run()`; do it after commit or through the outbox (ADR-0003).
- Row locks (`SELECT ... FOR UPDATE`) live in the adapter of the module that owns the table; callers request them with `{ lockForUpdate: true }`.

## Boundaries between modules and features

- Only the owning module writes or reads its tables (ownership matrix: `docs/architecture/02-modules.md` §2).
- Module A may import from module B only `#src/modules/<b>/<b>.module.js` and B's single public class `#src/modules/<b>/application/<b>.service.js`. Public classes contain only methods other modules need, return plain types, and are the only provider B exports for business use.
- Allowed call direction: checkout → catalog, inventory, voucher, identity; cart → catalog, inventory, identity; catalog → inventory; inventory and voucher call no business module.
- Inside one module, feature X may import only `domain/`, `presentation/` and `application/<y>.service.ts` (Y's public service) of feature Y; never Y's `ports/`, `infrastructure/` or other `application/` files.
- `common/`, `infrastructure/`, and `security/` never import `modules/`.

## File size

- Aim for about 150 lines per file; 200 lines (excluding blank lines and comments) is the hard limit enforced by `max-lines`. Split by responsibility. Generated code and test files are exempt; any other exception needs an in-file comment explaining why.

## Lint

- The rules are enforced by oxlint `no-restricted-imports`/`max-lines` overrides in `oxlint.json`, generated by `scripts/generate-oxlint-boundaries.ts`. Never hand-edit `oxlint.json`: change the script, run `npm run lint:boundaries`, and CI checks it with `npm run lint:boundaries:check`.
- Rules 1-6 apply only to modules listed in `MIGRATED_MODULES` in that script. A module-refactor PR adds its module there and to "Migrated modules" above. Rule 7 (`max-lines` 200, no relative imports) applies to all of `src/`; `MAX_LINES_TEMPORARY_EXEMPT` lists files still to be split, and a split PR removes its file.
- oxlint overrides replace each other (only the last matching one counts) and all patterns of one rule share a single gitignore matcher, so a `!` in one pattern re-includes matches of the others. The generator handles both; the probes in `scripts/oxlint-boundaries/` prove each rule (`npx vitest run scripts/oxlint-boundaries`).

## Shared pieces that already exist (task 39)

- `src/common/errors/business-errors.ts` (the six business errors) and `AllExceptionsFilter` mapping them.
- `TransactionRunner` (`src/infrastructure/database/transaction-runner.port.ts`, `run(work, opts?)` with `isolationLevel`/`timeout`/`maxWait`), implemented with `nestjs-cls` in `infrastructure/database/`.
- Shared ports: `MailSender`, `ImageStorage`, `AuditLog`, `IdempotencyStore` (`*.port.ts` next to their adapters). No business module uses them yet; unmigrated code keeps its current pattern until its own refactor task.
