---
name: feature
description: Use when the user asks to implement a feature, behavior change, or bug fix. Carry the request through discovery, implementation, verification, and a concise completion report; trigger for `/feature` as well.
---

# Feature workflow

Follow [`docs/agents/execution-workflow.md`](../../../docs/agents/execution-workflow.md) and the active harness entrypoint: `docs/agents/workflows/codex.md` or `docs/agents/workflows/copilot.md`.

When the user says “continue” or “tiếp tục đi”, resume the first unfinished phase of the active request using the shared continuation rules. Do not restart completed phases or ask for settled requirements again.

## 1. Classify by risk

- **Quick:** behavior is clear, change is local, and it does not affect public contracts, data, security, permissions, or multiple modules. Implement directly and run focused tests plus relevant lint/typecheck.
- **Medium:** one behavior change in a session. Discover relevant rules and code, resolve consequential ambiguity, then implement with focused tests.
- **Large:** multiple behaviors or likely to span sessions. Write a spec, split into vertical behavior slices when useful, and implement them sequentially.

When uncertain, use the verification level appropriate to the larger blast radius. Do not ask the user to approve technical details that repository conventions can resolve.

## 2. Discover and specify

Before editing behavior, inspect the current implementation and read relevant task criteria, business rules, architecture, ADRs, and convention docs. Use `GLOSSARY.md` when domain language is unclear.

For behavior-changing work, establish the expected behavior, failure cases, scope, affected modules, and test strategy. Ask only when an unresolved choice materially changes behavior, scope, or a hard-to-reverse decision. If the user clearly requested implementation, continue through the remaining stages without asking for approval at each phase.

## 3. Implement

- Follow the repository's existing patterns and preserve unrelated work in the working tree.
- Prefer focused tests that describe observable behavior. Use RED → GREEN → REFACTOR when it improves confidence.
- Keep work divided by complete behavior slices, not by file type.
- Use only skills and subagents available in the active Codex environment. If a named skill is unavailable, perform its relevant steps directly rather than pretending it ran.
- Do not commit, push, rebase, merge, or open a PR unless the user separately requested that Git/GitHub operation.

## 4. Verify and finish

Run the smallest relevant tests during implementation. Before reporting a completed feature, run `npm run lint`, `npm run typecheck`, and `npm run test`; add `npm run build` or `npm run test:e2e` when the affected code requires them.

Inspect the final diff for scope, accidental changes, and missing tests. Report the exact commands and results, remaining gaps, and whether the request is complete. Never claim a check passed unless it actually ran and passed.
