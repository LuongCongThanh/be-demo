---
paths:
  - 'src/**/*.ts'
---

# Error handling and logging (condensed — full rationale: docs/convention/error-logging-conventions.md)

- `AllExceptionsFilter` (global, `src/http/filters/all-exceptions.filter.ts`) is a **safety net for unexpected errors**, not the place to define domain errors. For known domain errors (duplicate unique values, referenced child records, business-rule violations, etc.), **throw explicitly in the service** using `NotFoundException`/`ConflictException`/etc. with a specific message; do not let them fall through to the filter. In modules covered by [module architecture](module-architecture.md) (new modules and migrated modules), follow that rule instead: `domain/` and `application/` throw the shared business errors from `src/common/errors/`.
- Error responses always use `{ statusCode, message, requestId }`. Prisma mappings: `P2002` → 409, `P2003` → 409, `P2025` → 404, all others → 500.
- Logging levels: the filter logs **`5xx` errors with `.error()` and a stack trace—do not log them again in the service**. Do not log **`4xx`** responses (normal business flow; logging adds noise). Log important business events with `.log()` through `new Logger(ClassName.name)`.
- **Never log secrets**: passwords, raw tokens (JWT/refresh/reset codes), or the `Authorization` header.
- The global `AppLogger` automatically adds `requestId` to every `Logger` call; **do not add it manually** to messages in new services.
- **Do not** use `try/catch` only to log and rethrow the same error (the filter already logs 5xx errors, so this duplicates logs). Use `try/catch` to (a) translate a lower-level error (for example, Prisma `P2002`) into a specific domain exception, or (b) handle an allowed-to-fail best-effort side effect (for example, sending email). In the latter case, **log explicitly before swallowing the error**; never fail silently.
- Unique/FK pre-checks before writing are only a **UX layer** for clear messages; they **do not replace** database unique/FK constraints. A race condition between the check and write is still possible.
