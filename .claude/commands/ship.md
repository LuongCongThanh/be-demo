---
description: Run the complete pre-PR workflow — verify, rebase, review, push, and create a PR (see docs/convention/git-workflow.md and .claude/rules/git-workflow.md)
---

Follow the shared repository workflow in `docs/agents/execution-workflow.md`; this command adds Claude-specific GitHub operations.

Run these steps in order. If any step fails, stop and report it; do not skip it or weaken conventions to force it to pass.

1. **Verify the branch**: run `git status` and `git rev-parse --abbrev-ref HEAD`. If the branch is `main` or `dev`, stop and report the issue. Do not create a branch without the user's confirmation of its name.
2. **Definition of Done — before rebasing**: run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e` if the branch changes affect e2e. Stop and report any failure.
3. **Code review**: invoke the `code-review` skill on the diff against `dev` using the default effort level (or the level specified in `$ARGUMENTS`). If there are severe findings, stop and report them so the user can decide whether to fix or accept them.
4. **Rebase onto `dev`**: run `git fetch origin dev && git rebase origin/dev`. If conflicts occur, stop and let the user resolve them; do not choose `--theirs` or `--ours` automatically.
5. **Push**: if the branch has previously been pushed, use `git push --force-with-lease` (never `--force`); otherwise use `git push -u origin <branch>`.
6. **Create the PR**: run `gh pr create` targeting `dev` with squash merge. **Use `.github/pull_request_template.md`**: copy it to a scratch file, preserve required sections, remove inapplicable optional sections, select exactly one Type, then run `gh pr create --base dev --title ... --body-file <file>`. Do not use `--fill`. Record the `/code-review` outcome under `## 5. Verification`. `.claude/hooks/enforce-pr-template.sh` blocks missing required sections, anything other than one selected Type, a missing code-review outcome, or failing lint/typecheck/tests. After PR creation, `after-pr-create.sh` requires `gh pr checks <n> --watch` and reports the result.
7. **After the PR is merged** (the user reports it, or `gh pr view --json state` returns `MERGED`): remind the user or invoke `finishing-a-development-branch` to delete local and remote branches according to the completed merge flow (squash into `dev`).

Notes:

- Do not skip Steps 2 or 3, even when the user is in a hurry. This is why `/ship` exists instead of manually entering Git commands.
- Run code review (Step 3) before rebasing (Step 4) to avoid rebasing again if review requires code changes; this follows the "catch issues early" principle in `.claude/rules/git-workflow.md`.
- `$ARGUMENTS`, if provided, sets the code-review effort level (`low`/`medium`/`high`/`xhigh`/`max`). By default, use the effort level most recently used by the `code-review` skill.
