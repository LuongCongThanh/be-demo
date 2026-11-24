#!/usr/bin/env bash
# Print the next openapi-v* tag for docs/openapi/openapi.json at HEAD, or nothing when
# the contract is unchanged since the latest tag. Needs `oasdiff` on PATH and all tags fetched.
#
# Below 1.0 the minor number carries breaking changes:
#   breaking change (oasdiff level ERR) -> 0.7.0 -> 0.8.0
#   any other change                    -> 0.7.0 -> 0.7.1
set -euo pipefail

CONTRACT=docs/openapi/openapi.json
latest=$(git tag --list 'openapi-v*' --sort=-version:refname | head -n 1)
if [[ -z "$latest" ]]; then
  echo openapi-v0.1.0
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git show "$latest:$CONTRACT" >"$work/old.json"

if cmp -s "$work/old.json" "$CONTRACT"; then
  echo "Contract unchanged since $latest" >&2
  exit 0
fi

# Fail loudly on an unreadable spec instead of mistaking it for a breaking change.
oasdiff diff "$work/old.json" "$CONTRACT" >/dev/null

IFS=. read -r major minor patch <<<"${latest#openapi-v}"
if oasdiff breaking "$work/old.json" "$CONTRACT" --fail-on ERR >&2; then
  echo "openapi-v${major}.${minor}.$((patch + 1))"
else
  echo "openapi-v${major}.$((minor + 1)).0"
fi
