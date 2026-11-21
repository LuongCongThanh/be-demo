# Repository Task Workflow

Use this workflow for repository analysis, planning, implementation, documentation, Git, and GitHub tasks.

## 1. Understand the request

- Classify the request as review, explanation, plan, or implementation. If implementation is requested, complete it rather than stopping after a plan.
- Before any code review and before opening a PR, follow the [repository review policy](../../AGENTS.md#shared-ai-code-review). Treat it as the single source of truth; do not duplicate its checklist here.
- Identify the requested outcome, scope, and evidence that will prove completion. Use repository instructions and conventions to resolve routine details; ask only when a consequential choice remains ambiguous.

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

The Prisma Agent Skills are mirrored byte-for-byte in `.claude/skills/`, `.agents/skills/`, and `.github/skills/` so each harness discovers them natively. Keep those copies synchronized when updating a shared skill; compare the directories after changes. The `feature` and `ship` workflows are native slash skills for Codex and Copilot and native commands for Claude. User-global inventories under `.claude/skill-guide/` describe one machine's installation and are not project-wide availability guarantees.
