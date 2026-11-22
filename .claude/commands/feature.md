---
description: 'Discover → Specify → (Tickets) → Implement/TDD → Verify a feature or fix using the Matt Pocock skill family, then run /ship (Review → Ship). Use $ARGUMENTS as the request description.'
---

Follow the shared repository workflow in `AGENTS.md` and `docs/agents/execution-workflow.md`; this command adds Claude-specific skill routing.

`/feature` uses one skill family—**Matt Pocock** (`grill-with-docs → to-spec → to-tickets → implement → tdd`)—to keep state, artifacts, and naming consistent across phases. Do not mix in the Superpowers methodology. Reuse only **neutral utility skills** from Superpowers that do not compete with a phase: `using-git-worktrees`, `systematic-debugging`, `verification-before-completion`, and `subagent-driven-development`.

`/feature` does not replace `/ship`: `/feature` ends with "implemented + verified"; `/ship` starts with review.

## Escape hatch — engineering execution without new product behavior

If a task has **no new business rules or behavior to clarify** (for example, a mechanical refactor or repository-wide migration), do not force the full `/feature` pipeline. Use the quick path for a clear, local change; for a larger refactor, use `grill-with-docs` only if its goal or scope is unclear, then `to-spec` or `to-tickets` when the size warrants them, followed by `implement` and focused tests. Use `tdd` when behavior or regression risk warrants it. Do not mix in a competing skill family.

## Skill routing

| Situation                                                   | Skill                               |
| ----------------------------------------------------------- | ----------------------------------- |
| Understand the codebase and requirements before coding      | `mattpocock-skills:grill-with-docs` |
| Explore a broad area of existing code                       | `Explore` agent                     |
| Clarify domain rules, entities, or relationships            | `mattpocock-skills:domain-modeling` |
| Finalize the single source-of-truth spec                    | `mattpocock-skills:to-spec`         |
| Challenge a spec/draft before presenting it to the user     | `mattpocock-skills:grilling`        |
| Split large work into vertical-slice tickets                | `mattpocock-skills:to-tickets`      |
| Isolate work from the current working tree                  | `using-git-worktrees`               |
| Implement from a spec or ticket                             | `mattpocock-skills:implement`       |
| Write code using TDD                                        | `mattpocock-skills:tdd`             |
| Handle independent work by responsibility or vertical slice | `subagent-driven-development`       |
| Investigate unexpected technical/tooling failures           | `systematic-debugging`              |
| Diagnose a business bug with an unclear root cause          | `mattpocock-skills:diagnosing-bugs` |
| Verify before reporting completion                          | `verification-before-completion`    |

## Invariant

1. Do not research information already known.
2. Do not plan obvious or trivial work.
3. Do not code while unresolved ambiguity remains.
4. Do not split ownership of one vertical behavior across agents by layer or file type.
5. Do not claim completion without fresh verification evidence (lint/typecheck/tests actually passed).
6. Do not mix a competing skill family into a phase already covered by the primary family (for example, do not use Superpowers `writing-plans`/`executing-plans`/`test-driven-development`/`code-review` alongside Matt Pocock `to-spec`/`implement`/`tdd`/`code-review` in the same `/feature` flow).

## Step 0 — classify task size by blast radius, not line count

A small diff is not necessarily a quick task. Changing one line of `JWT_EXPIRES_IN`, CORS, rate limits, DB pool settings, or a feature flag can still be Medium because it changes behavior or security despite having few LOC.

- **Quick** — all conditions hold: requirements are completely clear; the change is local; it does not change public behavior, API contracts, database schema/data, auth/security/permissions; it does not affect many modules; and rollback is trivial.
  → Skip the full pipeline: write a minimal test if needed → change the code → run `npm run lint` and affected tests → report back and suggest `/ship`.
- **Medium** (one feature/fix in one session): `grill-with-docs → to-spec → worktree → implement/tdd → verify`.
- **Large** (multiple behaviors or sessions): run `to-tickets` after `to-spec`, create **one worktree for the entire feature** (not one per ticket), then process each ticket sequentially in that worktree: `implement/tdd → relevant focused/full verification → lightweight review → commit`. Finish with full-feature verification before `/ship`.

When task size is unclear, choose the branch with the stronger verification level for its blast radius. Ask the user only when an unknown affects behavior, scope, or a hard-to-reverse decision.

For Medium/Large tasks, proceed sequentially through the phases when implementation was requested. Stop to ask only when a consequential business/API/schema decision has multiple valid options, the request is planning/specification only, or an unsafe blocker/risk appears. Do not ask for permission again for implementation steps already included in the request.

### 1. Discover — `mattpocock-skills:grill-with-docs`

Goal: understand the task; do not code yet. Challenge business rules, API contracts, validation, database constraints, race conditions, test seams, and error handling. Consult `GLOSSARY.md`, `docs/adr/`, relevant sections under `docs/convention`, and `docs/<resource>-module-plan.md` when one exists.

