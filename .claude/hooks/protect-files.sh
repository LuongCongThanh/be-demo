#!/bin/bash
# protect-files.sh — block Edit/Write on sensitive files

HOOK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$HOOK_DIR/../.." && pwd)"
INPUT=$(cat)

# Every agent's payload shape (Claude file_path, Copilot filePath, Codex apply_patch text)
# is normalized by the shared reader so all agents block the same files.
while IFS= read -r FILE_PATH; do
  [[ -n "$FILE_PATH" ]] || continue
  # Normalize Windows backslash separators so the patterns below match
  FILE_PATH="${FILE_PATH//\\//}"
  BASENAME="${FILE_PATH##*/}"

  # .git/ internals — never legitimate to edit directly
  if [[ "$FILE_PATH" == .git/* || "$FILE_PATH" == *"/.git/"* ]]; then
    echo "Blocked: $FILE_PATH is inside .git/" >&2
    exit 2
  fi

  # .env and its variants (.env.local, .env.production...) — but NOT .env.example,
  # which convention requires keeping in sync (see docs/conventions/config-environment-conventions.md §5)
  if [[ "$BASENAME" == ".env" || ( "$BASENAME" == .env.* && "$BASENAME" != ".env.example" ) ]]; then
    echo "Blocked: $FILE_PATH is a secret env file — edit it manually, not via an agent" >&2
    exit 2
  fi
done < <(node "$REPO_ROOT/scripts/hooks/read-tool-paths.js" <<< "$INPUT")

exit 0
