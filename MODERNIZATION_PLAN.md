# Obsidian Reminder Plugin — Modernization Plan

> **Generated**: 2026-11-13  
> **Plugin Version**: 1.7.0  
> **Audit Scope**: Full codebase (src/, package.json, manifest.json, build config)  
> **Target**: Modernize for native Obsidian APIs, simplicity, performance, reduced bundle size  
> **Constraint**: Preserve all functionality, existing reminders, and user settings. No backward compatibility required.

---

## Executive Summary

| Metric | Current | Target |
|--------|---------|--------|
| **Bundle (main.js)** | 360 KB | **< 200 KB** |
| **Prod Dependencies** | 2 (`rrule`, `svelte`) | **1** (`rrule` only) |
| **Dev Dependencies** | 31 | **~20** |
| **Svelte Components** | 9 | **4** (complex only) |
| **Settings Code** | ~600 LOC | **~100 LOC** |
| **TypeScript Warnings** | 39 (Svelte 4 deprecation) | **0** |
| **Min Obsidian Version** | 1.7.2 | **1.13.0** |

**High-Level Strategy**: Replace custom implementations with native Obsidian APIs (settings, views, markdown rendering), eliminate simple Svelte components, migrate complex ones to Svelte 5, add caching/event-driven updates for performance.

---

## Phase 1: Native Settings API (Week 1-2) — **HIGHEST IMPACT**

### Current State
Custom settings DSL (~600 LOC across 6 files):
- `src/plugin/settings/tab-model.ts` — `SettingTabModel`, `SettingPage`, `SettingGroup`
- `src/plugin/settings/setting-model.ts` — `SettingRegistry`, `SettingContext`, `SettingModelBase`, `SettingModelImpl`
- `src/plugin/settings/setting-builders.ts` — `SettingModelBuilder`, `TextSettingModelBuilder`, `NumberSettingModelBuilder`, `ToggleSettingModelBuilder`, `DropdownSettingModelBuilder`
- `src/plugin/settings/serdes.ts` — `Serde`, `RawSerde`, `TimeSerde`, `LatersSerde`, `ExcludedPathsSerde`, `ReminderFormatTypeSerde`
- `src/plugin/settings/sections/*.ts` — 7 section files using the DSL
- `src/plugin/settings/settings-tab.css` — Custom tab styling

### Target State
Native `PluginSettingTab` with declarative `addSetting()` API.

### Implementation Steps

#### 1.1 Create `ReminderSettingTab` class in `src/main.ts` (or new file `src/plugin/settings/setting-tab.ts`)

```typescript
// src/plugin/settings/setting-tab.ts
import { PluginSettingTab, Setting, App } from "obsidian";
import type { Settings } from "./index";  // The existing Settings class
import { t } from "i18n";

export class ReminderSettingTab extends PluginSettingTab {
  constructor(app: App, private pluginSettings: Settings) {
    super(app, pluginSettings);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Notifications page
    this.addNotificationsSettings(containerEl);
    // Editor page
    this.addEditorSettings(containerEl);
    // Display page
    this.addDisplaySettings(containerEl);
    // Ntfy page
    this.addNtfySettings(containerEl);
    // Advanced page
    this.addAdvancedSettings(containerEl);
    // TaskNotes page
    this.addTaskNotesSettings(containerEl);
    // Reminder Formats page
    this.addReminderFormatsSettings(containerEl);
  }

  private addNotificationsSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h2", { text: t("Notifications") });

    new Setting(containerEl)
      .setName(t("Reminder time"))
      .setDesc(t("Time when a reminder with no time part will show"))
      .addText(text => text
        .setPlaceholder("09:00")
        .setValue(this.pluginSettings.notifications.reminderTime.value.toString())
        .onChange(async (value) => {
          this.pluginSettings.notifications.reminderTime.rawValue.value = value;
        }));

    new Setting(containerEl)
      .setName(t("Reminder time step (minutes)"))
      .setDesc(t("Step of time for reminder time (minutes)"))
      .addText(text => text
        .setValue(String(this.pluginSettings.notifications.reminderTimeStep.value))
        .onChange(async (value) => {
          this.pluginSettings.notifications.reminderTimeStep.rawValue.value = parseInt(value, 10);
        }));

    // ... continue for all settings
  }

  // Repeat for each section...
}
```

#### 1.2 Register the setting tab in `main.ts` `onload()`

```typescript
// In ReminderPlugin.onload()
this.addSettingTab(new ReminderSettingTab(this.app, this.settings));
```

#### 1.3 Migrate Each Section

Map each existing setting to native `Setting` API:

