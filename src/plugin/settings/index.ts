import { setReminderFormatConfig } from "model/format";
import {
  ReminderFormatConfig,
  ReminderFormatParameterKey,
} from "model/format/reminder-base";
import {
  DEFAULT_STATUSES_TEXT,
  StatusRegistry,
  formatStatusSetting,
  parseStatusSetting,
} from "model/format/status";
import type { TaskStatus } from "model/format/status";
import { DateTime } from "model/time";
import { type LanguageSetting, setLanguage } from "i18n";
import { AdvancedSettings } from "plugin/settings/sections/advanced";
import { DisplaySettings } from "plugin/settings/sections/display";
import { EditorSettings } from "plugin/settings/sections/editor";
import { NtfySettings } from "plugin/settings/sections/ntfy";
import { NotificationsSettings } from "plugin/settings/sections/notifications";
import { TaskNotesSettings } from "plugin/settings/sections/tasknotes";
import { SettingTabModel } from "./tab-model";

import type { SettingModelBase } from "./setting-model";
import { ReminderFormatSettings } from "./sections/reminder-formats";

export const TAG_RESCAN = "re-scan";

/**
 * The default statuses the "Task statuses" setting extends, seeded from the
 * Tasks plugin's own status settings at load time (see `main.ts`): the whole
 * registry when the setting is empty, the merge base under the user's lines
 * otherwise. Empty when the Tasks plugin is absent, which keeps
 * `StatusRegistry.EMPTY`'s historical x/- behavior for an empty setting.
 */
let seededTaskStatusesText = "";

export function setSeededTaskStatuses(statuses: Array<TaskStatus>): void {
  seededTaskStatusesText = formatStatusSetting(statuses);
}

export class Settings {
  settings: SettingTabModel = new SettingTabModel();
  notifications: NotificationsSettings;
  taskNotes: TaskNotesSettings;
  ntfy: NtfySettings;
  editor: EditorSettings;
  display: DisplaySettings;
  advanced: AdvancedSettings;
  reminderFormatSettings: ReminderFormatSettings;

  // Delegate properties for backward compatibility
  get dateFormat() {
    return this.editor.dateFormat;
  }
  get dateTimeFormat() {
    return this.editor.dateTimeFormat;
  }
  get strictDateFormat() {
    return this.editor.strictDateFormat;
  }
  get linkDatesToDailyNotes() {
    return this.editor.linkDatesToDailyNotes;
  }
  get useCustomEmojiForTasksPlugin() {
    return this.editor.useCustomEmojiForTasksPlugin;
  }
  get useReminderTimeFallbackForTasksPlugin() {
    return this.editor.useReminderTimeFallbackForTasksPlugin;
  }
  get removeTagsForTasksPlugin() {
    return this.editor.removeTagsForTasksPlugin;
  }
  get taskStatuses() {
    return this.editor.taskStatuses;
  }
  get dataviewReminderFieldName() {
    return this.editor.dataviewReminderFieldName;
  }
  get weekStart() {
    return this.display.weekStart;
  }
  get yearMonthDisplayFormat() {
    return this.display.yearMonthDisplayFormat;
  }
  get monthDayDisplayFormat() {
    return this.display.monthDayDisplayFormat;
  }
  get shortDateWithWeekdayDisplayFormat() {
    return this.display.shortDateWithWeekdayDisplayFormat;
  }
  get timeDisplayFormat() {
    return this.display.timeDisplayFormat;
  }
  get excludedPaths() {
    return this.advanced.excludedPaths;
  }
  get editDetectionSec() {
    return this.advanced.editDetectionSec;
  }
  get reminderCheckIntervalSec() {
    return this.advanced.reminderCheckIntervalSec;
  }
  get editorReminderDisplay() {
    return this.editor.editorReminderDisplay;
  }
  get autoCompleteTrigger() {
    return this.editor.autoCompleteTrigger;
  }
  get convertNonTaskLines() {
    return this.editor.convertNonTaskLines;
  }
  get primaryFormat() {
    return this.editor.primaryFormat;
  }

