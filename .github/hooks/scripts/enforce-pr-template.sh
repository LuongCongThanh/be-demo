#!/bin/bash
HOOK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$HOOK_DIR/../../.." && pwd)"
INPUT=$(cat)

deny() {
  node -e 'console.log(JSON.stringify({permissionDecision:"deny",permissionDecisionReason:process.argv[1]}))' "$1"
  exit 0
}

if ! COMMAND=$(node "$REPO_ROOT/scripts/hooks/read-tool-command.js" <<< "$INPUT"); then
  deny "Blocked: could not read the command from the hook payload"
fi

[[ "$COMMAND" =~ (^|[\;\&\|\(][[:space:]]*)gh[[:space:]]+pr[[:space:]]+create ]] || {
  echo '{"permissionDecision":"allow"}'
  exit 0
}

TEMPLATE="$REPO_ROOT/.github/pull_request_template.md"
fail() {
  deny "Blocked: PR body must follow $TEMPLATE — $1. Copy the template to a file, keep required sections, remove sections that do not apply, then run: gh pr create --base dev --title \"<type>: ...\" --body-file <absolute path>"
}

if [[ "$COMMAND" =~ [[:space:]](--fill|--fill-first|--fill-verbose|-f)([[:space:]]|$) ]]; then
  fail "--fill uses commit messages instead of the template"
fi

BODY=""
if [[ "$COMMAND" =~ [[:space:]](--body-file|-F)([[:space:]=]+|=)(\"([^\"]+)\"|\'([^\']+)\'|([^[:space:]\;\&\|]+)) ]]; then
  FILE="${BASH_REMATCH[4]}${BASH_REMATCH[5]}${BASH_REMATCH[6]}"
  FILE="${FILE/#\~/$HOME}"
  [[ "$FILE" == "-" ]] && fail "--body-file - (stdin) cannot be validated; pass a real file path"
  [[ "$FILE" == *'$'* ]] && fail "use a literal path for --body-file (variables are not expanded by the hook)"
  [[ -f "$FILE" ]] || fail "body file '$FILE' not found (use an absolute path)"
  BODY=$(cat "$FILE")
elif [[ "$COMMAND" =~ [[:space:]](--body|-b)([[:space:]=]|\") ]]; then
  BODY="${COMMAND#*"${BASH_REMATCH[0]}"}"
else
  fail "no --body/--body-file given"
fi
BODY=$(tr -d '\r' <<< "$BODY")
POLICY_FILE=$(mktemp)
printf '%s' "$BODY" > "$POLICY_FILE"
if ! POLICY_OUTPUT=$(node "$REPO_ROOT/scripts/git-policy.mjs" pr "$POLICY_FILE" 2>&1); then
  rm -f "$POLICY_FILE"
  fail "$POLICY_OUTPUT"
fi
rm -f "$POLICY_FILE"

if [[ "$SKIP_PR_VERIFY" != 1 ]]; then
  cd "$REPO_ROOT" || deny "Blocked: failed to cd into $REPO_ROOT"
  for s in lint typecheck test; do
    if ! OUT=$(npm run -s "$s" 2>&1); then
      TAIL_OUT=$(tail -20 <<< "$OUT")
      deny "Blocked: \`npm run $s\` failed — fix before opening the PR:\n$TAIL_OUT"
    fi
  done
fi

echo '{"permissionDecision":"allow"}'
exit 0