#!/bin/bash
# enforce-pr-template.sh — gate `gh pr create`:
#   1. body follows .github/pull_request_template.md (sections present, Summary filled, exactly one Type)
#   2. /code-review outcome recorded under "## 💬 12. Notes"
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
  echo "Blocked: PR body must follow $TEMPLATE — $1. Copy the template to a file, fill every section (write \"N/A\" for items that do not apply; never delete sections), then run: gh pr create --base dev --title \"<type>: ...\" --body-file <absolute path>" >&2
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
  "# Pull Request"
  "## 🏷️ 1. Type"
  "## 📌 2. Summary"
  "### 2.1. Làm gì?"
  "### 2.2. Vì sao?"
  "### 2.3. Giải pháp"
  "### 2.4. Kết quả thực tế"
  "### 2.5. Scope & Traceability"
  "## 📋 3. Changes"
  "## 🔌 4. API Contract"
  "## 🗄️ 5. Database / Migration / Configuration"
  "## 🧪 6. Testing & Verification"
  "## 🔒 7. Security / Performance / Data Integrity"
  "## ⚠️ 8. Gap / Risks / Reviewer Attention"
  "## 🚀 9. Deployment / Rollback"
  "## 🏛️ 10. Architecture / Documentation"
  "## ✅ 11. Definition of Done"
  "## 💬 12. Notes"
  "## 📖 Project References"
)
MISSING=()
for h in "${REQUIRED[@]}"; do
  [[ "$BODY" == *"$h"* ]] || MISSING+=("$h")
done
(( ${#MISSING[@]} )) && fail "missing sections: $(IFS='|'; echo "${MISSING[*]}")"

# Summary headings and body must be retained
SUMMARY=$(sed -n '/^## 📌 2\. Summary$/,/^---$/p' <<< "$BODY")
for marker in "### 2.1. Làm gì?" "### 2.2. Vì sao?" "### 2.3. Giải pháp" "### 2.4. Kết quả thực tế"; do
  grep -Fq "$marker" <<< "$SUMMARY" || fail "missing summary heading: $marker"
done

# Exactly one Type must be ticked
TICKED=$(grep -Ec '^- \[[xX]\] (✨ Feature|🐛 Bug Fix|♻️ Refactor|⚡ Performance|🔒 Security|🧹 Chore|📚 Documentation|🧪 Test|🏗️ Architecture)' <<< "$BODY")
[[ "$TICKED" == 1 ]] || fail "tick exactly one Type checkbox (found $TICKED)"

# No AI attribution (same rule as enforce-git-workflow.sh)
AI_AGENT_NAMES='(claude|copilot|codex|chatgpt|openai|gpt|gemini|cursor|windsurf|cline|aider|devin|codeium|cody|tabnine|opencode|roo|continue|augment|replit|ai|agent|bot)'
grep -Eqi "co-authored-by:[[:space:]].*\\b$AI_AGENT_NAMES\\b|generated (by|with) .*\\b$AI_AGENT_NAMES\\b|ai-generated|noreply@anthropic\\.com" <<< "$BODY" \
  && fail "remove AI attribution line"

# /code-review must have been run on the diff: record its outcome under Notes
grep -qi 'code-review' <<< "${BODY#*## 💬 12. Notes}" \
  || fail "run /code-review on the diff first and record its outcome under '## 💬 12. Notes' (e.g. 'code-review: 3 findings, all fixed')"
grep -Eqi 'code-review.*(chưa|không chạy|bỏ qua|skip|not run)|(chưa|không) chạy.*code-review' <<< "${BODY#*## 💬 12. Notes}" \
  && fail "Notes say /code-review was not run — run it on the diff and record the real outcome"

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
