---
skills:
  [
    grill-with-docs,
    grilling,
    domain-modeling,
    to-spec,
    to-tickets,
    implement,
    tdd,
    codebase-design,
    diagnosing-bugs,
    systematic-debugging,
    subagent-driven-development,
    verification-before-completion,
  ]
---

# Feature flow

The single definition of the `feature` workflow for every agent (Claude Code, Codex, GitHub Copilot). Agent entrypoints (`.agents/skills/feature/SKILL.md` and its mirrors) only point here; they must not add, drop, or reorder steps. See [ADR 0014](../../adr/0014-shared-agent-flow-native-adapters.md).

Follow [`docs/agents/execution-workflow.md`](../execution-workflow.md) for scope, preserving existing work, verification, and the completion report. This flow ends at "implemented + verified"; publishing is the separate [ship flow](ship.md).

Every skill named below is vendored in `.agents/skills/` and mirrored to `.github/skills/` and `.claude/skills/`, so every agent can invoke it by the same name. Do not substitute a user-global skill for a step.

Some vendored skills mention skills that are not vendored (for example `superpowers:*`, `using-git-worktrees`, `writing-plans`). Ignore those references and stay on this flow's step; never create, switch to, or remove a Git worktree unless the user asks (`AGENTS.md#git-worktree-policy`).

## Invariants

1. Do not research what is already known, and do not plan obvious work.
2. Do not code while a consequential ambiguity remains.
3. Do not split one vertical behavior across agents by layer or file type.
4. Do not claim completion without fresh verification evidence.
5. "Continue" resumes the first unfinished step; it never authorizes Git or GitHub writes.
6. Do not mix a competing skill family (for example Superpowers `writing-plans`/`executing-plans`/`test-driven-development`) into a phase this flow already covers.

## Step 0 — Classify by blast radius, not line count

A one-line change to `JWT_EXPIRES_IN`, CORS, rate limits, pool sizes, or a feature flag is still Medium: it changes behavior or security.

- **Quick** — requirements are fully clear, the change is local, and it does not touch public behavior, API contracts, schema/data, auth/security/permissions, or several modules. Skip to Step 4: minimal test if needed → change → `npm run lint` and the affected tests → report.
- **Medium** — one behavior in one session: Steps 1 → 2 → 4 → 5.
- **Large** — several behaviors or sessions: Steps 1 → 2 → 3 → 4 (per ticket) → 5.

**Refactors with no new behavior** (a mechanical refactor, a repository-wide migration) do not need the full pipeline: take the Quick path when clear and local; otherwise run Step 1 only if the goal or scope is unclear, then Step 2 or 3 as the size warrants, and Step 4 with focused tests (`tdd` when regression risk warrants it).

When the size is unclear, take the branch with the stronger verification. When implementation was requested, move through the steps without asking for approval at each one; stop only for a consequential business/API/schema decision with several valid options, a planning-only request, or an unsafe blocker.

## Step 1 — Discover: `grill-with-docs`

Understand the task; do not change production code. Challenge business rules, API contracts, validation, database constraints, races, test seams, and error handling against `GLOSSARY.md`, `docs/adr/`, `docs/business/`, `docs/architecture/`, and `docs/convention/`. Use the agent's read-only exploration subagent for broad code searches when it has one.

Exit when you know the current behavior, relevant code paths, conventions, constraints/ADRs, affected modules, and any unknowns that block planning. Ask about a blocking unknown before Step 2.

## Step 2 — Specify: `to-spec`

`to-spec` is the single source of truth for the plan; nothing else in this step writes a competing plan.

- Fix behavior, inputs/rules, success and failure cases, the smallest useful test seam (usually a `*.service.ts`), and what is out of scope.
- Unclear domain rules → `domain-modeling`, folded back into the spec.
- Challenge the draft with `grilling` before presenting it, and update the spec directly.
- Do not modify production code during Steps 1–2; use the agent's read-only or planning mode when it has one.

**Definition of Ready:** behavior and scope are clear; affected modules, API/schema changes, migration strategy, and test strategy are identified; edge cases are in the spec; and the user approved the spec or the request clearly asked for implementation.

## Step 3 — Slice (Large only): `to-tickets`

A ticket is one vertical slice (DB → service → API → tests), never a layer. One ticket = one session = one commit. Work tickets sequentially on the same branch; do not create a Git worktree unless the user asks (see `AGENTS.md#git-worktree-policy`).

## Step 4 — Implement: `implement` + `tdd`

- RED → GREEN → REFACTOR with focused tests; run typecheck and lint for the changed scope as you go. Consult `codebase-design` when the seam or interface itself is in question.
- Test observable behavior (`it('rejects creating a category when slug already exists')`), not implementation details.
- Independent work → `subagent-driven-development`, split by responsibility or whole vertical slice, never by file type.
- Unexpected tooling/test/implementation failure → `systematic-debugging`. Unclear business/domain root cause → `diagnosing-bugs`.
- Comments explain why, in English; no abstractions or error handling beyond the task.
- Large only — at the end of each ticket: focused verification plus a quick self-check against the spec, then commit when commits were requested. The full code review belongs to the ship flow.

## Step 5 — Verify (gate for the whole feature)

- Unit tests for business logic; integration/API tests when touching DB/HTTP; E2E only for multi-step business flows.
- Run `npm run lint && npm run typecheck && npm run test`, plus `npm run build` or `npm run test:e2e` when the change requires them.
- Inspect the final diff for scope, accidental changes or deletions, and missing tests.
- Apply `verification-before-completion`: report only checks that actually ran, with their real results.

Report what changed, the checks run, and remaining gaps, then offer the ship flow. The ship flow re-verifies from scratch; it never reuses these results.

## Step 6 — Remember (optional)

Record only surprising, non-obvious findings (a misread domain rule, a user decision that contradicted the first assumption, an unexpected root cause) in the agent's persistent memory, if it has one. Skip when nothing qualifies.
