#!/bin/bash
# enforce-pr-template.sh — block `gh pr create` unless the body follows .github/pull_request_template.md
#
# Why: GitHub only pre-fills the template in the web UI. `gh pr create --body/--fill` bypasses it,
# so PRs created by agents silently skipped the template. This hook makes it mandatory.

INPUT=$(cat)
COMMAND=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command||"")}catch{}})' <<< "$INPUT")

[[ "$COMMAND" != *"gh pr create"* ]] && exit 0

TEMPLATE=".github/pull_request_template.md"
fail() {
  echo "Blocked: PR body must follow $TEMPLATE — $1. Copy the template to a file, fill every section (write \"Không\" for empty items, never delete sections), then run: gh pr create --base dev --title \"<type>: ...\" --body-file <file>" >&2
  exit 2
}

if [[ "$COMMAND" =~ (^|[[:space:]])(--fill|--fill-first|--fill-verbose|-f)([[:space:]]|$) ]]; then
  fail "--fill uses commit messages instead of the template"
fi

BODY=""
if [[ "$COMMAND" =~ (--body-file|-F)[[:space:]=]+[\"\']?([^\"\'[:space:]]+) ]]; then
  FILE="${BASH_REMATCH[2]}"
  [[ "$FILE" == "-" ]] && fail "--body-file - (stdin) cannot be validated; pass a real file path"
  [[ -f "$FILE" ]] || fail "body file '$FILE' not found"
  BODY=$(cat "$FILE")
elif [[ "$COMMAND" == *"--body"* || "$COMMAND" =~ (^|[[:space:]])-b[[:space:]] ]]; then
  # Inline body (incl. heredoc): validate against the full command text
  BODY="$COMMAND"
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
)
MISSING=()
for h in "${REQUIRED[@]}"; do
  [[ "$BODY" == *"$h"* ]] || MISSING+=("$h")
done
(( ${#MISSING[@]} )) && fail "missing sections: $(IFS='|'; echo "${MISSING[*]}")"

# Exactly one Type must be ticked
grep -Eq -- '- \[[xX]\] (✨|🐛|♻️|🧹|📚)' <<< "$BODY" || fail "tick one Type checkbox ([x])"

# No AI attribution (project rule)
grep -Eqi "generated with \[?claude|co-authored-by:[[:space:]]*claude" <<< "$BODY" && fail "remove AI attribution line"

exit 0