| Existing Setting | Native API |
|------------------|------------|
| `text()` / `textArea()` | `addText()` / `addTextArea()` |
| `toggle()` | `addToggle()` |
| `dropdown()` + `addOption()` | `addDropdown()` + `addOption()` |
| `number()` | `addText()` with numeric validation |
| `onAnyValueChanged` for enable/disable | `setting.setDisabled()` in change handler |
| `placeHolder()` | `setPlaceholder()` |
| `desc` with validation/info | `setDesc()` + custom HTML elements for validation |

**Key Pattern for Dynamic Enable/Disable**:
```typescript
const parentSetting = new Setting(containerEl)
  .setName(t("Use system notification"))
  .addToggle(toggle => toggle
    .setValue(this.pluginSettings.notifications.useSystemNotification.value)
    .onChange(async (value) => {
      this.pluginSettings.notifications.useSystemNotification.rawValue.value = value;
      // Update dependent settings
      childSetting1.settingEl.toggleClass("is-hidden", !value);
      childSetting2.settingEl.toggleClass("is-hidden", !value);
    }));

const childSetting1 = new Setting(containerEl)
  .setName(t("Show popup with system notification"))
  .setDisabled(!this.pluginSettings.notifications.useSystemNotification.value);
// ...
```

#### 1.4 Update `PluginData` to Use Native Persistence

```typescript
// src/plugin/core/data.ts - simplify save/load
async save(force: boolean = false) {
  if (!force && !this.changed) return;
  
  const settings: Record<string, unknown> = {};
  this.settings.forEach((setting) => {
    setting.store(settings);  // Keep existing store() for now
  });
  
  await this.store.saveData({
    scanned: this.scanned.value,
    seededTaskStatuses: this.seededTaskStatusesText,
    reminders: remindersData,
    taskNotesReminderState: this.taskNotesReminderState,
    debug: this.debug.value,
    dndUntil: this.dndUntil.value?.getTimeInMillis() ?? null,
    settings,
  });
  this.changed = false;
}
```

**Note**: Keep `SettingModel.store()`/`load()` working during transition. The `Settings` class still manages the setting models; only the UI layer changes.

#### 1.5 Delete Obsolete Files

After migration completes and tests pass:
- `src/plugin/settings/tab-model.ts`
- `src/plugin/settings/setting-model.ts`
- `src/plugin/settings/setting-builders.ts`
- `src/plugin/settings/serdes.ts`
- `src/plugin/settings/settings-tab.css`

#### 1.6 Validation

```bash
npm run lint
npm test
# Verify settings-layout.test.ts passes (guards setting keys)
# Manual check: Open settings tab in Obsidian, verify all settings work
```

---

## Phase 2: Eliminate Simple Svelte Components (Week 2-3)

### Target Components for Removal

| Component | Lines | Replacement |
|-----------|-------|-------------|
| `src/ui/common/IconText.svelte` | ~20 | Helper function |
| `src/ui/common/Markdown.svelte` | ~30 | `MarkdownRenderer.render()` |
| `src/plugin/ui/editor/editor-reminder-display/ReminderPill.svelte` | ~50 | Vanilla TS in `pill-widget.ts` |

### 2.1 Replace `IconText.svelte`

**Create**: `src/ui/common/icon-text.ts`
```typescript
import { setIcon } from "obsidian";

export function createIconText(
  container: HTMLElement,
  icon: string,
  text: string
): HTMLElement {
  const wrapper = container.createSpan({ cls: "icon-text" });
  const iconEl = wrapper.createSpan({ cls: "icon" });
  setIcon(iconEl, icon);
  wrapper.createSpan({ cls: "text", text });
  return wrapper;
}
```

**Update Consumers** (5 files):
- `src/ui/reminder/Reminder.svelte` → `createIconText(el, "link", reminder.file)`
- `src/ui/list/ReminderListByDate.svelte` → similar
- `src/plugin/ui/editor/editor-reminder-display/ReminderPill.svelte` (will be removed in 2.3)
- `src/plugin/ui/notifications/reminder-toast.ts` (uses `Reminder.svelte`)

### 2.2 Replace `Markdown.svelte`

**Current Usage**: Renders markdown in reminder titles, descriptions, list items.

**Replace with**: `MarkdownRenderer.render(markdown, sourcePath, containerEl, component)`

