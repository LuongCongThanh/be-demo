#!/bin/bash
# enforce-pr-template.sh — gate `gh pr create`:
#   1. body follows required sections in .github/pull_request_template.md (exactly one Type)
#   2. /code-review outcome recorded under "## 5. Verification"
#   3. `npm run lint`, `typecheck`, `test` are green
#
# Why: GitHub only pre-fills the template in the web UI. `gh pr create --body/--fill` bypasses it,
# so PRs created by agents silently skipped the template and the pre-PR checks.
# Keep REQUIRED in sync with .github/workflows/pr-body.yml and the template headings.

HOOK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$HOOK_DIR/../.." && pwd)"
INPUT=$(cat)
if ! COMMAND=$(node "$REPO_ROOT/scripts/hooks/read-tool-command.js" <<< "$INPUT"); then
  echo "Blocked: could not read the Bash command from the hook payload" >&2
  exit 2
fi

# Only when `gh pr create` is actually invoked (start of command or after ; & | ( ), not merely mentioned
[[ "$COMMAND" =~ (^|[\;\&\|\(][[:space:]]*)gh[[:space:]]+pr[[:space:]]+create ]] || exit 0

TEMPLATE="$REPO_ROOT/.github/pull_request_template.md"
fail() {
  echo "Blocked: PR body must follow $TEMPLATE — $1. Copy the template to a file, keep required sections, remove sections that do not apply, then run: gh pr create --base dev --title \"<type>: ...\" --body-file <absolute path>" >&2
  exit 2
}

if [[ "$COMMAND" =~ [[:space:]](--fill|--fill-first|--fill-verbose|-f)([[:space:]]|$) ]]; then
  fail "--fill uses commit messages instead of the template"
fi

BODY=""
if [[ "$COMMAND" =~ [[:space:]](--body-file|-F)([[:space:]]+|=)(\"([^\"]+)\"|\'([^\']+)\'|([^[:space:]\;\&\|]+)) ]]; then
  FILE="${BASH_REMATCH[4]}${BASH_REMATCH[5]}${BASH_REMATCH[6]}"
  FILE="${FILE/#\~/$HOME}"
  [[ "$FILE" == "-" ]] && fail "--body-file - (stdin) cannot be validated; pass a real file path"
  [[ "$FILE" == *'$'* ]] && fail "use a literal path for --body-file (variables are not expanded by the hook)"
  [[ -f "$FILE" ]] || fail "body file '$FILE' not found (use an absolute path)"
  BODY=$(cat "$FILE")
elif [[ "$COMMAND" =~ [[:space:]](--body|-b)([[:space:]=]|\") ]]; then
  # Inline body (incl. heredoc): validate only the text after the body flag
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

# Build must be green (SKIP_PR_VERIFY=1 is only for testing this hook)
if [[ "$SKIP_PR_VERIFY" != 1 ]]; then
  cd "$REPO_ROOT" || exit 2
  for s in lint typecheck test; do
    if ! OUT=$(npm run -s "$s" 2>&1); then
      echo "Blocked: \`npm run $s\` failed — fix before opening the PR:" >&2
      tail -20 <<< "$OUT" >&2
      exit 2
    fi
  done
fi

exit 0
