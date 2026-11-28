# Templates và AI agent

## Requirement traceability

| Requirement ID | Rule                                   | Risk | Test ID      | Layer               | Evidence  | Status       |
| -------------- | -------------------------------------- | ---- | ------------ | ------------------- | --------- | ------------ |
| BR-STOCK-01    | Không oversell nếu không cho backorder | P0   | INVENTORY-01 | Real DB integration | Chưa chạy | Not assessed |

## Test case template

ID / title / requirement / risk / preconditions / test data / Given / When / Then / side effects / forbidden effects / cleanup / layer / evidence / owner.

## Audit report

Scope, architecture, assumptions, inventory, traceability, missing/weak/duplicate tests, assertion and mock review, executed commands and results, coverage/mutation/flaky metrics, quality score, gates, P0–P3 findings, roadmap, remaining risks.

## Prompt (Claude Code / Codex)

```text
Act as an e-commerce software quality architect. Read repository requirements and architecture first. Identify storefront, admin, backend, persistence, payment, inventory, shipping and other applicable modules. Build a requirement-risk-test matrix and verify financial, inventory, authorization and state invariants. Audit existing tests for missing scenarios, weak assertions, unrealistic mocks, duplication and flakiness. Select the lowest effective layer. Run tests only in safe isolated environments; never use live payments or production customer data. Report actual commands, results, file references, unknowns and N/A rationale. Score the 15 dimensions and report critical gates separately. Do not modify code during audit. Propose P0–P3 additions, improvements, merges and removals with evidence. Do not invent requirements or metrics.
```

Implementation follow-up: obtain approval for plan; write failing regression where possible; implement tests with independent expected results; run targeted and regression suite; report limitations. Never weaken assertions or skip failures just to pass.
