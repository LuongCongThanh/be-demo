# Repository Task Workflow

Use this workflow for repository analysis, planning, implementation, documentation, Git, and GitHub tasks.

## Continue from a natural-language prompt

“Continue”, “tiếp tục đi”, “go on”, and similar prompts resume the latest active request at its first unfinished phase. Use the conversation and worktree as state; do not restart a completed phase or ask the user to repeat settled requirements.

Route the continuation through the current phase: unresolved requirements → `grill-with-docs`; clarified medium/large work that needs a spec → `to-spec`; large work needing vertical slices → `to-tickets`; authorized implementation → `implement` and `tdd` for behavior changes; verification → run the outstanding checks. Continue an unresolved discovery/spec phase before moving forward. Do not treat “continue” as permission for a commit, push, rebase, merge, or PR. If no active request exists or the continuation target is ambiguous, ask one focused question.

Use the named Matt Pocock skill when it is available in the active agent. If it is unavailable, perform the corresponding steps in this workflow without claiming that the skill ran. Skip completed phases and the full pipeline for quick, well-specified work.

## 1. Understand the request

- Classify the request as review, explanation, plan, or implementation. If implementation is requested, complete it rather than stopping after a plan.
- Before any code review and before opening a PR, follow the [repository review policy](../../AGENTS.md#shared-ai-code-review). Treat it as the single source of truth; do not duplicate its checklist here.
- Identify the requested outcome, scope, and evidence that will prove completion. Use repository instructions and conventions to resolve routine details; ask only when a consequential choice remains ambiguous.

### Preflight for ambiguous or consequential work

- Before a multi-step, high-impact, irreversible, or unclear task, give the user a concise understanding brief before changing files: goal, relevant context and authoritative sources, inputs/data, one correct example when it clarifies expected behavior, in-scope and out-of-scope work, assumptions or open decisions, and observable completion criteria.
- State what is intentionally not being changed and what remains on hold. For unresolved consequential decisions, ask focused questions and wait for confirmation before acting.
- For a clear, low-risk task, restate the request in one sentence and proceed without an extra approval round. Pause only if inspection reveals a material conflict or missing decision.
- Carry forward a relevant context summary, not the entire conversation. Separate verified facts from assumptions, and describe “done” by its acceptance checks rather than an estimated time.

## 2. Inspect before changing

- Read applicable `AGENTS.md` files, the relevant task or acceptance criteria, and the conventions for the files being changed.
- Check `git status` and the existing diff before editing. Treat pre-existing and untracked work as user-owned: preserve it, keep it out of the task, and never overwrite, revert, or include it accidentally.
- Before deleting or replacing content, verify that the request or accepted task requires it. If that is unclear, ask first.

## 3. Execute to completion

- Make the smallest change that satisfies the full requested scope.
- For implementation requests, continue through the requested documentation and verification steps. If blocked, state the precise blocker and what remains; do not report the task as complete.
- For multi-step work, give brief progress updates at meaningful phase changes. Report an agent as running only after verifying its status.
- Reply in the user's language. For project documents, preserve the file's existing language unless asked to change it.

## 4. Verify the result

- Compare the final diff with the request. Confirm every requested outcome is addressed and there are no unrelated edits or unexpected deletions.
- Run the smallest relevant checks. Report only commands actually run and their actual results; identify skipped checks and why.
- For PR creation or editing, read `.github/pull_request_template.md`, `.github/workflows/pr-title.yml`, and `.github/workflows/pr-body.yml`. Preserve required headings and fields, use an allowed Conventional Commit title, and validate the final body against the workflow. Never claim a check passed if it was not run.
- Before account-sensitive GitHub actions, verify the active account and use the one the user specified. Ask if the intended account is unclear.

## 5. Close the task clearly

Report what changed, what was verified, and any remaining gap or blocker. Say the work is incomplete whenever a requested outcome remains unfinished.

## Agent skill packaging

The Prisma Agent Skills are mirrored byte-for-byte in `.claude/skills/`, `.agents/skills/`, and `.github/skills/` so each harness discovers them natively. `.agents/skills/` is canonical; `.claude/skills/` contains only the mirrored Prisma skills, while `feature` and `ship` are Claude-native commands. Run `npm run agents:sync` when mirrors are already consistent; it reports divergent or target-only edits without changing them. Use `npm run agents:sync -- --from <mirror-root>` to explicitly choose a mirror as the source, or `npm run agents:sync -- --force` to overwrite/remove target files from the canonical source. Run `npm run agents:check` to detect drift, or `npm run agents:watch` to propagate a single edit while it runs. `.claude/hooks/` is canonical for the byte-for-byte `.codex/hooks/` mirror; GitHub hook scripts are platform-specific adapters and their registrations are checked instead of copied. Native settings, hook registries, commands, and file-scoped instructions keep their own formats; place cross-agent policy in `AGENTS.md` and the shared docs linked from it. The `feature` and `ship` workflows are native slash skills for Codex and Copilot and native commands for Claude. User-global inventories under `.claude/skill-guide/` describe one machine's installation and are not project-wide availability guarantees.
