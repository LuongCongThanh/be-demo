#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(node -e '
let d="";
process.stdin.on("data",c=>d+=c).on("end",()=>{
  try {
    const j = JSON.parse(d);
    process.stdout.write(j.toolArgs?.path || j.toolArgs?.filePath || j.tool_input?.file_path || "");
  } catch {}
});
' <<< "$INPUT")

[[ -z "$FILE_PATH" ]] && { echo '{"permissionDecision":"allow"}'; exit 0; }

FILE_PATH="${FILE_PATH//\\//}"
BASENAME="${FILE_PATH##*/}"

deny() {
  node -e 'console.log(JSON.stringify({permissionDecision:"deny",permissionDecisionReason:process.argv[1]}))' "$1"
  exit 0
}

if [[ "$FILE_PATH" == *".git/"* ]]; then
  deny "Blocked: $FILE_PATH is inside .git/"
fi

if [[ "$BASENAME" == ".env" || ( "$BASENAME" == .env.* && "$BASENAME" != ".env.example" ) ]]; then
  deny "Blocked: $FILE_PATH is a secret env file — edit it manually, not via an agent"
fi

echo '{"permissionDecision":"allow"}'
exit 0