**Update Consumers** (4 files):
- `src/ui/reminder/Reminder.svelte` — `MarkdownRenderer.render(reminder.title, reminder.file, titleEl, this)`
- `src/ui/list/ReminderListByDate.svelte` — similar
- `src/plugin/ui/editor/editor-reminder-display/rendered-block-post-processor.ts` — already uses `MarkdownRenderChild`, keep
- `src/plugin/ui/views/reminder-list.ts` — passes `generateLink` to Svelte, will be rewritten in Phase 3

### 2.3 Replace `ReminderPill.svelte` with Vanilla TS

**Current**: `src/plugin/ui/editor/editor-reminder-display/ReminderPill.svelte` — simple clickable pill with keyboard activation.

**Move Logic to**: `src/plugin/ui/editor/editor-reminder-display/pill-widget.ts`

```typescript
// In ReminderPillWidget.toDOM()
override toDOM(view: EditorView): HTMLElement {
  const container = createSpan({ cls: "reminder-pill" });
  container.setAttribute("role", "button");
  container.setAttribute("tabindex", "0");
  container.setAttribute("title", this.title);
  
  const icon = container.createSpan({ cls: "icon" });
  setIcon(icon, "clock");
  container.createSpan({ cls: "text", text: this.span.reminder.time.toString() });
  
  const activate = () => {
    this.activate(view, container);
  };
  
  container.addEventListener("click", activate);
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
  
  return container;
}
```

**Update CSS**: Move styles from `ReminderPill.svelte` to `src/plugin/ui/cm6-datetime-chooser.css` (already imported) or new `reminder-pill.css`.

**Delete**: `src/plugin/ui/editor/editor-reminder-display/ReminderPill.svelte`

### 2.4 Remove Svelte 4 Compat Mode

After Phases 2-3, if no Svelte 4 APIs remain (`new Component()`, `.$set()`, `.$destroy()`, `.$on()`):

```javascript
// esbuild.config.mjs - REMOVE this:
compatibility: { componentApi: 4 },
```

### 2.5 Validation

```bash
npm run lint  # Should have fewer Svelte deprecation warnings
npm test
npm run build
# Manual: Verify editor pills render, click, keyboard work
```

---

## Phase 3: Reminder List View Modernization (Week 3-4)

### Current State
- `src/ui/list/ReminderList.svelte` + `ReminderListByDate.svelte` — Svelte components
- `src/plugin/ui/views/reminder-list.ts` — `ReminderListItemView` (ItemView) + `ReminderListItemViewProxy` (custom lazy loader)

### Target State
- Native `DeferredView` (Obsidian 1.13+) for lazy loading
- Manual DOM rendering in `ItemView.onOpen()`
- No Svelte components in list view

### 3.1 Replace `ReminderListItemViewProxy` with `DeferredView`

```typescript
// src/plugin/ui/views/reminder-list.ts
import { DeferredView, ItemView, WorkspaceLeaf } from "obsidian";

export class ReminderListView extends ItemView {
  // ... existing ReminderListItemView logic moved here
}

export const REMINDER_LIST_VIEW_TYPE = "reminder-list";

export function registerReminderListView(plugin: ReminderPlugin) {
  plugin.registerView(
    REMINDER_LIST_VIEW_TYPE,
    (leaf) => new ReminderListView(leaf, plugin)
  );
}
```

**In `main.ts` `onload()`**:
```typescript
registerReminderListView(this);
```

### 3.2 Rewrite `ReminderListView.onOpen()` with Manual DOM

```typescript
// src/plugin/ui/views/reminder-list.ts
override async onOpen(): Promise<void> {
  const { contentEl } = this;
  contentEl.empty();
  contentEl.addClass("reminder-list-view");
  
  const groups = this.computeGroups();
  
  for (const group of groups) {
    const groupEl = contentEl.createDiv("reminder-group");
    
    const headerEl = groupEl.createDiv("group-header");
    headerEl.createSpan({ text: group.name, cls: "group-name" + (group.isOverdue ? " group-name-overdue" : "") });
    if (group.reminders.length > 0) {
      headerEl.createSpan({ text: String(group.reminders.length), cls: "group-count" });
    }
    
    const listEl = groupEl.createDiv("reminder-list");
    for (const reminder of group.reminders) {
      const itemEl = listEl.createEl("button", { cls: "reminder-list-item hover-highlight" });
      itemEl.setAttribute("aria-label", this.tooltip(reminder));
      itemEl.setAttribute("draggable", "true");
      
      itemEl.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", this.generateLink(reminder));
      });
      itemEl.addEventListener("click", () => {
        this.onOpenReminder(reminder);
      });
      
      const timeEl = itemEl.createSpan({ cls: "reminder-time", text: group.timeToString(reminder.effectiveTime) });
      
      const titleContainer = itemEl.createDiv("reminder-title-container");
      if (reminder.source === "tasknotes") {
        titleContainer.createSpan({ cls: "reminder-source", text: "TN", title: "TaskNotes" });
      }
      const titleEl = titleContainer.createSpan({ cls: "reminder-title" });
      // Use MarkdownRenderer.render() here
      await MarkdownRenderer.render(this.app, reminder.title, titleEl, "", this);
      
      if (reminder.source === "markdown") {
        titleContainer.createSpan({ cls: "reminder-file", text: reminder.getFileName() });
      }
    }
  }
}
```

