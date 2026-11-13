# Migration Complete: `.claude/` → VS Code Copilot

## Summary

All `.claude/` structures have been migrated to VS Code Copilot equivalents:

### 1. **Copilot Instructions** (`.github/copilot-instructions.md`)
- Already existed and matches the original `CLAUDE.md` + `.claude/rules/*.md`
- Contains: repo map, commands, code rules, refactoring rules

### 2. **VS Code Settings** (`.vscode/settings.json`)
- Updated with: format-on-save, ESLint auto-fix, import organization, LF line endings, TypeScript import preferences, Svelte support

### 3. **VS Code Tasks** (`.vscode/tasks.json`)
- 10 tasks: Install, Build (prod/watch), Test (full/single), Lint, Pre-commit, Type Check, Svelte Check, Docs

### 4. **VS Code Launch Configs** (`.vscode/launch.json`)
- 3 debug configs: Jest tests, single test file, current test

### 5. **VS Code Extensions** (`.vscode/extensions.json`)
- 11 recommended extensions including Prettier, ESLint, Svelte, Jest, Tailwind, Spell Checker, GitLens

### 6. **Copilot Skills** (`.github/copilot-skills/`)
| Skill | Source | Use via |
|-------|--------|---------|
| `manual-verify.md` | `.claude/skills/manual-verify/SKILL.md` | `@skill manual-verify` |
| `obsidian-e2e.md` | `.claude/skills/obsidian-e2e/SKILL.md` | `@skill obsidian-e2e` |
| `pr-review.md` | `.claude/skills/pr-review/SKILL.md` | `@skill pr-review` |
| `contributor-pr.md` | `.claude/skills/contributor-pr/SKILL.md` | `@skill contributor-pr` |

### 7. **Copilot Agents** (`.github/copilot-agents/`)
| Agent | Source | Purpose |
|-------|--------|---------|
| `review-cm6-obsidian-lifecycle.md` | `.claude/agents/review-cm6-obsidian-lifecycle.md` | CodeMirror/Obsidian lifecycle |
| `review-reminder-format.md` | `.claude/agents/review-reminder-format.md` | Reminder syntax parsing |
| `review-time-notification.md` | `.claude/agents/review-time-notification.md` | Date/time & notifications |
| `review-obsidian-guidelines.md` | `.claude/agents/review-obsidian-guidelines.md` | Plugin guidelines |
| `review-testability.md` | `.claude/agents/review-testability.md` | Test coverage |
| `review-verifier.md` | `.claude/agents/review-verifier.md` | Adversarial verification |
| `review-fixer.md` | `.claude/agents/review-fixer.md` | Auto-fix confirmed findings |

### 8. **Workflow** (`.github/workflows/pr-review.js`)
- Multi-agent PR review workflow (5 perspectives → verify → fix → re-review)

### 9. **Scripts** (`scripts/`)
| Script | Original Hook | Usage |
|--------|---------------|-------|
| `post-edit-lint.sh` | PostToolUse | Run manually or via task after edits |
| `stop-check.sh` | Stop | Run before commit (tsc + svelte-check) |
| `manual-verify-reminder.sh` | Stop | Run before finishing (reminds manual verify) |
| `docs-update-reminder.sh` | Stop | Run before finishing (reminds docs update) |

---

## How to Use in VS Code Copilot

### Invoke Skills
```
@skill manual-verify
@skill obsidian-e2e
@skill pr-review
@skill contributor-pr
```

### Run Tasks
`Ctrl+Shift+P` → "Tasks: Run Task" → select from "obsidian-reminder:*"

### Debug Tests
`F5` → select "Debug Jest Tests" / "Debug Single Test File" / "Debug Current Test"

### Run PR Review
1. On a clean feature branch: `@skill pr-review`
2. For a PR: `@skill pr-review 123`

### Manual Verification
After plugin/UI changes: `@skill manual-verify`

### Automated E2E Testing
For CDP-driven tests: `@skill obsidian-e2e`

---

## Local Config (`.claude.local.md` equivalent)
Create `CLAUDE.local.md` at repo root (gitignored):
```markdown
# Local manual verification setup
- Test vault: D:\Test
- Plugin directory: D:\Test\.obsidian\plugins\obsidian-reminder-plugin
- Companion plugins installed: daily-time-log
- Hot-reload plugin: not installed; restart Obsidian after symlink changes
```

---

## Key Differences from `.claude/`

| `.claude/` | VS Code Copilot |
|------------|-----------------|
| Hooks (auto-run) | Manual scripts / Tasks |
| Custom agents (auto-invoked) | `@skill` + `task` tool |
| `CLAUDE_PROJECT_DIR` env | Workspace folder paths |
| Bash scripts | Cross-platform (PowerShell compatible) |
| `.claude/` folder | `.github/` + `.vscode/` + `scripts/` |

---

## Next Steps
1. Install recommended extensions: `Ctrl+Shift+P` → "Extensions: Show Recommended Extensions"
2. Run `mise run main:init` to install dependencies
3. Run `mise run dev` to start watch build
4. Symlink test vault: `ln -sfn $(pwd) D:\Test\.obsidian\plugins\obsidian-reminder-plugin`
5. Use `@skill manual-verify` after plugin/UI changes