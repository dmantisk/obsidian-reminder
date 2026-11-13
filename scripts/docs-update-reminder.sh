#!/bin/bash
# Stop hook equivalent - reminds to update docs when there are changes that affect user-facing features
# Run this manually or via a VS Code task before finishing work

set -uo pipefail

# Resolve project root
project_dir="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$project_dir" ]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  project_dir="$(cd "$script_dir/../.." && pwd)"
fi

cd "$project_dir" || exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Check for changes that might need docs updates
changed_files="$(git status --porcelain 2>/dev/null | awk '{print $2}')"

if [ -z "$changed_files" ]; then
  exit 0
fi

# Check if any changed files are likely to need docs updates
needs_docs=false
while IFS= read -r f; do
  case "$f" in
    src/plugin/settings/*|src/plugin/commands/*|src/plugin/ui/*|src/ui/*|manifest.json|manifest-beta.json)
      needs_docs=true
      break
      ;;
  esac
done <<<"$changed_files"

if [ "$needs_docs" = false ]; then
  exit 0
fi

state_dir=".claude/hooks"
state_file="$state_dir/.docs-update-state"
mkdir -p "$state_dir"

hash_cmd=""
if command -v shasum >/dev/null 2>&1; then
  hash_cmd="shasum -a 256"
elif command -v sha256sum >/dev/null 2>&1; then
  hash_cmd="sha256sum"
fi

current_hash=""
if [ -n "$hash_cmd" ]; then
  current_hash="$(while IFS= read -r f; do [ -f "$f" ] && cat "$f"; done <<<"$changed_files" | $hash_cmd | awk '{print $1}')"
fi

last_hash=""
if [ -f "$state_file" ]; then
  last_hash="$(cat "$state_file" 2>/dev/null)"
fi

if [ -n "$current_hash" ] && [ "$current_hash" = "$last_hash" ]; then
  exit 0
fi

if [ -n "$current_hash" ]; then
  printf '%s' "$current_hash" >"$state_file"
fi

{
  echo "Documentation update reminder: changes detected that may need docs updates."
  echo ""
  echo "Files that often need docs updates:"
  echo "  - Settings changes (src/plugin/settings/)"
  echo "  - New commands (src/plugin/commands/)"
  echo "  - UI changes (src/plugin/ui/, src/ui/)"
  echo "  - Manifest changes (manifest.json, manifest-beta.json)"
  echo ""
  echo "Consider updating docs/ if this change adds/removes/modifies user-facing features."
  echo "This reminder fires once per change state."
} >&2
exit 2