#!/bin/bash
# enforce-pr-template.sh — gate `gh pr create`:
#   1. body follows .github/pull_request_template.md (sections present, Summary filled, exactly one Type)
#   2. /code-review outcome recorded under "## 💬 Notes"
#   3. `npm run lint`, `typecheck`, `test` are green
#
# Why: GitHub only pre-fills the template in the web UI. `gh pr create --body/--fill` bypasses it,
# so PRs created by agents silently skipped the template and the pre-PR checks.
# Keep REQUIRED in sync with .github/workflows/pr-body.yml and the template headings.

INPUT=$(cat)
COMMAND=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command||"")}catch{}})' <<< "$INPUT")

# Only when `gh pr create` is actually invoked (start of command or after ; & | ( ), not merely mentioned
[[ "$COMMAND" =~ (^|[\;\&\|\(][[:space:]]*)gh[[:space:]]+pr[[:space:]]+create ]] || exit 0

TEMPLATE=".github/pull_request_template.md"
fail() {
  echo "Blocked: PR body must follow $TEMPLATE — $1. Copy the template to a file, fill every section (write \"Không\" for empty items, never delete sections), then run: gh pr create --base dev --title \"<type>: ...\" --body-file <absolute path>" >&2
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

REQUIRED=(
  "# 🏷️ Type"
  "## 📌 Summary"
  "**Làm gì:**"
  "**Vì sao:**"
  "**Giải pháp:**"
  "**Kết quả:**"
  "## 📋 Changes"
  "## 🔌 API / Migration / Cấu hình"
  "## 🧪 Cách kiểm"
  "## ⚠️ Gap và lưu ý"
  "## ✅ Checklist"
  "## 💬 Notes"
)
MISSING=()
for h in "${REQUIRED[@]}"; do
  [[ "$BODY" == *"$h"* ]] || MISSING+=("$h")
done
(( ${#MISSING[@]} )) && fail "missing sections: $(IFS='|'; echo "${MISSING[*]}")"

# Summary fields must be filled, not left as template placeholders
grep -Eq '^\*\*(Làm gì|Vì sao|Giải pháp|Kết quả|Module):\*\*[[:space:]]*(<!--|$)' <<< "$BODY" \
  && fail "Summary fields (Làm gì / Vì sao / Giải pháp / Kết quả / Module) still hold template placeholders"

# Exactly one Type must be ticked
TICKED=$(grep -Ec '^- \[[xX]\] (✨ Feature|🐛 Bug|♻️ Refactor|🧹 Chore|📚 Docs)[[:space:]]*$' <<< "$BODY")
[[ "$TICKED" == 1 ]] || fail "tick exactly one Type checkbox (found $TICKED)"

# No AI attribution (same rule as enforce-git-workflow.sh)
grep -Eqi "co-authored-by:[[:space:]]*(claude|chatgpt|gpt|ai)|generated (by|with) \[?claude|ai-generated" <<< "$BODY" \
  && fail "remove AI attribution line"

# /code-review must have been run on the diff: record its outcome under Notes
grep -qi 'code-review' <<< "${BODY#*## 💬 Notes}" \
  || fail "run /code-review on the diff first and record its outcome under '## 💬 Notes' (e.g. 'code-review: 3 findings, all fixed')"

# Build must be green (SKIP_PR_VERIFY=1 is only for testing this hook)
if [[ "$SKIP_PR_VERIFY" != 1 ]]; then
  cd "${CLAUDE_PROJECT_DIR:-.}" || exit 2
  for s in lint typecheck test; do
    if ! OUT=$(npm run -s "$s" 2>&1); then
      echo "Blocked: \`npm run $s\` failed — fix before opening the PR:" >&2
      tail -20 <<< "$OUT" >&2
      exit 2
    fi
  done
fi

exit 0
