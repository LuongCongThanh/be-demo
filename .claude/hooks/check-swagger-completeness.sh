#!/bin/bash
# check-swagger-completeness.sh — reminder-only check for docs/convention/api-conventions.md
# §B4 (DTO example data) and §B12 (per-route @ApiOperation summary).
#
# Non-blocking: heuristic grep counts can false-positive (e.g. a field that
# legitimately has no useful example), so this only injects a reminder via
# additionalContext — it never exits non-zero, never blocks the tool call.

INPUT=$(cat)
FILE_PATH=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_response?.filePath||JSON.parse(d).tool_input?.file_path||"")}catch{}})' <<< "$INPUT")

FILE_PATH="${FILE_PATH//\\//}"
BASENAME="${FILE_PATH##*/}"

[[ -f "$FILE_PATH" ]] || exit 0

emit_reminder() {
  local message="$1"
  node -e 'let m=process.argv[1];console.log(JSON.stringify({hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:m}}))' "$message"
}

if [[ "$BASENAME" == *.controller.ts ]]; then
  routes=$(grep -cE '^[[:space:]]*@(Get|Post|Put|Patch|Delete)\(' "$FILE_PATH")
  ops=$(grep -cE '^[[:space:]]*@ApiOperation\(' "$FILE_PATH")
  if [[ "$routes" -gt 0 && "$ops" -lt "$routes" ]]; then
    missing=$((routes - ops))
    emit_reminder "Reminder (docs/convention/api-conventions.md §B12): $FILE_PATH has $routes route(s) but only $ops @ApiOperation({ summary: '...' }) — $missing route(s) may be missing a Swagger summary. Add one per endpoint so Swagger UI explains what it does without reading the code."
  fi
  exit 0
fi

if [[ "$BASENAME" == create-*.dto.ts || "$BASENAME" == update-*.dto.ts ]]; then
  props=$(grep -cE '^[[:space:]]*@ApiProperty(Optional)?\(' "$FILE_PATH")
  examples=$(grep -cE 'example[[:space:]]*:' "$FILE_PATH")
  if [[ "$props" -gt 0 && "$examples" -lt "$props" ]]; then
    missing=$((props - examples))
    emit_reminder "Reminder (docs/convention/api-conventions.md §B4): $FILE_PATH has $props @ApiProperty field(s) but only $examples with example data — $missing field(s) may be missing 'example:' for Swagger. Add a realistic example for fields the client sends."
  fi
  exit 0
fi

exit 0
