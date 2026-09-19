#!/bin/bash
# protect-files.sh — block Edit/Write on sensitive files

INPUT=$(cat)
FILE_PATH=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path||"")}catch{}})' <<< "$INPUT")

# Normalize Windows backslash separators so the patterns below match
FILE_PATH="${FILE_PATH//\\//}"
BASENAME="${FILE_PATH##*/}"

# .git/ internals — never legitimate to edit directly
if [[ "$FILE_PATH" == *".git/"* ]]; then
  echo "Blocked: $FILE_PATH is inside .git/" >&2
  exit 2
fi

# .env and its variants (.env.local, .env.production...) — but NOT .env.example,
# which convention requires keeping in sync (see docs/convention/config-environment-conventions.md §5)
if [[ "$BASENAME" == ".env" || ( "$BASENAME" == .env.* && "$BASENAME" != ".env.example" ) ]]; then
  echo "Blocked: $FILE_PATH is a secret env file — edit it manually, not via Claude" >&2
  exit 2
fi

exit 0
