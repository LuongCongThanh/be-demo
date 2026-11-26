---
paths:
  - 'src/modules/**/*.ts'
  - 'src/infrastructure/**/*.port.ts'
---

# Module architecture (condensed — decision: docs/adr/0015-one-layered-architecture-for-every-module.md; decisions and rationale: docs/plan/wayfinding/src-wide-architecture-standard/map.md)

Every module in `src/modules` uses one Hexagonal architecture. No module is exempt.

## Migration status

Apply the full rule set to **new modules, new features, and modules listed as migrated**. In a module not yet migrated, keep small fixes consistent with that module's current structure and do not migrate it partially; its refactor happens in a dedicated task from `docs/plan/tasks/`.

Migrated modules: _none yet_ (each refactor PR adds its module here and to the lint boundary list).

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
- Inside one module, feature X may import only `domain/` and `presentation/` of feature Y; for Y's data, call Y's service.
- `common/`, `infrastructure/`, and `security/` never import `modules/`.

## File size

- Aim for about 150 lines per file; 200 lines (excluding blank lines and comments) is the hard limit enforced by `max-lines`. Split by responsibility. Generated code and test files are exempt; any other exception needs an in-file comment explaining why.

## Lint

- These rules are being moved into oxlint `no-restricted-imports`/`max-lines` overrides generated by `scripts/generate-oxlint-boundaries.ts` (planned; not in the repo yet). Once it exists, do not hand-edit the generated overrides in `oxlint.json`. Until then, review against this rule by hand. `src/common/errors/` and the `TransactionRunner` port are also planned; until they exist, unmigrated code keeps its current pattern.
