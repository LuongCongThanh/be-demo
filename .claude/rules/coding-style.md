---
paths:
  - 'src/**/*.ts'
  - 'test/**/*.ts'
---

# Coding style and naming (condensed — full rationale: docs/convention/coding-style-conventions.md)

- File names use kebab-case with role-based suffixes: `.module.ts`, `.controller.ts`, `.service.ts`, `.dto.ts`, `.guard.ts`, `.decorator.ts`, `.strategy.ts`, `.spec.ts`, and `.e2e-spec.ts`. Classes use matching PascalCase names.
- Split a module into subfolders (`dto/`, `guards/`, etc.) only when it has at least two files of the same role; keep small modules flat. Under [module architecture](module-architecture.md) (new and migrated modules), use its layer/surface layout instead, even for small modules.
- **Do not create barrel files** (`index.ts` re-exports). Import the actual file directly, including its `.js` extension for ESM. Barrels combined with NestJS DI (where class references are tokens) have caused "Nest can't resolve dependency" errors because a class was loaded twice through different references.
- **Always use the `#src/*` alias to import files under `src/`** (Node subpath imports declared in `package.json` under `imports`) from `src/**`, `*.spec.ts`, and `test/**`, including same-directory imports. Do not use relative imports into `src/` or `@src/*` (Node cannot resolve the latter at runtime). Exceptions: `src/generated/` and `test/support/`. Importing one class through two specifiers can make NestJS DI treat them as different classes; this may surface only during e2e tests or app startup.
- Do not add new `any` types (`no-explicit-any` currently warns, and `src/` currently has none). For dynamic types, use `unknown` with a type guard or a generic.
- Import external packages first, then internal modules.
- Keep files to about 150 lines; 200 lines (excluding blank lines and comments) is the hard limit, except generated code and test files. Split by responsibility. Module folder layout follows [module architecture](module-architecture.md).
