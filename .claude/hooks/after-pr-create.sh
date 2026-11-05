#!/bin/bash
# after-pr-create.sh — PostToolUse: after `gh pr create` succeeds, make Claude watch CI and report it.

INPUT=$(cat)
COMMAND=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command||"")}catch{}})' <<< "$INPUT")

[[ "$COMMAND" =~ (^|[\;\&\|\(][[:space:]]*)gh[[:space:]]+pr[[:space:]]+create ]] || exit 0

cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"PR created. Required next step: run `gh pr checks <PR number> --watch` until all checks finish, then report each check's result to the user. If any check fails, investigate and fix it before saying the PR is done."}}
EOF
exit 0