### 3.3 Delete Svelte List Components

- `src/ui/list/ReminderList.svelte`
- `src/ui/list/ReminderListByDate.svelte`

### 3.4 Validation

```bash
npm run lint
npm test
# Manual: Open reminder list view, verify:
# - Groups render correctly
# - Click opens reminder
# - Drag-drop works
# - Keyboard navigation (if any)
# - Overdue styling
```

---

## Phase 4: Svelte 5 Migration (Week 4-5)

### Remaining Svelte Components (4 complex ones)

| Component | Purpose | Complexity |
|-----------|---------|------------|
| `src/ui/reminder/Reminder.svelte` | Modal + toast popup | High |
| `src/ui/datetime/DateTimeChooser.svelte` | Calendar + time picker + quick picks | Very High |
| `src/ui/datetime/Calendar.svelte` | Month calendar with reminders | High |
| `src/ui/datetime/TimePicker.svelte` | Time stepper input | Medium |

### 4.1 Migration Pattern

**Svelte 4 (Current)**:
```svelte
<script lang="typescript">
  export let reminder: Reminder;
  export let onDone: () => void;
  let selectedIndex: number;
  
  function handleClick() { ... }
</script>

<button on:click={handleClick}>Click</button>
```

**Svelte 5 (Target)**:
```svelte
<script lang="typescript">
  let { reminder, onDone }: { reminder: Reminder; onDone: () => void } = $props();
  let selectedIndex = $state<number>();
  
  function handleClick() { ... }
</script>

<button onclick={handleClick}>Click</button>
```

### 4.2 Key Changes Checklist

- [ ] `export let` → `let { ... } = $props()`
- [ ] `let x = ...` → `let x = $state(...)`
- [ ] `$: reactive` → `$derived` or `$effect`
- [ ] `on:event` → `onclick` / `onkeydown` (native DOM events)
- [ ] `bind:value` → `bind:value` (still works) or manual sync
- [ ] `component.$set()` → props update automatically
- [ ] `component.$destroy()` → automatic cleanup
- [ ] `component.$on()` → callback props
- [ ] `<svelte:window on:keydown|...>` → `use:action` or `onMount` with `window.addEventListener`

### 4.3 Specific Component Notes

#### `Reminder.svelte` — Most Complex
- Keyboard mnemonics (Alt+D, Alt+M, etc.) via `svelte:window` → move to `onMount` with `window.addEventListener`
- Two variants: `modal` and `toast` → keep both
- `shortcutsEnabled` prop for toast management → keep

#### `DateTimeChooser.svelte` — Very Complex
- Two modes: `calendar` and `quickpick` → `$state` for mode
- Filter input with arrow key navigation → `$derived` for filtered list
- CalendarView + TimePicker + ReminderListByDate as child components → all must be migrated together

#### `Calendar.svelte` / `TimePicker.svelte`
- Used by `DateTimeChooser.svelte` → migrate in same PR

### 4.4 Remove Compat Mode

After all 4 components migrated:
```javascript
// esbuild.config.mjs - REMOVE:
compatibility: { componentApi: 4 },
```

### 4.5 Validation

```bash
npm run lint  # Zero Svelte deprecation warnings
npm test
npm run build
# Manual: Test all 4 components thoroughly in Obsidian
# - Reminder modal + toast
# - Date/time chooser (calendar, quick picks, time picker)
# - Keyboard shortcuts
# - Language switching
```

---

## Phase 5: Performance Optimizations (Week 5-6)

### 5.1 Defer Non-Critical Initialization

**File**: `src/main.ts`

```typescript
// In constructor - ONLY create critical objects
this._reminders = new Reminders(...);
this._data = new PluginData(this, this.reminders);
this.settings = this.data.settings;
this.settings.applyLanguage();
this.reminders.reminderTime = this.settings.notifications.reminderTime;
DATE_TIME_FORMATTER.setTimeFormat(...);

this._ui = new ReminderPluginUI(this);
this._fileSystem = new ReminderPluginFileSystem(...);

// DEFER these to onLayoutReady:
this._taskNotes = null;  // Will create in onLayoutReady
this._notificationWorker = null;
this._ntfyController = null;
```

