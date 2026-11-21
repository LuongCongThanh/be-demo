#!/bin/bash
# after-pr-create.sh — PostToolUse: verify PR creation before watching CI.

HOOK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$HOOK_DIR/../.." && pwd)"
INPUT=$(cat)
if ! COMMAND=$(node "$REPO_ROOT/scripts/hooks/read-tool-command.js" <<< "$INPUT"); then
  exit 2
fi

[[ "$COMMAND" =~ (^|[\;\&\|\(][[:space:]]*)gh[[:space:]]+pr[[:space:]]+create ]] || exit 0

MESSAGE="A \`gh pr create\` command was attempted. First verify that it succeeded and obtain the PR number; only then run \`gh pr checks <PR number> --watch\` until all checks finish, and report each result. If creation failed, report the actual error instead of treating the PR as created."
node -e 'let m=process.argv[1];console.log(JSON.stringify({additionalContext:m,hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:m}}))' "$MESSAGE"
exit 0