  constructor() {
    const reminderFormatSettings = new ReminderFormatSettings(this.settings);
    this.reminderFormatSettings = reminderFormatSettings;

    this.notifications = new NotificationsSettings(this.settings);
    this.taskNotes = new TaskNotesSettings(this.settings);
    this.editor = new EditorSettings(this.settings, reminderFormatSettings);
    this.display = new DisplaySettings(this.settings, reminderFormatSettings);
    // Also fires while `PluginData` restores the persisted settings, so a
    // saved value is applied before anything is rendered.
    this.display.language.rawValue.onChanged(() => {
      this.applyLanguage();
    });

    this.ntfy = new NtfySettings(this.settings);
    this.advanced = new AdvancedSettings(this.settings);

    this.notifications.addToTab();
    this.taskNotes.addToTab();
    this.editor.addToTab();
    const reminderFormatsPage = this.settings.newPage("Reminder formats");
    reminderFormatsPage
      .newGroup("Reminder plugin format")
      .addSettings(
        reminderFormatSettings.enableReminderPluginReminderFormat,
        this.editor.dateFormat,
        this.editor.dateTimeFormat,
        this.editor.strictDateFormat,
        this.editor.linkDatesToDailyNotes,
      );
    reminderFormatsPage
      .newGroup("Tasks plugin format")
      .addSettings(
        reminderFormatSettings.enableTasksPluginReminderFormat,
        this.editor.useCustomEmojiForTasksPlugin,
        this.editor.useReminderTimeFallbackForTasksPlugin,
        this.editor.removeTagsForTasksPlugin,
      );
    // A group of its own, not a "Tasks plugin format" sibling: the registry
    // drives isChecked/setChecked for EVERY format plus the
    // toggle-checklist-status command — only the seed comes from Tasks. It
    // also must not take that group's setEnabled wiring: users with the
    // Tasks format turned off are exactly the ones who need to edit this.
    reminderFormatsPage
      .newGroup("Task statuses")
      .addSettings(this.editor.taskStatuses);
    reminderFormatsPage
      .newGroup("Dataview format")
      .addSettings(
        reminderFormatSettings.enableDataviewReminderFormat,
        this.editor.dataviewReminderFieldName,
      );
    reminderFormatsPage
      .newGroup("Kanban plugin format")
      .addSettings(reminderFormatSettings.enableKanbanPluginReminderFormat);
    this.display.addToTab();
    this.ntfy.addToTab();
    this.advanced.addToTab();
  }

  setTaskNotesSettingsFetcher(fetcher: () => Promise<string>): void {
    this.taskNotes.setSettingsFetcher(fetcher);
  }

  /**
   * Applies the "Language" setting value to the translation layer.
   *
   * A fresh install has no persisted value for this setting, so `load()` never
   * assigns it and the setting's own change listener never fires: the plugin
   * calls this once after loading, to resolve "automatic" against Obsidian's
   * UI language. Safe to call repeatedly -- it only notifies when the resolved
   * language actually changes.
   */
  public applyLanguage(): void {
    setLanguage(this.display.language.value as LanguageSetting);
  }

  /**
   * Installs this instance's setting values as the process-wide reminder-format
   * config (via `setReminderFormatConfig()`), rebinding the config used by every
   * reminder-format singleton (e.g. `TasksPluginFormat.instance`).
   *
   * This has a global side effect and must be called exactly once, for the
   * plugin's real `Settings` instance (see `PluginData`'s constructor). A
   * stray `new Settings()` elsewhere (e.g. previously in a UI component) must
   * never call this, or it would silently revert every format setting to its
   * default value for the whole process (see issue #248).
   */
  public wireReminderFormatConfig(): void {
    const config = new ReminderFormatConfig();
    config.setParameterFunc(ReminderFormatParameterKey.now, () =>
      DateTime.now(),
    );
    config.setParameter(
      ReminderFormatParameterKey.useCustomEmojiForTasksPlugin,
      this.editor.useCustomEmojiForTasksPlugin,
    );
    config.setParameter(
      ReminderFormatParameterKey.linkDatesToDailyNotes,
      this.editor.linkDatesToDailyNotes,
    );
    config.setParameter(
      ReminderFormatParameterKey.removeTagsForTasksPlugin,
      this.editor.removeTagsForTasksPlugin,
    );
    config.setParameter(
      ReminderFormatParameterKey.useReminderTimeFallbackForTasksPlugin,
      this.editor.useReminderTimeFallbackForTasksPlugin,
    );
    config.setParameter(
      ReminderFormatParameterKey.dataviewReminderFieldName,
      this.editor.dataviewReminderFieldName,
    );
    // The registry is rebuilt only when the effective text changes: parsing
    // runs per keystroke otherwise (every parse() call reads the parameter).
    let lastText: string | null = null;
    let lastRegistry = StatusRegistry.EMPTY;
    config.setParameterFunc(ReminderFormatParameterKey.taskStatuses, () => {
      // The user's lines EXTEND the defaults rather than replacing them:
      // someone who adds just "[/] -> [x] IN_PROGRESS" must not turn every
      // "- [x]" in the vault back into an active reminder. User lines come
      // first, and the registry keeps the first definition per symbol, so a
      // user line wins on a duplicate. An empty setting stays the pure
      // seed/EMPTY path, which is what preserves the historical behavior
      // when neither the user nor the Tasks plugin defines anything.
      const userText = this.editor.taskStatuses.value;
      const text = userText.trim().length
        ? userText +
          "\n" +
          (seededTaskStatusesText.trim().length
            ? seededTaskStatusesText
            : DEFAULT_STATUSES_TEXT)
        : seededTaskStatusesText;
      if (text !== lastText) {
        lastText = text;
        lastRegistry = new StatusRegistry(parseStatusSetting(text));
      }
      return lastRegistry;
    });
    setReminderFormatConfig(config);
  }

  public forEach(consumer: (setting: SettingModelBase) => void) {
    this.settings.forEach(consumer);
  }
}
