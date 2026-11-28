---
paths:
  - 'src/**/*.ts'
---

# Config and environment (condensed — full rationale: docs/conventions/config-environment-conventions.md)

- **Never read `process.env.X` directly** in `src/`. Always use `ConfigService.get()`/`getOrThrow()`, including when a class extending another class needs a value before `super()` (pass it through the constructor; `this.config` is not available until after `super()`).
- Name variables with `UPPER_SNAKE_CASE` and group prefixes (`JWT_*`, `SMTP_*`, etc.). Express durations as `ms`-compatible strings (`15m`, `7d`), not bare seconds or milliseconds.
- **Every new variable must be declared** in `src/config/env.validation.ts` (`class-validator`). Make it required (no `@IsOptional()`) when the app cannot run correctly without it; otherwise make it optional (`@IsOptional()`) and set a default where `config.get()` is called.
- Variables used only by scripts outside the NestJS lifecycle (for example, `POSTMAN_API_KEY`) do not belong in `EnvironmentVariables`; load them from `.env` separately with `dotenv`.
- **Add every new variable to `.env.example` in the same PR**, leaving its value blank and adding a comment when useful.
- Never commit `.env` files or real secrets, including in comments, commit messages, or sample code. A leaked secret is a security incident; rotate it immediately.
