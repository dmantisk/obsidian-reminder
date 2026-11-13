import { App, PluginSettingTab, Setting, requestUrl } from "obsidian";
import { t } from "i18n";
import { LANGUAGE_SETTINGS, languageLabel, weekdayName } from "i18n";
import type { LanguageSetting } from "i18n";
import {
  ReminderFormatType,
  ReminderFormatTypes,
  changeReminderFormat,
} from "model/format";
import { isValidNtfyTopic } from "model/ntfy";
import { testNtfyConnection } from "plugin/ntfy/connection-test";
import type { Settings } from "./index";

export class ReminderSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private pluginSettings: Settings,
  ) {
    super(app, pluginSettings);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Notifications page
    this.addNotificationsSettings(containerEl);
    // TaskNotes integration page
    this.addTaskNotesSettings(containerEl);
    // Editor page
    this.addEditorSettings(containerEl);
    // Reminder formats page
    this.addReminderFormatsSettings(containerEl);
    // Display page
    this.addDisplaySettings(containerEl);
    // ntfy page
    this.addNtfySettings(containerEl);
    // Advanced page
    this.addAdvancedSettings(containerEl);
  }

  private addNotificationsSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("").setHeading();

    // Reminder time
    new Setting(containerEl)
      .setName(t("Reminder time"))
      .setDesc(t("Time when a reminder with no time part will show"))
      .addText((text) =>
        text
          .setPlaceholder("09:00")
          .setValue(
            this.pluginSettings.notifications.reminderTime.value.toString(),
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.reminderTime.rawValue.value =
              value;
          }),
      );

    // Reminder time step
    new Setting(containerEl)
      .setName(t("Reminder time step (minutes)"))
      .setDesc(t("Step of time for reminder time (minutes)"))
      .addText((text) =>
        text
          .setValue(
            String(this.pluginSettings.notifications.reminderTimeStep.value),
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.reminderTimeStep.rawValue.value =
              parseInt(value, 10);
          }),
      );

    // Remind me later
    new Setting(containerEl)
      .setName(t("Remind me later"))
      .setDesc(t("Line-separated list of remind me later items"))
      .addTextArea((text) =>
        text
          .setPlaceholder(
            "In 30 minutes\nIn 1 hour\nIn 3 hours\nTomorrow\nNext week",
          )
          .setValue(
            this.pluginSettings.notifications.laters.value
              .map((l) => l.label)
              .join("\n"),
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.laters.rawValue.value = value;
          }),
      );

    // Enable reminder notifications
    new Setting(containerEl)
      .setName(t("Enable reminder notifications"))
      .setDesc(
        t(
          "If disabled, reminder popups and system notifications are not shown. The reminder list view keeps working.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.notifications.enableNotification.value)
          .onChange(async (value) => {
            this.pluginSettings.notifications.enableNotification.rawValue.value =
              value;
          }),
      );

    // Re-notify muted reminders on startup
    new Setting(containerEl)
      .setName(t("Re-notify muted reminders on startup"))
      .setDesc(
        t(
          'When enabled, reminders you previously muted are notified again the next time Obsidian starts. Useful if you rely on startup notifications to review overdue reminders. If many reminders are overdue, they are shown one after another — use the "Mute all current notifications" command to silence them again.',
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.notifications.reNotifyMutedOnStartup.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.reNotifyMutedOnStartup.rawValue.value =
              value;
          }),
      );

    // Reminder popup style
    new Setting(containerEl)
      .setName(t("Reminder popup style"))
      .setDesc(
        t(
          "Toast: a card in the corner of the window that does not interrupt your work. Modal: a dialog in the center of the window that takes focus.",
        ),
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("toast", t("Toast (corner card)"))
          .addOption("modal", t("Modal (center dialog)"))
          .setValue(
            this.pluginSettings.notifications.notificationPopupStyle.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.notificationPopupStyle.rawValue.value =
              value;
          }),
      );

    // Open note on reminder click
    new Setting(containerEl)
      .setName(t("Open note on reminder click"))
      .setDesc(
        t(
          "When clicking a reminder in the reminder list or a system notification, open the note directly instead of showing the reminder popup.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.notifications.openNoteOnReminderClick.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.openNoteOnReminderClick.rawValue.value =
              value;
          }),
      );

    // Use system notification
    new Setting(containerEl)
      .setName(t("Use system notification"))
      .setDesc(t("Use system notification for reminder notifications"))
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.notifications.useSystemNotification.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.useSystemNotification.rawValue.value =
              value;
            // Update dependent settings visibility
            this.updateSystemNotificationDependents();
          }),
      );

    // Show popup with system notification
    this.systemNotifDependentSetting = new Setting(containerEl)
      .setName(t("Show popup together with system notification"))
      .setDesc(
        t(
          "When using system notification, also show the built-in reminder popup at the same time. The popup handles the reminder actions; the system notification acts as an alert only.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.notifications.showPopupWithSystemNotification
              .value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.showPopupWithSystemNotification.rawValue.value =
              value;
          }),
      );

    // Keep system notification on screen
    this.keepNotifDependentSetting = new Setting(containerEl)
      .setName(t("Keep system notification on screen"))
      .setDesc(
        t(
          "Keep the system notification on screen until you interact with it, instead of it disappearing after a few seconds. Only effective on Windows and Linux; ignored on macOS. Enable this if you use the same vault on multiple devices (e.g. via Obsidian Sync): it allows the plugin to dismiss the notification when you complete or snooze the reminder on another device.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.notifications.keepSystemNotificationOnScreen
              .value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.keepSystemNotificationOnScreen.rawValue.value =
              value;
          }),
      );

    // Focus Done button on popup
    new Setting(containerEl)
      .setName(t("Focus Done button on popup"))
      .setDesc(
        t(
          "Automatically focus the Done button when a reminder popup opens, so pressing Enter completes the task. Off by default to prevent accidentally completing a reminder you haven't read.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.notifications.focusDoneButtonOnPopup.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.focusDoneButtonOnPopup.rawValue.value =
              value;
          }),
      );

    // Show overdue count in status bar
    new Setting(containerEl)
      .setName(t("Show overdue count in status bar"))
      .setDesc(
        t(
          "Show the number of overdue reminders in the status bar. Click it to open the reminder list.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.notifications.showOverdueCountInStatusBar.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.notifications.showOverdueCountInStatusBar.rawValue.value =
              value;
          }),
      );

    // Initialize dependent settings visibility
    this.updateSystemNotificationDependents();
  }

  private systemNotifDependentSetting!: Setting;
  private keepNotifDependentSetting!: Setting;

  private updateSystemNotificationDependents(): void {
    const enabled =
      this.pluginSettings.notifications.useSystemNotification.value;
    this.systemNotifDependentSetting.settingEl.toggleClass(
      "is-hidden",
      !enabled,
    );
    this.keepNotifDependentSetting.settingEl.toggleClass("is-hidden", !enabled);
  }

  private addTaskNotesSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("").setHeading();

    // Enable TaskNotes integration
    const enabledSetting = new Setting(containerEl)
      .setName(t("Enable TaskNotes integration"))
      .setDesc(
        t(
          "Read TaskNotes reminder metadata from task-note frontmatter. Writing a completed status is optional and controlled by the Done behavior setting.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.taskNotes.enabled.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.enabled.rawValue.value = value;
          }),
      );

    // Fetch from TaskNotes button
    enabledSetting.addButton((button) =>
      button.setButtonText(t("Fetch from TaskNotes")).onClick(async () => {
        // We need to show a temporary notice/info - use the setting's descEl for this
        const infoEl = enabledSetting.descEl.createDiv("setting-item-info");
        infoEl.setText(t("Fetching settings from TaskNotes…"));
        try {
          const fetchSettings = this.pluginSettings.taskNotes.settingsFetcher;
          if (!fetchSettings) {
            throw new Error("TaskNotes settings fetch is not available.");
          }
          const result = await fetchSettings();
          infoEl.setText(result);
        } catch (error) {
          console.error("Failed to fetch TaskNotes settings: %o", error);
          infoEl.setText(
            error instanceof Error
              ? error.message
              : "Could not fetch TaskNotes settings.",
          );
        }
      }),
    );

    // Task identification mode
    new Setting(containerEl)
      .setName(t("Task identification mode"))
      .setDesc(t("Choose which notes are considered TaskNotes tasks."))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("tag", t("Task tag"))
          .addOption("property", t("Property"))
          .addOption("reminders", t("Any note with valid reminders"))
          .setValue(this.pluginSettings.taskNotes.identificationMode.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.identificationMode.rawValue.value =
              value;
          }),
      );

    // Task tag
    new Setting(containerEl)
      .setName(t("Task tag"))
      .setDesc(
        t(
          "Tag used to identify task notes when identification mode is Task tag.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("task")
          .setValue(this.pluginSettings.taskNotes.tag.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.tag.rawValue.value = value;
          }),
      );

    // Task identification property
    new Setting(containerEl)
      .setName(t("Task identification property"))
      .setDesc(t("Property name used to identify task notes in Property mode."))
      .addText((text) =>
        text
          .setPlaceholder("type")
          .setValue(this.pluginSettings.taskNotes.identificationProperty.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.identificationProperty.rawValue.value =
              value;
          }),
      );

    // Task identification property value
    new Setting(containerEl)
      .setName(t("Task identification property value"))
      .setDesc(
        t(
          "Required property value. Leave empty to identify notes by property presence.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("task")
          .setValue(this.pluginSettings.taskNotes.identificationValue.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.identificationValue.rawValue.value =
              value;
          }),
      );

    // Excluded folders
    new Setting(containerEl)
      .setName(t("Excluded folders"))
      .setDesc(
        t(
          "One folder path per line. TaskNotes reminders in these folders are ignored.",
        ),
      )
      .addTextArea((text) =>
        text
          .setValue(
            this.pluginSettings.taskNotes.excludedFolders.value.join("\n"),
          )
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.excludedFolders.rawValue.value =
              value;
          }),
      );

    // Completed statuses
    new Setting(containerEl)
      .setName(t("Completed statuses"))
      .setDesc(t("One completed status per line."))
      .addTextArea((text) =>
        text
          .setValue(this.pluginSettings.taskNotes.completedStatuses.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.completedStatuses.rawValue.value =
              value;
          }),
      );

    // Skip completed tasks
    new Setting(containerEl)
      .setName(t("Skip completed tasks"))
      .setDesc(
        t(
          "Skip tasks with a completed status, status: true, or a completedDate on a non-recurring task.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.taskNotes.skipCompleted.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.skipCompleted.rawValue.value = value;
          }),
      );

    // Skip archived tasks
    new Setting(containerEl)
      .setName(t("Skip archived tasks"))
      .setDesc(t("Skip tasks carrying the configured archive tag."))
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.taskNotes.skipArchived.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.skipArchived.rawValue.value = value;
          }),
      );

    // Archive tag
    new Setting(containerEl)
      .setName(t("Archive tag"))
      .setDesc(t("Tag used to identify archived tasks."))
      .addText((text) =>
        text
          .setPlaceholder("archived")
          .setValue(this.pluginSettings.taskNotes.archiveTag.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.archiveTag.rawValue.value = value;
          }),
      );

    // Skip completed recurring instances
    new Setting(containerEl)
      .setName(t("Skip completed recurring instances"))
      .setDesc(
        t(
          "Skip a reminder when its anchor date appears in complete_instances or skipped_instances.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.taskNotes.skipRecurringInstances.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.skipRecurringInstances.rawValue.value =
              value;
          }),
      );

    // Date-only anchor time
    new Setting(containerEl)
      .setName(t("Date-only anchor time"))
      .setDesc(
        t(
          "Local time used when a due or scheduled date has no time component. TaskNotes specifies 00:00 by default.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("00:00")
          .setValue(this.pluginSettings.taskNotes.dateOnlyAnchorTime.value)
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.dateOnlyAnchorTime.rawValue.value =
              value;
          }),
      );

    // Ignore reminders older than (days)
    new Setting(containerEl)
      .setName(t("Ignore reminders older than (days)"))
      .setDesc(
        t(
          "Ignore TaskNotes reminders whose trigger is older than this many days, preventing a flood when the integration is enabled.",
        ),
      )
      .addText((text) =>
        text
          .setValue(
            String(this.pluginSettings.taskNotes.ignoreOlderThanDays.value),
          )
          .onChange(async (value) => {
            this.pluginSettings.taskNotes.ignoreOlderThanDays.rawValue.value =
              parseInt(value, 10);
          }),
      );

    // TaskNotes property names (collapsible group)
    const propertyGroup = containerEl.createEl("details", {
      cls: "setting-group-collapsible",
    });
    propertyGroup.createEl("summary", { text: t("TaskNotes property names") });
    const propertyContainer = propertyGroup.createDiv();

    const propertySetting = (key: string, name: string, value: string) => {
      new Setting(propertyContainer).setName(t(name)).addText((text) =>
        text
          .setPlaceholder(value)
          .setValue(
            this.pluginSettings.taskNotes.properties[
              key as keyof typeof this.pluginSettings.taskNotes.properties
            ].value,
          )
          .onChange(async (val) => {
            this.pluginSettings.taskNotes.properties[
              key as keyof typeof this.pluginSettings.taskNotes.properties
            ].rawValue.value = val;
          }),
      );
    };

    propertySetting("taskNotesPropertyTitle", "Title", "title");
    propertySetting("taskNotesPropertyStatus", "Status", "status");
    propertySetting("taskNotesPropertyDue", "Due", "due");
    propertySetting("taskNotesPropertyScheduled", "Scheduled", "scheduled");
    propertySetting("taskNotesPropertyReminders", "Reminders", "reminders");
    propertySetting(
      "taskNotesPropertyCompletedDate",
      "Completed date",
      "completedDate",
    );
    propertySetting("taskNotesPropertyRecurrence", "Recurrence", "recurrence");
    propertySetting(
      "taskNotesPropertyCompleteInstances",
      "Complete instances",
      "complete_instances",
    );
    propertySetting(
      "taskNotesPropertySkippedInstances",
      "Skipped instances",
      "skipped_instances",
    );
  }

  private addEditorSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("").setHeading();

    const reminderFormatSettings = this.pluginSettings.reminderFormatSettings;

    // Calendar popup trigger
    const triggerSetting = new Setting(containerEl)
      .setName(t("Calendar popup trigger"))
      .setDesc(t("Trigger text to show calendar popup"))
      .addText((text) =>
        text
          .setPlaceholder("(@")
          .setValue(this.pluginSettings.editor.autoCompleteTrigger.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.autoCompleteTrigger.rawValue.value =
              value;
            const info =
              value.length === 0
                ? t("Popup is disabled")
                : t("Popup is enabled");
            triggerSetting.setDesc(info);
          }),
      );

    // Convert non-task lines
    new Setting(containerEl)
      .setName(t("Convert non-task lines when inserting a reminder"))
      .setDesc(
        t(
          'When inserting a reminder from the calendar popup on a line that is not a task, convert the line into a task list item ("- [ ] ") automatically. When disabled, a notice is shown instead.',
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.editor.convertNonTaskLines.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.convertNonTaskLines.rawValue.value =
              value;
          }),
      );

    // Primary reminder format
    new Setting(containerEl)
      .setName(t("Primary reminder format"))
      .setDesc(t("Reminder format for generated reminder by calendar popup"))
      .addDropdown((dropdown) => {
        ReminderFormatTypes.forEach((f) => {
          dropdown.addOption(f.name, `${t(f.description)} - ${f.example}`);
        });
        dropdown
          .setValue(this.pluginSettings.editor.primaryFormat.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.primaryFormat.rawValue.value = value;
          });
      });

    // Show reminder pills in editor
    new Setting(containerEl)
      .setName(t("Show reminder pills in editor"))
      .setDesc(
        t(
          "Render each reminder's time as a clickable pill (⏰) in Live Preview. Clicking a pill opens the date/time chooser to change it. Disable to show the raw reminder text instead.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.editor.editorReminderDisplay.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.editorReminderDisplay.rawValue.value =
              value;
          }),
      );

    // Reminder plugin format settings (enabled when reminder plugin format is enabled)
    const reminderPluginEnabled =
      reminderFormatSettings?.enableReminderPluginReminderFormat.value ?? true;

    // Date format
    const dateFormatSetting = new Setting(containerEl)
      .setName(t("Date format"))
      .setDesc(
        t(
          "moment style date format: https://momentjs.com/docs/#/displaying/format/",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.pluginSettings.editor.dateFormat.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.dateFormat.rawValue.value = value;
          }),
      );
    dateFormatSetting.settingEl.toggleClass(
      "is-hidden",
      !reminderPluginEnabled,
    );

    // Date and time format
    const dateTimeFormatSetting = new Setting(containerEl)
      .setName(t("Date and time format"))
      .setDesc(
        t(
          "moment() style date time format: https://momentjs.com/docs/#/displaying/format/",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD HH:mm")
          .setValue(this.pluginSettings.editor.dateTimeFormat.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.dateTimeFormat.rawValue.value = value;
          }),
      );
    dateTimeFormatSetting.settingEl.toggleClass(
      "is-hidden",
      !reminderPluginEnabled,
    );

    // Strict date format
    const strictDateFormatSetting = new Setting(containerEl)
      .setName(t("Strict date format"))
      .setDesc(t("Strictly parse the date and time"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.editor.strictDateFormat.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.strictDateFormat.rawValue.value = value;
          }),
      );
    strictDateFormatSetting.settingEl.toggleClass(
      "is-hidden",
      !reminderPluginEnabled,
    );

    // Link dates to daily notes
    const linkDatesSetting = new Setting(containerEl)
      .setName(t("Link dates to daily notes"))
      .setDesc(t("When toggled, Dates link to daily notes."))
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.editor.linkDatesToDailyNotes.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.linkDatesToDailyNotes.rawValue.value =
              value;
          }),
      );
    linkDatesSetting.settingEl.toggleClass("is-hidden", !reminderPluginEnabled);

    // Tasks plugin format settings
    const tasksPluginEnabled =
      reminderFormatSettings?.enableTasksPluginReminderFormat.value ?? false;

    // Use custom emoji for Tasks plugin
    this.customEmojiSetting = new Setting(containerEl)
      .setName(t("Distinguish between reminder date and due date"))
      .setDesc(
        t(
          "Use custom emoji ⏰ instead of 📅 and distinguish between reminder date/time and Tasks Plugin's due date.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.editor.useCustomEmojiForTasksPlugin.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.editor.useCustomEmojiForTasksPlugin.rawValue.value =
              value;
            this.updateTasksPluginDependents();
          }),
      );
    this.customEmojiSetting.settingEl.toggleClass(
      "is-hidden",
      !tasksPluginEnabled,
    );

    // Fall back to due, scheduled, or start date
    this.fallbackSetting = new Setting(containerEl)
      .setName(t("Fall back to due, scheduled, or start date"))
      .setDesc(
        t(
          "When the reminder date (⏰) is missing, use the due date (📅), then the scheduled date (⏳), then the start date (🛫), in that order.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(
            this.pluginSettings.editor.useReminderTimeFallbackForTasksPlugin
              .value,
          )
          .onChange(async (value) => {
            this.pluginSettings.editor.useReminderTimeFallbackForTasksPlugin.rawValue.value =
              value;
          }),
      );
    this.fallbackSetting.settingEl.toggleClass(
      "is-hidden",
      !tasksPluginEnabled ||
        !this.pluginSettings.editor.useCustomEmojiForTasksPlugin.value,
    );

    // Remove tags from reminder title
    this.removeTagsSetting = new Setting(containerEl)
      .setName(t("Remove tags from reminder title"))
      .setDesc(
        t(
          "If checked, tags(#xxx) are removed from the reminder list view and notification.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.editor.removeTagsForTasksPlugin.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.removeTagsForTasksPlugin.rawValue.value =
              value;
          }),
      );
    this.removeTagsSetting.settingEl.toggleClass(
      "is-hidden",
      !tasksPluginEnabled,
    );

    // Task statuses
    const taskStatusesSetting = new Setting(containerEl)
      .setName(t("Task statuses"))
      .setDesc(
        t(
          "One status per line: [symbol] -> [next symbol] TYPE, where TYPE is TODO, IN_PROGRESS, DONE, CANCELLED, ON_HOLD or NON_TASK. Decides which lines count as done (DONE/CANCELLED/NON_TASK never remind) and which symbol the Done button writes (the next symbol, when it lands on a done status). Applies to every reminder format and to the 'Toggle checklist status' command. Lines here extend the defaults (the Tasks plugin's status settings when that plugin is enabled, the built-in [ ]/[x]/[-] set otherwise) and win over them on a duplicate symbol. Leave empty to follow the defaults alone.",
        ),
      )
      .addTextArea((text) =>
        text
          .setPlaceholder(
            "[ ] -> [x] TODO\n[x] -> [ ] DONE\n[w] -> [v] ON_HOLD",
          )
          .setValue(this.pluginSettings.editor.taskStatuses.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.taskStatuses.rawValue.value = value;
            // Show unknown status types info
            const unknown = this.getUnknownStatusTypes(value);
            if (unknown.length > 0) {
              taskStatusesSetting.setDesc(
                t("Unknown status types (treated as TODO): {types}", {
                  types: unknown.join(", "),
                }),
              );
            } else {
              taskStatusesSetting.setDesc(
                t(
                  "One status per line: [symbol] -> [next symbol] TYPE, where TYPE is TODO, IN_PROGRESS, DONE, CANCELLED, ON_HOLD or NON_TASK. Decides which lines count as done (DONE/CANCELLED/NON_TASK never remind) and which symbol the Done button writes (the next symbol, when it lands on a done status). Applies to every reminder format and to the 'Toggle checklist status' command. Lines here extend the defaults (the Tasks plugin's status settings when that plugin is enabled, the built-in [ ]/[x]/[-] set otherwise) and win over them on a duplicate symbol. Leave empty to follow the defaults alone.",
                ),
              );
            }
          }),
      );

    // Dataview reminder field name
    const dataviewEnabled =
      this.pluginSettings.editor.reminderFormatSettings
        ?.enableDataviewReminderFormat.value ?? false;
    const dataviewFieldSetting = new Setting(containerEl)
      .setName(t("Reminder field name"))
      .setDesc(
        t(
          "The inline field (e.g. [reminder:: 2021-09-08]) read as the reminder date. On a line that also has a due field, this field takes precedence.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("reminder")
          .setValue(this.pluginSettings.editor.dataviewReminderFieldName.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.dataviewReminderFieldName.rawValue.value =
              value;
          }),
      );
    dataviewFieldSetting.settingEl.toggleClass("is-hidden", !dataviewEnabled);

    // Initialize dependent settings visibility
    this.updateTasksPluginDependents();
  }

  private fallbackSetting!: Setting;
  private removeTagsSetting!: Setting;
  private customEmojiSetting!: Setting;

  private updateTasksPluginDependents(): void {
    const tasksEnabled =
      this.pluginSettings.editor.reminderFormatSettings
        ?.enableTasksPluginReminderFormat.value ?? false;
    const customEmoji =
      this.pluginSettings.editor.useCustomEmojiForTasksPlugin.value;

    // Toggle dependent settings visibility
    this.customEmojiSetting.settingEl.toggleClass("is-hidden", !tasksEnabled);
    this.fallbackSetting.settingEl.toggleClass(
      "is-hidden",
      !tasksEnabled || !customEmoji,
    );
    this.removeTagsSetting.settingEl.toggleClass("is-hidden", !tasksEnabled);
  }

  private getUnknownStatusTypes(text: string): string[] {
    // This replicates the logic from the original EditorSettings
    const lines = text
      .trim()
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const unknown: string[] = [];
    const validTypes = [
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "CANCELLED",
      "ON_HOLD",
      "NON_TASK",
    ];
    for (const line of lines) {
      const match = line.match(/\[.*?\]\s*->\s*\[.*?\]\s+(\w+)/);
      if (match && !validTypes.includes(match[1])) {
        unknown.push(match[1]);
      }
    }
    return unknown;
  }

  private addReminderFormatsSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("").setHeading();

    const reminderFormatSettings =
      this.pluginSettings.editor.reminderFormatSettings;

    // Reminder plugin format
    new Setting(containerEl).setName("").setHeading();
    new Setting(containerEl)
      .setName(() =>
        t("Enable {format}", { format: t("Reminder plugin format") }),
      )
      .setDesc(t("Recognize reminders written in this format."))
      .addToggle((toggle) =>
        toggle
          .setValue(
            reminderFormatSettings?.enableReminderPluginReminderFormat.value ??
              true,
          )
          .onChange(async (value) => {
            if (reminderFormatSettings?.enableReminderPluginReminderFormat) {
              reminderFormatSettings.enableReminderPluginReminderFormat.rawValue.value =
                value;
            }
            this.updateReminderFormats();
          }),
      );

    // Tasks plugin format
    new Setting(containerEl).setName("").setHeading();
    new Setting(containerEl)
      .setName(() => t("Enable {format}", { format: t("Tasks plugin format") }))
      .setDesc(t("Recognize reminders written in this format."))
      .addToggle((toggle) =>
        toggle
          .setValue(
            reminderFormatSettings?.enableTasksPluginReminderFormat.value ??
              false,
          )
          .onChange(async (value) => {
            if (reminderFormatSettings?.enableTasksPluginReminderFormat) {
              reminderFormatSettings.enableTasksPluginReminderFormat.rawValue.value =
                value;
            }
            this.updateReminderFormats();
          }),
      );

    // Dataview format
    new Setting(containerEl).setName("").setHeading();
    new Setting(containerEl)
      .setName(() => t("Enable {format}", { format: t("Dataview format") }))
      .setDesc(t("Recognize reminders written in this format."))
      .addToggle((toggle) =>
        toggle
          .setValue(
            reminderFormatSettings?.enableDataviewReminderFormat.value ?? false,
          )
          .onChange(async (value) => {
            if (reminderFormatSettings?.enableDataviewReminderFormat) {
              reminderFormatSettings.enableDataviewReminderFormat.rawValue.value =
                value;
            }
            this.updateReminderFormats();
          }),
      );

    // Kanban plugin format
    new Setting(containerEl).setName("").setHeading();
    const kanbanFormatSetting =
      reminderFormatSettings?.enableKanbanPluginReminderFormat;
    const kanbanEnabled = kanbanFormatSetting?.value ?? false;
    new Setting(containerEl)
      .setName(() =>
        t("Enable {format}", { format: t("Kanban plugin format") }),
      )
      .setDesc(t("Recognize reminders written in this format."))
      .addToggle((toggle) =>
        toggle.setValue(kanbanEnabled).onChange(async (value) => {
          if (kanbanFormatSetting) {
            (kanbanFormatSetting.rawValue as { value: boolean }).value = value;
          }
          this.updateReminderFormats();
        }),
      );

    // Task statuses (separate group)
    new Setting(containerEl).setName("").setHeading();
    const taskStatusesSetting = new Setting(containerEl)
      .setName(t("Task statuses"))
      .setDesc(
        t(
          "One status per line: [symbol] -> [next symbol] TYPE, where TYPE is TODO, IN_PROGRESS, DONE, CANCELLED, ON_HOLD or NON_TASK. Decides which lines count as done (DONE/CANCELLED/NON_TASK never remind) and which symbol the Done button writes (the next symbol, when it lands on a done status). Applies to every reminder format and to the 'Toggle checklist status' command. Lines here extend the defaults (the Tasks plugin's status settings when that plugin is enabled, the built-in [ ]/[x]/[-] set otherwise) and win over them on a duplicate symbol. Leave empty to follow the defaults alone.",
        ),
      )
      .addTextArea((text) =>
        text
          .setPlaceholder(
            "[ ] -> [x] TODO\n[x] -> [ ] DONE\n[w] -> [v] ON_HOLD",
          )
          .setValue(this.pluginSettings.editor.taskStatuses.value)
          .onChange(async (value) => {
            this.pluginSettings.editor.taskStatuses.rawValue.value = value;
            const unknown = this.getUnknownStatusTypes(value);
            if (unknown.length > 0) {
              taskStatusesSetting.setDesc(
                t("Unknown status types (treated as TODO): {types}", {
                  types: unknown.join(", "),
                }),
              );
            }
          }),
      );
  }

  private updateReminderFormats(): void {
    const reminderFormatSettings =
      this.pluginSettings.editor.reminderFormatSettings;
    const selectedFormats: ReminderFormatType[] = [];
    const reminderPluginFormat = ReminderFormatTypes.find(
      (f) => f.name === "ReminderPluginReminderFormat",
    );
    const tasksPluginFormat = ReminderFormatTypes.find(
      (f) => f.name === "TasksPluginReminderFormat",
    );
    const dataviewFormat = ReminderFormatTypes.find(
      (f) => f.name === "DataviewReminderFormat",
    );
    const kanbanFormat = ReminderFormatTypes.find(
      (f) => f.name === "KanbanPluginReminderFormat",
    );

    if (
      reminderFormatSettings?.enableReminderPluginReminderFormat.value &&
      reminderPluginFormat
    ) {
      selectedFormats.push(reminderPluginFormat);
    }
    if (
      reminderFormatSettings?.enableTasksPluginReminderFormat.value &&
      tasksPluginFormat
    ) {
      selectedFormats.push(tasksPluginFormat);
    }
    if (
      reminderFormatSettings?.enableDataviewReminderFormat.value &&
      dataviewFormat
    ) {
      selectedFormats.push(dataviewFormat);
    }
    if (
      reminderFormatSettings?.enableKanbanPluginReminderFormat.value &&
      kanbanFormat
    ) {
      selectedFormats.push(kanbanFormat);
    }
    changeReminderFormat(selectedFormats);
  }

  private addDisplaySettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("").setHeading();

    // Language
    new Setting(containerEl)
      .setName(t("Language"))
      .setDesc(
        t(
          "Language of this plugin's own interface: settings, notices, reminder popups, the reminder list and command names. Automatic follows Obsidian's own UI language. Month and weekday names follow the selected language as well where the display formats use them.",
        ),
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("auto", t("Automatic (follow Obsidian)"));
        LANGUAGE_SETTINGS.forEach((option: LanguageSetting) => {
          dropdown.addOption(option, languageLabel(option));
        });
        dropdown
          .setValue(this.pluginSettings.display.language.value)
          .onChange(async (value) => {
            this.pluginSettings.display.language.rawValue.value = value;
            this.pluginSettings.applyLanguage();
            // Re-render the settings tab to update all translated labels
            this.display();
          });
      });

    // Year & month format
    new Setting(containerEl)
      .setName(t("Year & month format"))
      .setDesc(
        t(
          "Moment style year and month format:\nhttps://momentjs.com/docs/#/displaying/format/",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("YYYY, MMMM")
          .setValue(this.pluginSettings.display.yearMonthDisplayFormat.value)
          .onChange(async (value) => {
            this.pluginSettings.display.yearMonthDisplayFormat.rawValue.value =
              value;
          }),
      );

    // Month & day format
    new Setting(containerEl)
      .setName(t("Month & day format"))
      .setDesc(
        t(
          "Moment style month and day format:\nhttps://momentjs.com/docs/#/displaying/format/",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("MM/DD")
          .setValue(this.pluginSettings.display.monthDayDisplayFormat.value)
          .onChange(async (value) => {
            this.pluginSettings.display.monthDayDisplayFormat.rawValue.value =
              value;
          }),
      );

    // Short date with weekday format
    new Setting(containerEl)
      .setName(t("Short date with weekday format"))
      .setDesc(
        t(
          "Moment style short date with weekday format:\nhttps://momentjs.com/docs/#/displaying/format/",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("M/DD (ddd)")
          .setValue(
            this.pluginSettings.display.shortDateWithWeekdayDisplayFormat.value,
          )
          .onChange(async (value) => {
            this.pluginSettings.display.shortDateWithWeekdayDisplayFormat.rawValue.value =
              value;
          }),
      );

    // Time format
    new Setting(containerEl)
      .setName(t("Time format"))
      .setDesc(
        t(
          "Moment style time format:\nhttps://momentjs.com/docs/#/displaying/format/",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("HH:mm")
          .setValue(this.pluginSettings.display.timeDisplayFormat.value)
          .onChange(async (value) => {
            this.pluginSettings.display.timeDisplayFormat.rawValue.value =
              value;
          }),
      );

    // Week start
    new Setting(containerEl)
      .setName(t("Week start"))
      .setDesc(t("Select the first day of the week"))
      .addDropdown((dropdown) => {
        Array.from({ length: 7 }, (_, d) => {
          dropdown.addOption(d.toString(), weekdayName(d));
        });
        dropdown
          .setValue(this.pluginSettings.display.weekStart.value)
          .onChange(async (value) => {
            this.pluginSettings.display.weekStart.rawValue.value = value;
          });
      });
  }

  private addNtfySettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("").setHeading();

    // Enable ntfy
    new Setting(containerEl)
      .setName(t("Enable ntfy scheduled notifications (experimental)"))
      .setDesc(
        t(
          "Publish upcoming reminders to the ntfy server below as scheduled push notifications, so you're notified even when Obsidian isn't running (useful on mobile, where plugins can't run in the background. This sends reminder titles to that server, so only enable this if you trust it. Requires an ntfy server running v2.16.0 or later (needed for sequence-ID based scheduled message replacement/deletion). Only reminders due within the next 24 hours are registered — ntfy itself allows scheduling at most 3 days ahead, and this plugin periodically re-registers reminders to roll that 24-hour window forward.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.pluginSettings.ntfy.enabled.value)
          .onChange(async (value) => {
            this.pluginSettings.ntfy.enabled.rawValue.value = value;
          }),
      );

    // ntfy server URL
    new Setting(containerEl)
      .setName(t("ntfy server URL"))
      .setDesc(t("The ntfy server to publish scheduled notifications to."))
      .addText((text) =>
        text
          .setPlaceholder("https://ntfy.sh")
          .setValue(this.pluginSettings.ntfy.serverUrl.value)
          .onChange(async (value) => {
            this.pluginSettings.ntfy.serverUrl.rawValue.value = value;
          }),
      );

    // ntfy topic
    const topicSetting = new Setting(containerEl)
      .setName(t("ntfy topic"))
      .setDesc(
        t(
          "Topic to publish reminders to. Anyone who knows this topic name can subscribe to it and read your reminder titles, so use a long, hard-to-guess name rather than something predictable. May only contain letters, digits, dashes and underscores (1-64 characters).",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("a-long-random-topic-name")
          .setValue(this.pluginSettings.ntfy.topic.value)
          .onChange(async (value) => {
            this.pluginSettings.ntfy.topic.rawValue.value = value;
            const topic = value.trim();
            if (topic.length === 0 || isValidNtfyTopic(topic)) {
              topicSetting.setDesc(
                t(
                  "Topic to publish reminders to. Anyone who knows this topic name can subscribe to it and read your reminder titles, so use a long, hard-to-guess name rather than something predictable. May only contain letters, digits, dashes and underscores (1-64 characters).",
                ),
              );
            } else {
              topicSetting.setDesc(
                t(
                  "A topic may only contain letters, digits, dashes and underscores (1-64 characters).",
                ),
              );
            }
          }),
      );

    // ntfy access token
    const tokenSetting = new Setting(containerEl)
      .setName(t("ntfy access token"))
      .setDesc(
        t(
          "Only needed for a server that requires authentication (a self-hosted instance with access control, for example); leave it empty otherwise. Create one with `ntfy token add <user>` or from the ntfy web app under Account → Access tokens. The token needs read-write access to the topic above, because this plugin reads, publishes and deletes scheduled messages. It is stored in plain text in this plugin's data.json, which is synced along with your vault if you sync your Obsidian configuration folder.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("tk_...")
          .setValue(this.pluginSettings.ntfy.accessToken.value)
          .onChange(async (value) => {
            this.pluginSettings.ntfy.accessToken.rawValue.value = value;
          }),
      );
    // Make it a password field
    tokenSetting.components.forEach((comp) => {
      if (comp instanceof HTMLInputElement) {
        comp.type = "password";
      }
    });

    // Test button
    tokenSetting.addButton((button) =>
      button.setButtonText(t("Test")).onClick(async () => {
        const infoEl = tokenSetting.descEl.createDiv("setting-item-info");
        infoEl.setText(t("Testing…"));
        try {
          const result = await testNtfyConnection(
            async (request) => requestUrl({ ...request, throw: false }),
            {
              serverUrl: this.pluginSettings.ntfy.serverUrl.value,
              topic: this.pluginSettings.ntfy.topic.value,
              accessToken: this.pluginSettings.ntfy.accessToken.value,
            },
          );
          infoEl.setText(result.ok ? result.message : null);
          if (!result.ok) {
            tokenSetting.setDesc(result.message);
          }
        } catch (error) {
          infoEl.setText(
            error instanceof Error ? error.message : "Test failed",
          );
        }
      }),
    );
  }

  private addAdvancedSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("").setHeading();

    // Excluded files/folders
    new Setting(containerEl)
      .setName(t("Excluded files/folders"))
      .setDesc(
        t(
          "Reminders in these files/folders are ignored. One vault-relative path per line (e.g. Templates or Archive/2020).",
        ),
      )
      .addTextArea((text) =>
        text
          .setPlaceholder("Templates\nArchive/2020")
          .setValue(this.pluginSettings.advanced.excludedPaths.value.join("\n"))
          .onChange(async (value) => {
            this.pluginSettings.advanced.excludedPaths.rawValue.value = value;
          }),
      );

    // Edit detection time
    new Setting(containerEl)
      .setName(t("Edit detection time"))
      .setDesc(
        t(
          "The minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable. Only applies to the Modal popup style; Toast reminders are shown immediately even while typing.",
        ),
      )
      .addText((text) =>
        text
          .setValue(String(this.pluginSettings.advanced.editDetectionSec.value))
          .onChange(async (value) => {
            this.pluginSettings.advanced.editDetectionSec.rawValue.value =
              parseInt(value, 10);
          }),
      );

    // Reminder check interval
    new Setting(containerEl)
      .setName(t("Reminder check interval"))
      .setDesc(
        t(
          "Interval(in seconds) to periodically check whether or not you should be notified of reminders. You will need to restart Obsidian for this setting to take effect.",
        ),
      )
      .addText((text) =>
        text
          .setValue(
            String(this.pluginSettings.advanced.reminderCheckIntervalSec.value),
          )
          .onChange(async (value) => {
            this.pluginSettings.advanced.reminderCheckIntervalSec.rawValue.value =
              parseInt(value, 10);
          }),
      );
  }
}
