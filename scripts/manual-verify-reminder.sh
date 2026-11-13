#!/bin/bash
# Stop hook equivalent - reminds to run manual-verify skill when there are uncommitted TS/Svelte changes
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

# Tracked + untracked .ts/.svelte changes (excludes ignored files like main.js)
changed_files="$(git status --porcelain -- '*.ts' '*.svelte' 2>/dev/null | awk '{print $2}')"

if [ -z "$changed_files" ]; then
  exit 0
fi

state_dir=".claude/hooks"
state_file="$state_dir/.manual-verify-state"
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
  # Already reminded for exactly this set of changes
  exit 0
fi

if [ -n "$current_hash" ]; then
  printf '%s' "$current_hash" >"$state_file"
fi

{
  echo "Manual verification reminder: this turn ends with uncommitted .ts/.svelte changes."
  echo ""
  echo "Automated tests only cover src/model/. If these changes affect runtime behavior"
  echo "in Obsidian (anything under src/plugin/ or src/ui/, parsing behavior visible in"
  echo "the vault, etc.), invoke the manual-verify skill now to set up the test vault and"
  echo "guide the user through verification."
  echo ""
  echo "If manual verification is genuinely unnecessary (docs/test-only changes, or"
  echo "model-layer logic fully covered by unit tests), briefly state that reasoning to"
  echo "the user and finish. This reminder fires once per change state and will not"
  echo "block again until the sources change further."
} >&2
exit 2