```typescript
// In onload() -> onLayoutReady callback
this.app.workspace.onLayoutReady(async () => {
  await this.data.load();
  this.settings.applyLanguage();
  await this.seedTaskStatuses();
  this.ui.onLayoutReady();
  this.fileSystem.onload(this);
  
  // CREATE deferred objects HERE
  this._taskNotes = new TaskNotesIntegration(...);
  await this.taskNotes.onLayoutReady(this);
  
  this._notificationWorker = new NotificationWorker({...});
  this._notificationWorker.startPeriodicTask();
  
  this._ntfyController = new NtfyController({...});
  this._ntfyController.start();
});
```

### 5.2 Incremental Vault Scan

**File**: `src/plugin/core/data.ts` — Add `lastScanMtime`

```typescript
// In PluginData class
private lastScanMtime = 0;

async save(force: boolean = false) {
  // ... existing code ...
  await this.store.saveData({
    // ... existing fields ...
    lastScanMtime: this.lastScanMtime,
  });
}

private async doLoad() {
  // ... existing code ...
  this.lastScanMtime = data.lastScanMtime ?? 0;
}
```

**File**: `src/plugin/core/filesystem.ts`

```typescript
async reloadRemindersInAllFiles() {
  await this.dataLoaded();
  console.debug("Reload all files and collect reminders");
  
  const now = Date.now();
  const files = this.vault.getMarkdownFiles();
  
  // Only re-scan files modified since last scan
  const filesToScan = this.lastScanMtime > 0
    ? files.filter(f => f.stat.mtime > this.lastScanMtime)
    : files;
  
  if (this.lastScanMtime === 0) {
    this.reminders.clearSource("markdown");
  }
  
  for (const file of filesToScan) {
    await this.reloadRemindersInFile(file);
  }
  
  this.lastScanMtime = now;
  this.onRemindersChanged();
}
```

### 5.3 Cache Expired Reminders

**File**: `src/model/reminders.ts`

```typescript
export class Reminders {
  private expiredCache: { reminders: Reminder[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5000; // 5 seconds
  
  getExpiredReminders(defaultTime?: Time): Reminder[] {
    const now = DateTime.now().getTimeInMillis(defaultTime);
    
    // Return cached if fresh
    if (this.expiredCache && (now - this.expiredCache.timestamp) < this.CACHE_TTL) {
      return this.expiredCache.reminders;
    }
    
    const expired = this.reminders.filter(r => r.isExpired(now, defaultTime));
    this.expiredCache = { reminders: expired, timestamp: now };
    return expired;
  }
  
  // Invalidate on any reminder change
  private invalidateExpiredCache() {
    this.expiredCache = null;
  }
  
  // Call invalidateExpiredCache() in:
  // - replaceSourceFile()
  // - removeSourceFile()
  // - clearSource()
}
```

### 5.4 Event-Driven Status Bar

**File**: `src/plugin/ui/status-bar/overdue-status-bar.ts`

```typescript
export class OverdueStatusBar {
  // ... existing code ...
  
  onload() {
    this.el = this.plugin.addStatusBarItem();
    // ... existing setup ...
    
    // REPLACE setInterval with event subscription
    this.plugin.reminders.onChanged(() => this.refresh());
    
    // Initial refresh
    this.refresh();
  }
  
  // REMOVE the setInterval registration
}
```

**File**: `src/model/reminders.ts` — Add event emitter

```typescript
export class Reminders {
  private changeListeners: Set<() => void> = new Set();
  
  onChanged(listener: () => void) {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }
  
  private notifyChanged() {
    this.invalidateExpiredCache();
    this.changeListeners.forEach(l => l());
  }
  
  // Call notifyChanged() in all mutating methods
}
```

### 5.5 Idle Callback for Initial Scan

**File**: `src/plugin/core/notification-worker.ts`

```typescript
private async periodicTask(): Promise<void> {
  // ... existing code ...
  
  if (!this.deps.isScanned()) {
    // Use requestIdleCallback for non-blocking initial scan
    const doScan = () => {
      void this.deps.reloadRemindersInAllFiles().then(() => {
        this.deps.markScanned();
        this.deps.saveData();
      });
    };
    
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(doScan, { timeout: 5000 });
    } else {
      setTimeout(doScan, 0);
    }
  }
  
  // ... rest unchanged ...
}
```

### 5.6 Validation