For broad code exploration, use the `Explore` agent rather than reading indiscriminately.

**Exit criteria** — stop Discover after identifying: (1) current behavior, (2) relevant code paths, (3) applicable conventions, (4) relevant constraints/ADRs, (5) affected modules, and (6) unknowns that still block planning. If a blocking question remains, ask the user before Step 2.

### 2. Specify — `mattpocock-skills:to-spec`

`to-spec` is the **single source of truth for the plan**. Other skills in this phase may gather input or challenge it, but must not create competing plans.

- Finalize behavior, inputs/rules, success/failure cases, the smallest useful test seam (usually `*.service.ts` in NestJS), and out-of-scope items.
- If domain rules are unclear, use `mattpocock-skills:domain-modeling` before finalizing and incorporate its results into the spec.
- If a complex spec needs several rounds of user collaboration, use `doc-coauthoring` to write it as a document.
- Challenge a draft with `mattpocock-skills:grilling` (edge cases, incorrect assumptions) before presenting it to the user; update the spec directly.
- Do not modify production code during Discover/Specify. Use the harness's read-only/planning mode when available.

**Definition of Ready** — begin execution only when expected behavior and scope/out-of-scope are clear; affected modules/files and API/schema changes are identified; the migration strategy (if any) and test strategy are defined; edge cases are addressed in the spec; and the user has approved the spec or the original request clearly asks for implementation. Ask the user about missing consequential business decisions. Investigate technical details that can be derived from repository conventions instead of asking.

### 3. Slice (Large only) — `mattpocock-skills:to-tickets`

A ticket is a vertical slice/tracer bullet (one complete behavior across DB → service → API → tests), **not a layer-based split**. One ticket = one session = one vertical slice = one commit.

### 4. Isolate — `using-git-worktrees`

Isolate the work from the current working tree before implementation. Use **one worktree for the entire feature**, shared by all tickets (do not create a separate worktree for each ticket). Process tickets sequentially in that worktree, ending each ticket with its own commit.

### 5. Implement — `mattpocock-skills:implement` + `mattpocock-skills:tdd`

- Follow TDD: RED (make the test fail first; run only focused tests) → GREEN (minimum code; rerun focused tests) → REFACTOR (focused tests plus affected typechecks). Run the full suite only at the Step 6 gate; verify locally often and comprehensively at the gate.
- Test behavior/capability (for example, `it('rejects creating a category when slug already exists')`), not implementation details.
- Run typechecks and lint continuously for the scope being changed.
- For independent work, use `subagent-driven-development` and split by **responsibility or complete vertical slice** (research conventions, assess migration risks, implement a full slice, review a slice), **not by file type**. Do not assign separate agents to DTOs, tests, and services for one behavior; those pieces are tightly coupled and can drift in fields/names.
- For unexpected technical or behavior issues: use `systematic-debugging` when implementation/tests/tooling fail unexpectedly; use `mattpocock-skills:diagnosing-bugs` when the business/domain root cause is unclear.
- Write comments in English to explain why; keep code and runtime strings in English. Do not add abstractions or error handling outside the task scope.
- **Large tasks — at the end of each ticket**: run relevant focused/full verification, then briefly compare the work against the spec (behavior from Step 2, edge cases, and acceptance criteria). **Do not invoke `mattpocock-skills:code-review` here**; perform a quick self-check before committing and moving to the next ticket. Reserve the full code review for `/ship`.

### 6. Verify (comprehensive gate for the feature, not individual tickets)

- Always add unit tests for business logic/services. Add integration/API tests when touching the DB/HTTP layer. Add E2E tests only when the slice spans a multi-step business flow.
- Run `npm run lint && npm run typecheck && npm run test` (+ `npm run build` when required by convention).
- Before reporting completion, use `verification-before-completion`: require evidence that lint/typecheck/tests actually passed; do not rely on intuition.

After the entire feature is verified (one slice for Medium; all tickets in the same worktree for Large), report to the user and suggest `/ship`. Full review, rebase, and PR creation belong there and should not be repeated in `/feature`.

Note: Step 6 verification and `/ship` verification are separate states. After review fixes, rebase, or conflict resolution, `/ship` must verify again from scratch rather than reuse `/feature` results.

### 7. Remember (optional, after verification passes)

This is not a competing Matt Pocock phase and does not create a new plan/spec. Record only **surprising or non-obvious** findings from Discover/Specify/Implement in the existing memory system so future work does not repeat research, mistakes, or settled decisions. Examples: an easily misunderstood domain rule, a commonly misapplied convention, a user decision that differs from the initial assumption, or an unexpected bug root cause.

- If nothing surprising is worth recording, skip this step; do not create memory for obvious information.
- Otherwise, record one or two concise memories (`feedback` or `project`, depending on the content). Do not duplicate information already available from code, the spec, or git history.
