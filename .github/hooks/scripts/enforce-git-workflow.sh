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

if [[ "$COMMAND" != *"git commit"* && "$COMMAND" != *"git push"* ]]; then
  echo '{"permissionDecision":"allow"}'
  exit 0
fi

CURRENT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)

if [[ "$COMMAND" == *"git push"* ]] && [[ "$COMMAND" =~ (^|[[:space:]])--force([[:space:]]|=|$) ]] && [[ "$COMMAND" != *"--force-with-lease"* ]]; then
  deny "Blocked: use --force-with-lease instead of --force (docs/convention/git-workflow.md §5/§13)"
fi

PROTECTED='main|master|dev'

if [[ "$CURRENT_BRANCH" =~ ^($PROTECTED)$ ]]; then
  if [[ "$COMMAND" == *"git commit"* ]]; then
    deny "Blocked: direct commit to protected branch '$CURRENT_BRANCH' is not allowed — create a feature/fix/chore/docs branch from dev (docs/convention/git-workflow.md §13)"
  fi
  if [[ "$COMMAND" == *"git push"* ]]; then
    deny "Blocked: direct push to protected branch '$CURRENT_BRANCH' is not allowed — open a Pull Request instead (docs/convention/git-workflow.md §13)"
  fi
fi

while IFS= read -r SEG; do
  [[ "$SEG" == *"git push"* ]] || continue
  if [[ "$SEG" =~ (origin|upstream)[[:space:]]+([^[:space:]]*:)?($PROTECTED)([[:space:]]|$) ]] \
    || [[ "$SEG" =~ [[:space:]][^[:space:]]*:(refs/heads/)?($PROTECTED)([[:space:]]|$) ]]; then
    deny "Blocked: direct push to protected branch via explicit refspec is not allowed — open a Pull Request instead (docs/convention/git-workflow.md §13). Matched: \"${BASH_REMATCH[0]}\" in: $SEG"
  fi
done < <(sed -E 's/(&&|\|\||;|\|)/\n/g' <<< "$COMMAND")

AI_AGENT_NAMES='(claude|copilot|codex|chatgpt|openai|gpt|gemini|cursor|windsurf|cline|aider|devin|codeium|cody|tabnine|opencode|roo|continue|augment|replit|ai|agent|bot)'
if [[ "$COMMAND" == *"git commit"* ]] && echo "$COMMAND" | grep -Eqi "co-authored-by:[[:space:]].*\\b$AI_AGENT_NAMES\\b|generated (with|by) .*\\b$AI_AGENT_NAMES\\b|ai-generated|noreply@anthropic\\.com"; then
  deny "Blocked: commit message must not contain AI attribution (docs/convention/git-workflow.md §12) — remove Co-Authored-By/Generated-by lines"
fi

echo '{"permissionDecision":"allow"}'
exit 0