```bash
npm run lint
npm test
npm run build
# Manual: Measure startup time, verify:
# - Settings load fast
# - Initial scan doesn't block UI
# - Status bar updates instantly on reminder changes
# - 60s notification tick is fast (cached)
```

---

## Phase 6: Architecture Cleanup (Week 6)

### 6.1 Simplify `ReminderFormatConfig` Chain

**Current**: Settings → `ReminderFormatConfig` → `ReminderFormatParameterKey` → Format classes

**Target**: Formats read directly from `Settings` instance

**File**: `src/model/format/reminder-base.ts` — Remove `ReminderFormatConfig`, `ReminderFormatParameterKey`

**File**: `src/model/format/*.ts` — Each format reads settings directly:

```typescript
// In DefaultReminderFormat
private linkDatesToDailyNotes() {
  // Instead of: this.config.getParameter(ReminderFormatParameterKey.linkDatesToDailyNotes)
  return this.plugin.settings.editor.linkDatesToDailyNotes.value;
}
```

**Challenge**: Formats are singletons (`DefaultReminderFormat.instance`) created at module load, before plugin exists.

**Solution**: Pass settings reference at runtime:

```typescript
// In model/format/index.ts
export function setReminderFormatConfig(settings: Settings) {
  reminderFormatConfig = settings;  // Store Settings instance directly
}

// In each format
private getSettings(): Settings {
  return reminderFormatConfig as Settings;
}
```

### 6.2 Inline `DataStore` Interface

**File**: `src/plugin/core/data.ts`

```typescript
// REMOVE: export interface DataStore { ... }
// REPLACE constructor parameter:
constructor(
  private store: { loadData(): Promise<unknown>; saveData(data: unknown): Promise<void> },
  private reminders: Reminders,
) { ... }
```

### 6.3 Remove `obsidian-hack/` If Unused

**Check**: `grep -r "obsidian-hack" src/` — if no imports, delete:
- `src/plugin/obsidian-hack/leaf.ts`
- `src/plugin/obsidian-hack/obsidian-debug-mobile.ts`

### 6.4 Clean Up `debug` Setting

**File**: `src/plugin/core/data.ts` — `debug` Reference exists but no UI setting. Remove if unused.

### 6.5 Validation

```bash
npm run lint
npm test
npm run build
# Verify all reminder formats still work
```

---

## Phase 7: Dependency & Build Optimization (Week 7)

### 7.1 Move `svelte` to devDependencies

**File**: `package.json`

```json
{
  "dependencies": {
    "rrule": "^2.8.1"
  },
  "devDependencies": {
    "svelte": "^5.57.3",
    // ... other dev deps
  }
}
```

### 7.2 Remove Svelte Tooling (if Phase 2-4 complete)

**Remove from `devDependencies`**:
- `esbuild-svelte`
- `svelte-preprocess`
- `prettier-plugin-svelte`
- `svelte-check`
- `eslint-plugin-svelte`
- `svelte-eslint-parser`
- `@tsconfig/svelte`

**Update `esbuild.config.mjs`**: Remove `esbuildSvelte` plugin.

**Update `eslint.config.js`**: Remove Svelte-related rules.

**Update `tsconfig.json`**: Remove `"svelte"` from `types` array.

### 7.3 Aggressive Minification

**File**: `esbuild.config.mjs`

```javascript
minify: prod ? {
  compress: {
    passes: 2,
    pure_funcs: ["console.debug", "console.log"],
  },
  mangle: true,
} : false,
```

### 7.4 Update Minimum Obsidian Version

**File**: `manifest.json`

```json
{
  "minAppVersion": "1.13.0"
}
```

### 7.5 Validation

```bash
npm install  # Clean install
npm run lint
npm test
npm run build
# Check bundle size: ls -la main.js styles.css
# Target: main.js < 200 KB
```

---

## Phase 8: Testing & Documentation (Week 7-8)

### 8.1 Settings Migration Test

**Create**: `src/plugin/settings/migration.test.ts`

```typescript
import { PluginData } from "plugin/core/data";
import { Reminders } from "model/reminders";
import { Settings } from "plugin/settings";

describe("Settings migration", () => {
  test("loads old data.json format correctly", async () => {
    const mockStore = {
      loadData: async () => ({
        scanned: true,
        settings: {
          reminderTime: "09:00",
          enableNotification: true,
          // ... all old keys
        },
        reminders: {},
      }),
      saveData: async () => {},
    };
    
    const reminders = new Reminders(() => {});
    const data = new PluginData(mockStore as any, reminders);
    await data.load();
    
    // Verify all settings loaded
    expect(data.settings.notifications.reminderTime.value.toString()).toBe("09:00");
    expect(data.settings.notifications.enableNotification.value).toBe(true);
    // ...
  });
});
```

