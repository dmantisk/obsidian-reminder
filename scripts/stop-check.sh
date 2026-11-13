#!/bin/bash
# Stop hook equivalent - runs tsc --noEmit + svelte-check when there are uncommitted TS/Svelte changes
# Run this manually or via a VS Code task before committing

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
  echo "No TypeScript/Svelte changes to check"
  exit 0
fi

state_dir=".claude/hooks"
state_file="$state_dir/.stop-check-state"
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
  echo "Same failing state as previous run; skipping to avoid blocking"
  exit 0
fi

if command -v mise >/dev/null 2>&1; then
  runner=(mise exec --)
else
  runner=()
fi

echo "Running tsc --noEmit..."
tsc_output="$("${runner[@]}" npx tsc --noEmit --pretty 2>&1)"
tsc_status=$?

echo "Running svelte-check..."
svelte_output="$("${runner[@]}" npx svelte-check 2>&1)"
svelte_status=$?

if [ $tsc_status -ne 0 ] || [ $svelte_status -ne 0 ]; then
  if [ -n "$current_hash" ]; then
    printf '%s' "$current_hash" >"$state_file"
  fi
  {
    echo "Static checks failed for changed .ts/.svelte files. Please fix before finishing:"
    echo ""
    echo "--- tsc --noEmit --pretty (exit $tsc_status) ---"
    echo "$tsc_output"
    echo ""
    echo "--- svelte-check (exit $svelte_status) ---"
    echo "$svelte_output"
  } >&2
  exit 2
fi

rm -f "$state_file"
echo "All static checks passed"
exit 0