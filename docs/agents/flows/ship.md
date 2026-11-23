---
skills: [code-review, verification-before-completion, finishing-a-development-branch]
---

# Ship flow

The single definition of the `ship` workflow for every agent (Claude Code, Codex, GitHub Copilot). Agent entrypoints (`.agents/skills/ship/SKILL.md` and its mirrors) only point here; they must not add, drop, or reorder steps. See [ADR 0014](../../adr/0014-shared-agent-flow-native-adapters.md).

Follow [`docs/agents/execution-workflow.md`](../execution-workflow.md) and [`docs/convention/git-workflow.md`](../../convention/git-workflow.md).

## Authorization

Run this flow only when the user asks to ship, publish, or open a PR. That request authorizes the whole flow — verify, review, rebase onto `dev`, push, create the PR, and watch its checks — so do not ask again for each step. An implementation request, a review request, or "continue" alone authorizes none of it. Merging and branch deletion still need their own request.

Stop and report, without skipping or weakening a step, whenever a step fails.

## Step 1 — Confirm the branch and account

Run `git status` and check the current branch. Never ship from `main`, `master`, or `dev`; if no feature branch exists, ask for its name before creating one. Check `gh auth status` before any GitHub write and stop if the account is not the intended one.

## Step 2 — Verify

Run `npm run lint`, `npm run typecheck`, and `npm run test`, plus `npm run test:e2e` or `npm run build` when the change requires them. Apply `verification-before-completion`.

## Step 3 — Review: `code-review`

Review the diff against `dev` read-only, following the [repository review policy](../../../AGENTS.md#shared-ai-code-review). Stop on a serious unresolved finding and let the user decide whether to fix or accept it. Review happens before the rebase so review fixes do not force a second rebase.

## Step 4 — Rebase onto `dev`

`git fetch origin dev && git rebase origin/dev`. On conflicts, stop and let the user resolve them; never pick `--ours`/`--theirs` automatically. If the rebase changed code, repeat Step 2.

## Step 5 — Push

First push: `git push -u origin <branch>`. Rewritten branch: `git push --force-with-lease`, never `--force`.

## Step 6 — Create the PR

Read `.github/pull_request_template.md`, `.github/workflows/pr-title.yml`, and `.github/workflows/pr-body.yml`. Copy the template to a scratch file, keep the required sections, remove inapplicable optional ones, select exactly one type, and record the Step 3 outcome under `## 5. Verification`. Then `gh pr create --base dev --title <conventional title> --body-file <file>`; never `--fill`.

## Step 7 — Watch the checks

Confirm GitHub returned a PR number, run `gh pr checks <number> --watch`, and report the real results. Investigate a failure only within the authorized scope.

## Step 8 — After merge

When the user reports the merge (or `gh pr view --json state` returns `MERGED`) and asks for cleanup, use `finishing-a-development-branch` to delete the local and remote branches for the squash-merge flow.