### 8.2 Performance Benchmarks

**Create**: `src/benchmark.ts` (run manually)

```typescript
import { Reminders } from "model/reminders";
import { Reminder } from "model/reminder";
import { DateTime } from "model/time";

function benchmark(name: string, fn: () => void, iterations = 1000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(2)}ms for ${iterations} iterations`);
}

// Benchmark getExpiredReminders with 1000 reminders
const reminders = new Reminders(() => {});
for (let i = 0; i < 1000; i++) {
  reminders.replaceSourceFile(`file${i}.md`, "markdown", [
    new Reminder(`file${i}.md`, `Task ${i}`, DateTime.now().add(1, "hours"), i, false)
  ]);
}

benchmark("getExpiredReminders (cached)", () => reminders.getExpiredReminders());
benchmark("getExpiredReminders (uncached)", () => {
  reminders.invalidateExpiredCache();
  reminders.getExpiredReminders();
});
```

### 8.3 Manual Verification Checklist

Run in test vault after each phase:

- [ ] Settings tab opens, all settings editable
- [ ] Settings persist across reloads
- [ ] Reminder list view opens, shows groups
- [ ] Click reminder → opens file
- [ ] Drag reminder → creates link
- [ ] Editor pills render in Live Preview
- [ ] Click pill → opens date/time chooser
- [ ] Date/time chooser: calendar, quick picks, time picker work
- [ ] Reminder notifications: modal + toast + system
- [ ] Keyboard shortcuts in reminder popup (Alt+D, Alt+M, etc.)
- [ ] Language switching (EN/JA/ZH-CN)
- [ ] TaskNotes integration (if applicable)
- [ ] ntfy integration (if configured)
- [ ] Status bar shows overdue count
- [ ] DND status bar works
- [ ] Vault scan on startup completes
- [ ] File modify/delete/rename updates reminders

### 8.4 Update Documentation

- `CLAUDE.md` — Update architecture section
- `README.md` — Update if needed
- `docs/` — Update VuePress docs if settings UI changed

---

## File Inventory for Implementation

### Files to Create
| File | Phase | Purpose |
|------|-------|---------|
| `src/plugin/settings/setting-tab.ts` | 1 | Native `PluginSettingTab` |
| `src/ui/common/icon-text.ts` | 2 | `createIconText()` helper |
| `src/plugin/settings/migration.test.ts` | 8 | Settings migration test |
| `src/benchmark.ts` | 8 | Performance benchmarks |

### Files to Modify Significantly
| File | Phase | Changes |
|------|-------|---------|
| `src/main.ts` | 1, 5 | Register setting tab, defer initialization |
| `src/plugin/core/data.ts` | 1, 5 | Add `lastScanMtime`, simplify `DataStore` |
| `src/plugin/core/filesystem.ts` | 5 | Incremental scan using `lastScanMtime` |
| `src/plugin/core/notification-worker.ts` | 5 | Idle callback for initial scan |
| `src/model/reminders.ts` | 5 | Expired cache + change events |
| `src/plugin/ui/status-bar/overdue-status-bar.ts` | 5 | Event-driven refresh |
| `src/plugin/ui/views/reminder-list.ts` | 3 | `DeferredView` + manual DOM |
| `src/plugin/ui/editor/editor-reminder-display/pill-widget.ts` | 2 | Vanilla TS pill widget |
| `src/model/format/reminder-base.ts` | 6 | Remove `ReminderFormatConfig` |
| `src/model/format/*.ts` | 6 | Direct settings access |
| `esbuild.config.mjs` | 2, 4, 7 | Remove Svelte 4 compat, Svelte plugin |
| `package.json` | 7 | Move svelte to devDeps, remove tooling |
| `manifest.json` | 7 | `minAppVersion: "1.13.0"` |

### Files to Delete
| File | Phase |
|------|-------|
| `src/plugin/settings/tab-model.ts` | 1 |
| `src/plugin/settings/setting-model.ts` | 1 |
| `src/plugin/settings/setting-builders.ts` | 1 |
| `src/plugin/settings/serdes.ts` | 1 |
| `src/plugin/settings/settings-tab.css` | 1 |
| `src/ui/common/IconText.svelte` | 2 |
| `src/ui/common/Markdown.svelte` | 2 |
| `src/plugin/ui/editor/editor-reminder-display/ReminderPill.svelte` | 2 |
| `src/ui/list/ReminderList.svelte` | 3 |
| `src/ui/list/ReminderListByDate.svelte` | 3 |
| `src/plugin/obsidian-hack/leaf.ts` | 6 (if unused) |
| `src/plugin/obsidian-hack/obsidian-debug-mobile.ts` | 6 (if unused) |

### Files to Migrate (Svelte 4 → 5)
| File | Phase |
|------|-------|
| `src/ui/reminder/Reminder.svelte` | 4 |
| `src/ui/datetime/DateTimeChooser.svelte` | 4 |
| `src/ui/datetime/Calendar.svelte` | 4 |
| `src/ui/datetime/TimePicker.svelte` | 4 |

---

## Risk Register & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Settings keys mismatch after migration | Medium | High | `settings-layout.test.ts` guards keys; add migration test |
| Svelte 5 migration breaks components | Medium | High | Migrate one component at a time; `git restore` fallback |
| Incremental scan misses files | Low | Medium | Fallback to full scan if `lastScanMtime === 0`; test thoroughly |
| `DeferredView` not available (Obsidian < 1.13) | None | N/A | `minAppVersion: 1.13.0` enforced |
| Bundle size doesn't shrink enough | Low | Medium | Verify each phase; aggressive minification in Phase 7 |
| Notification worker cache stale | Low | High | Short TTL (5s); invalidate on all mutations |
| TaskNotes integration breaks | Low | High | Test with TaskNotes plugin installed; defer init to layout ready |

---

## Success Criteria

| Criterion | Target |
|-----------|--------|
| All existing tests pass | ✅ 508 tests |
| No TypeScript errors | ✅ `npx tsc --noEmit` |
| No lint errors | ✅ `npm run lint` (warnings OK) |
| Bundle size < 200 KB | ✅ `main.js` |
| Zero Svelte deprecation warnings | ✅ `npm run lint` |
| Settings persist correctly | ✅ Manual + migration test |
| All features work in Obsidian | ✅ Manual checklist |
| Startup time improved | ✅ Benchmark |
| Steady-state CPU minimal | ✅ No periodic work visible in profiler |

---

## Notes for Implementing Agent

1. **Work in Phases**: Complete each phase fully before moving to next. Run `npm test` and `npm run lint` after each phase.

2. **Preserve Setting Keys**: The `settings-layout.test.ts` test validates that setting keys in `data.json` never change. Do not rename any setting key.

3. **Test in Real Obsidian**: Unit tests don't cover UI. After each phase, load the plugin in a test vault (use `manual-verify` skill) and verify functionality.

4. **Svelte 5 Migration**: The 4 remaining components are interdependent (`DateTimeChooser` uses `Calendar` and `TimePicker`). Migrate them together in one PR.

5. **Performance Measurement**: Use `console.time()` / `performance.now()` in `main.ts` to measure startup phases. Compare before/after.

6. **Git Hygiene**: Commit after each phase with descriptive messages. Tag `pre-modernization` before starting.

7. **Rollback Plan**: If any phase causes unrecoverable issues, `git restore .` and report blockers.

---

## Appendix: Key Code Patterns

### Native Setting with Dynamic Enable/Disable
```typescript
const parent = new Setting(containerEl)
  .setName(t("Use system notification"))
  .addToggle(toggle => toggle
    .setValue(settings.useSystemNotification.value)
    .onChange(async (value) => {
      settings.useSystemNotification.rawValue.value = value;
      child1.settingEl.toggleClass("is-hidden", !value);
      child2.settingEl.toggleClass("is-hidden", !value);
    }));

const child1 = new Setting(containerEl)
  .setName(t("Show popup with system notification"))
  .setDisabled(!settings.useSystemNotification.value);
// ...
```

### Event-Driven Pattern (Reminders → Status Bar)
```typescript
// In Reminders class
onChanged(listener: () => void) {
  this.listeners.add(listener);
  return () => this.listeners.delete(listener);
}

// In StatusBar.onload()
this.unsubscribe = this.plugin.reminders.onChanged(() => this.refresh());

// In StatusBar.destroy() / onunload()
this.unsubscribe?.();
```

### Incremental Scan Pattern
```typescript
const filesToScan = this.lastScanMtime > 0
  ? this.vault.getMarkdownFiles().filter(f => f.stat.mtime > this.lastScanMtime)
  : this.vault.getMarkdownFiles();

if (this.lastScanMtime === 0) {
  this.reminders.clearSource("markdown");
}

for (const file of filesToScan) {
  await this.reloadRemindersInFile(file);
}
this.lastScanMtime = Date.now();
```

---

*End of Modernization Plan*