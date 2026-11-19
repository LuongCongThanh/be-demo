# GitHub Copilot Instructions

Follow repository-wide instructions in `AGENTS.md`.

## Shared AI Code Review

For code reviews:

- Apply repository review rules to PRs, branches, commits, working-tree diffs, file reviews and requests such as "review this code" or "review since X".
- Read and follow `docs/ai/code-review.md`.
- If the Matt Pocock code-review skill is invoked, load `docs/ai/code-review.md` before the review and combine it with the skill's Standards/Spec workflow.
- Repository policy, severity and report format override skill instructions when they conflict.
- Inspect relevant Task, User Story, business rules, ADR, architecture and conventions.
- Report only actionable findings backed by code evidence.
- Separate confirmed defects from verification gaps.
- Perform read-only review; do not edit or automatically fix files.

## Pull Requests

- Read `.github/pull_request_template.md` and the PR title/body workflows.
- Use the repository template headings and required Vietnamese fields verbatim.
- Fill factual evidence; do not mark a check as pass unless it was run successfully.
- Use Conventional Commits and a title type allowed by `.github/workflows/pr-title.yml`.

## Git Commit Identity & AI Attribution Policy

Do not identify any AI tool or agent in commit subjects, bodies, footers, tags or metadata. Do not add AI attribution trailers or change the authorized human identity.
