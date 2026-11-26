#!/bin/bash
# check-swagger-completeness.sh — reminder-only check for docs/convention/api-rules.md
# §B4 (DTO example data) and §B12 (per-route @ApiOperation summary).
#
# Non-blocking: heuristic grep counts can false-positive (e.g. a field that
# legitimately has no useful example), so this only injects a reminder via
# additionalContext — it never exits non-zero, never blocks the tool call.

HOOK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$HOOK_DIR/../.." && pwd)"
INPUT=$(cat)

emit_reminder() {
  local message="$1"
  node -e 'let m=process.argv[1];console.log(JSON.stringify({additionalContext:m,hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:m}}))' "$message"
}

# Codex apply_patch can touch several files; check each one.
while IFS= read -r FILE_PATH; do
  FILE_PATH="${FILE_PATH//\\//}"
  [[ "$FILE_PATH" == /* ]] || FILE_PATH="$REPO_ROOT/$FILE_PATH"
  [[ -f "$FILE_PATH" ]] || continue
  BASENAME="${FILE_PATH##*/}"

  if [[ "$BASENAME" == *.controller.ts ]]; then
    routes=$(grep -cE '^[[:space:]]*@(Get|Post|Put|Patch|Delete)\(' "$FILE_PATH")
    ops=$(grep -cE '^[[:space:]]*@ApiOperation\(' "$FILE_PATH")
    if [[ "$routes" -gt 0 && "$ops" -lt "$routes" ]]; then
      missing=$((routes - ops))
      emit_reminder "Reminder (docs/convention/api-rules.md §R8): $FILE_PATH has $routes route(s) but only $ops @ApiOperation({ summary: '...' }) — $missing route(s) may be missing a Swagger summary. Add one per endpoint so Swagger UI explains what it does without reading the code."
    fi
    continue
  fi

  if [[ "$BASENAME" == create-*.dto.ts || "$BASENAME" == update-*.dto.ts ]]; then
    props=$(grep -cE '^[[:space:]]*@ApiProperty(Optional)?\(' "$FILE_PATH")
    examples=$(grep -cE 'example[[:space:]]*:' "$FILE_PATH")
    if [[ "$props" -gt 0 && "$examples" -lt "$props" ]]; then
      missing=$((props - examples))
      emit_reminder "Reminder (docs/convention/api-rules.md §R1): $FILE_PATH has $props @ApiProperty field(s) but only $examples with example data — $missing field(s) may be missing 'example:' for Swagger. Add a realistic example for fields the client sends."
    fi
    continue
  fi
done < <(node "$REPO_ROOT/scripts/hooks/read-tool-paths.js" <<< "$INPUT")

exit 0
