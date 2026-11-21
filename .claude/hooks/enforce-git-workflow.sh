#!/bin/bash
# enforce-git-workflow.sh — enforce docs/convention/git-workflow.md hard rules on Bash tool calls

HOOK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$HOOK_DIR/../.." && pwd)"
INPUT=$(cat)
if ! COMMAND=$(node "$REPO_ROOT/scripts/hooks/read-tool-command.js" <<< "$INPUT"); then
  echo "Blocked: could not read the Bash command from the hook payload" >&2
  exit 2
fi

# Only care about commands that touch git commit/push
if [[ "$COMMAND" != *"git commit"* && "$COMMAND" != *"git push"* ]]; then
  exit 0
fi

CURRENT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)

# 1) Never `git push --force` — only --force-with-lease is allowed
if [[ "$COMMAND" == *"git push"* ]] && [[ "$COMMAND" =~ (^|[[:space:]])--force([[:space:]]|=|$) ]] && [[ "$COMMAND" != *"--force-with-lease"* ]]; then
  echo "Blocked: use --force-with-lease instead of --force (docs/convention/git-workflow.md §5/§13)" >&2
  exit 2
fi

# 2) No direct commit/push while on a protected branch
PROTECTED='main|master|dev'

if [[ "$CURRENT_BRANCH" =~ ^($PROTECTED)$ ]]; then
  if [[ "$COMMAND" == *"git commit"* ]]; then
    echo "Blocked: direct commit to protected branch '$CURRENT_BRANCH' is not allowed — create a feature/fix/chore/docs branch from dev (docs/convention/git-workflow.md §13)" >&2
    exit 2
  fi
  if [[ "$COMMAND" == *"git push"* ]]; then
    echo "Blocked: direct push to protected branch '$CURRENT_BRANCH' is not allowed — open a Pull Request instead (docs/convention/git-workflow.md §13)" >&2
    exit 2
  fi
fi

# 3) No push to a protected branch via explicit refspec, regardless of current branch.
# Check each `git push` segment on its own, so `git fetch origin dev && git push ...`
# is not mistaken for a push to dev. Covers `origin dev` and `origin HEAD:dev`.
while IFS= read -r SEG; do
  [[ "$SEG" == *"git push"* ]] || continue
  if [[ "$SEG" =~ (origin|upstream)[[:space:]]+([^[:space:]]*:)?($PROTECTED)([[:space:]]|$) ]] \
    || [[ "$SEG" =~ [[:space:]][^[:space:]]*:(refs/heads/)?($PROTECTED)([[:space:]]|$) ]]; then
    echo "Blocked: direct push to protected branch via explicit refspec is not allowed — open a Pull Request instead (docs/convention/git-workflow.md §13). Matched: \"${BASH_REMATCH[0]}\" in: $SEG" >&2
    exit 2
  fi
done < <(sed -E 's/(&&|\|\||;|\|)/\n/g' <<< "$COMMAND")

# 4) No AI attribution in commit messages (project convention overrides default attribution behavior)
AI_AGENT_NAMES='(claude|copilot|codex|chatgpt|openai|gpt|gemini|cursor|windsurf|cline|aider|devin|codeium|cody|tabnine|opencode|roo|continue|augment|replit|ai|agent|bot)'
if [[ "$COMMAND" == *"git commit"* ]] && echo "$COMMAND" | grep -Eqi "co-authored-by:[[:space:]].*\\b$AI_AGENT_NAMES\\b|generated (with|by) .*\\b$AI_AGENT_NAMES\\b|ai-generated|noreply@anthropic\\.com"; then
  echo "Blocked: commit message must not contain AI attribution (docs/convention/git-workflow.md §12) — remove Co-Authored-By/Generated-by lines" >&2
  exit 2
fi

exit 0
