---
name: ship
description: Use only when the user explicitly asks to prepare, publish, or open a pull request. An implementation request by itself does not authorize rebasing, pushing, or creating a PR.
---

# Ship workflow

Follow [`docs/agents/execution-workflow.md`](../../../docs/agents/execution-workflow.md), the active harness entrypoint (`docs/agents/workflows/codex.md` or `copilot.md`), and [`docs/convention/git-workflow.md`](../../../docs/convention/git-workflow.md).

## 1. Confirm the intended operation

Check `git status`, the current branch, and the active GitHub account with `gh auth status` before account-sensitive actions. Do not publish from `main`, `master`, or `dev`. If the target branch, base branch, or account is unclear, ask before writing to GitHub.

Treat commit, rebase, push, PR creation, and branch deletion as separate operations. Perform only the operations the user explicitly requested; a request to review or prepare changes is not authorization to publish them.

## 2. Verify and review

Run `npm run lint`, `npm run typecheck`, and `npm run test`; run `npm run test:e2e` or `npm run build` when relevant. Stop and report any failure instead of skipping or weakening the check.

Before opening a PR, follow the [repository review policy](../../../AGENTS.md#shared-ai-code-review) and perform a read-only review against the requested base. Report actionable findings; stop for a serious unresolved finding.

## 3. Prepare the PR

Read `.github/pull_request_template.md`, `.github/workflows/pr-title.yml`, and `.github/workflows/pr-body.yml`. Preserve every required heading and field, write `N/A` for inapplicable content, select exactly one PR type, and record the actual code-review outcome in `## 💬 12. Notes`.

Use an allowed Conventional Commit title and validate the body against the repository workflow. Never use `--fill` in place of the required template.

## 4. Publish and close

Rebase onto `dev` only when the user requested that operation. Stop on conflicts and ask the user to resolve them. Push rewritten branches only with `--force-with-lease`, never `--force`. Create the PR only when requested, using the repository template and target base.

After creation, verify that GitHub returned a PR number, then run `gh pr checks <number> --watch` and report the actual results. If a check fails, report it and investigate only within the authorized scope. Delete a branch only after the PR is merged and the user requested cleanup.
