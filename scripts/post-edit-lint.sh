#!/bin/bash
# PostToolUse hook equivalent - runs eslint --fix on edited TypeScript/Svelte files
# This can be run manually or via a VS Code task

set -uo pipefail

# Get the file path from argument or stdin
file_path="${1:-}"
if [ -z "$file_path" ]; then
  # Try to read from stdin (for hook compatibility)
  input="$(cat)"
  if command -v jq >/dev/null 2>&1; then
    file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
  elif command -v node >/dev/null 2>&1; then
    file_path="$(NODE_JSON_INPUT="$input" node -e '
      try {
        const data = JSON.parse(process.env.NODE_JSON_INPUT || "{}");
        process.stdout.write(data.tool_input?.file_path || "");
      } catch (e) {}
    ' 2>/dev/null)"
  fi
fi

if [ -z "$file_path" ]; then
  exit 0
fi

# Only lint TypeScript / Svelte sources under src/
case "$file_path" in
  *.ts | *.svelte) ;;
  *) exit 0 ;;
esac
case "$file_path" in
  */src/* | src/*) ;;
  *) exit 0 ;;
esac

# Resolve project root
project_dir="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$project_dir" ]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  project_dir="$(cd "$script_dir/../.." && pwd)"
fi

cd "$project_dir" || exit 0

# File may have been deleted/moved
if [ ! -f "$file_path" ]; then
  exit 0
fi

# Run eslint --fix on the file
if command -v mise >/dev/null 2>&1; then
  runner=(mise exec --)
else
  runner=()
fi

if [ ! -x node_modules/.bin/eslint ] && ! command -v npx >/dev/null 2>&1; then
  exit 0
fi

lint_output="$("${runner[@]}" npx eslint --no-warn-ignored --fix "$file_path" 2>&1)"
lint_status=$?

if [ $lint_status -ne 0 ]; then
  {
    echo "ESLint found issues in: $file_path (auto-fixable ones are already fixed; the file on disk may have changed)"
    echo ""
    echo "$lint_output"
  } >&2
  exit 2
fi

exit 0