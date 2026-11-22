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

REQUIRED=(
  "# Pull Request"
  "## 1. Type"
  "## 2. Summary"
  "## 3. Input / Output"
  "### Input"
  "### Output"
  "## 4. Changes"
  "## 5. Verification"
)
MISSING=()
for h in "${REQUIRED[@]}"; do
  [[ "$BODY" == *"$h"* ]] || MISSING+=("$h")
done
(( ${#MISSING[@]} )) && fail "missing sections: $(IFS='|'; echo "${MISSING[*]}")"

TICKED=$(grep -Ec '^- \[[xX]\] (feat|fix|refactor|perf|security|chore|docs|test|architecture)$' <<< "$BODY")
[[ "$TICKED" == 1 ]] || fail "tick exactly one Type checkbox (found $TICKED)"

AI_AGENT_NAMES='(claude|copilot|codex|chatgpt|openai|gpt|gemini|cursor|windsurf|cline|aider|devin|codeium|cody|tabnine|opencode|roo|continue|augment|replit|ai|agent|bot)'
grep -Eqi "co-authored-by:[[:space:]].*\\b$AI_AGENT_NAMES\\b|generated (by|with) .*\\b$AI_AGENT_NAMES\\b|ai-generated|noreply@anthropic\\.com" <<< "$BODY" \
  && fail "remove AI attribution line"

VERIFICATION=$(sed -n '/^## 5\. Verification$/,/^## 6\./p' <<< "$BODY")
grep -Eqi '^\- \[[xX]\] Code review: .+' <<< "$VERIFICATION" \
  || fail "run /code-review on the diff first and record its outcome under '## 5. Verification'"
grep -Eqi 'Code review:.*(chưa chạy|không chạy|bỏ qua|skip(ped)?|not run|pending)|((chưa|không) chạy).*Code review' <<< "$VERIFICATION" \
  && fail "Code review outcome says review was skipped or not run"

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