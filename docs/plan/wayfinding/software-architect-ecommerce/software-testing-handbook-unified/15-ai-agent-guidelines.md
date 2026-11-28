# High-Quality Testing Guidelines for AGENTS.md / CLAUDE.md

**Trạng thái:** Nháp (tài liệu tham khảo).

Write production-grade tests that detect real defects. Never write tests solely to increase coverage.

## Before implementation

- Read requirements, business rules, acceptance criteria and existing architecture.
- Identify ambiguity, dependencies, failure modes and business/technical risks.
- Create a traceability and scenario matrix; choose the appropriate test layer.
- Evaluate happy, negative, boundary, equivalence, edge, decision table, state transition, authorization, concurrency, transaction, rollback, idempotency, retry and fault injection scenarios.

## Implementation

- Follow FIRST and AAA or Given–When–Then. Test observable behavior, not implementation details.
- Use descriptive names, parameterized tests, factories and fixtures.
- Avoid excessive mocks; use real infrastructure for integration when practical.
- Isolate data; control time and randomness; avoid arbitrary sleeps.
- Assert meaningful business outcomes, persisted state, forbidden changes and side effects.
- Derive expected results independently from production logic.
- Never weaken assertions, disable tests, lower thresholds or change production behavior merely to make an incorrect test pass.
- Follow repository conventions; do not introduce tools or architectural changes without justification.

## Validation

- Execute relevant tests; report exact commands and actual results.
- Analyze line/branch coverage, requirement coverage and mutation results for critical logic.
- Investigate flaky tests and surviving mutants; add regression tests for confirmed defects.
- Record untested scenarios, blockers, assumptions and N/A reasons. Never claim unexecuted tests passed.

## Deliverables

Requirement analysis; risk assessment; scenario matrix; test implementation; execution evidence; coverage; mutation report when applicable; remaining risks; recommendations.

## Prompt

Analyze the selected feature against the repository specification. Produce a risk-based test plan before implementation. Apply the master checklist and Definition of Done in this handbook. Implement tests at the appropriate layers, run them, demonstrate fault detection where practical, and report evidence and remaining risks. Do not optimize for coverage alone.

## Prompt theo nhiệm vụ

- Write tests: Analyze requirements and risks, inspect existing tests, select the lowest effective layer, propose cases and expected results, implement only approved scope, run tests and report evidence.
- Review tests: Inspect assertions, isolation, mocks, boundaries, failure modes and duplication. Cite files and lines; distinguish confirmed defects from hypotheses.
- Optimize tests: Inventory risk coverage, identify redundant cases, propose merge/replace/remove with evidence of preserved protection; do not delete tests without approval.
- Audit: See [full audit prompt](16-ai-audit-prompt.md).
