/**
 * Builds the Editor settings models and adds their ordered page to the tab.
 */
import { RawSerde, ReminderFormatTypeSerde } from "plugin/settings/serdes";
import { SettingContext } from "plugin/settings/setting-model";
import type { SettingModel } from "plugin/settings/setting-model";
import { SettingTabModel } from "plugin/settings/tab-model";
import { ReminderFormatType, ReminderFormatTypes } from "model/format";
import { t } from "i18n";
import { unknownStatusTypes } from "model/format/status";

export class EditorSettings {
  autoCompleteTrigger: SettingModel<string, string>;
  convertNonTaskLines: SettingModel<boolean, boolean>;
  primaryFormat: SettingModel<string, ReminderFormatType>;
  editorReminderDisplay: SettingModel<boolean, boolean>;

  dateFormat: SettingModel<string, string>;
  dateTimeFormat: SettingModel<string, string>;
  strictDateFormat: SettingModel<boolean, boolean>;
  linkDatesToDailyNotes: SettingModel<boolean, boolean>;
  useCustomEmojiForTasksPlugin: SettingModel<boolean, boolean>;
  useReminderTimeFallbackForTasksPlugin: SettingModel<boolean, boolean>;
  removeTagsForTasksPlugin: SettingModel<boolean, boolean>;
  taskStatuses: SettingModel<string, string>;
  dataviewReminderFieldName: SettingModel<string, string>;

  constructor(
    private settings: SettingTabModel,
    private reminderFormatSettings: ReminderFormatSettings,
  ) {
    this.autoCompleteTrigger = this.settings
      .newSettingBuilder()
      .key("autoCompleteTrigger")
      .name("Calendar popup trigger")
      .desc("Trigger text to show calendar popup")
      .text("(@")
      .placeHolder("(@")
      .onAnyValueChanged((context: SettingContext) => {
        const value = this.autoCompleteTrigger.value;
        context.setInfo(
          value.length === 0 ? t("Popup is disabled") : t("Popup is enabled"),
        );
      })
      .build(new RawSerde());

    this.convertNonTaskLines = this.settings
      .newSettingBuilder()
      .key("convertNonTaskLines")
      .name("Convert non-task lines when inserting a reminder")
      .desc(
        'When inserting a reminder from the calendar popup on a line that is not a task, convert the line into a task list item ("- [ ] ") automatically. When disabled, a notice is shown instead.',
      )
      .toggle(true)
      .build(new RawSerde());

    const primaryFormatBuilder = this.settings
      .newSettingBuilder()
      .key("primaryReminderFormat")
      .name("Primary reminder format")
      .desc("Reminder format for generated reminder by calendar popup")
      .dropdown(ReminderFormatTypes[0]!.name);
    ReminderFormatTypes.forEach((f) =>
      primaryFormatBuilder.addOption(
        () => `${t(f.description)} - ${f.example}`,
        f.name,
      ),
    );
    this.primaryFormat = primaryFormatBuilder.build(
      new ReminderFormatTypeSerde(),
    );

    this.editorReminderDisplay = this.settings
      .newSettingBuilder()
      .key("editorReminderDisplay")
      .name("Show reminder pills in editor")
      .desc(
        "Render each reminder's time as a clickable pill (⏰) in Live Preview. Clicking a pill opens the date/time chooser to change it. Disable to show the raw reminder text instead.",
      )
      .toggle(true)
      .build(new RawSerde());

    this.dateFormat = this.settings
      .newSettingBuilder()
      .key("dateFormat")
      .name("Date format")
      .desc(
        "moment style date format: https://momentjs.com/docs/#/displaying/format/",
      )
      .tag("re-scan")
      .text("YYYY-MM-DD")
      .placeHolder("YYYY-MM-DD")
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.strictDateFormat = this.settings
      .newSettingBuilder()
      .key("strictDateFormat")
      .name("Strict date format")
      .desc("Strictly parse the date and time")
      .tag("re-scan")
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.dateTimeFormat = this.settings
      .newSettingBuilder()
      .key("dateTimeFormat")
      .name("Date and time format")
      .desc(
        "moment() style date time format: https://momentjs.com/docs/#/displaying/format/",
      )
      .tag("re-scan")
      .text("YYYY-MM-DD HH:mm")
      .placeHolder("YYYY-MM-DD HH:mm")
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.linkDatesToDailyNotes = this.settings
      .newSettingBuilder()
      .key("linkDatesToDailyNotes")
      .name("Link dates to daily notes")
      .desc("When toggled, Dates link to daily notes.")
      .tag("re-scan")
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.useCustomEmojiForTasksPlugin = this.settings
      .newSettingBuilder()
      .key("useCustomEmojiForTasksPlugin")
      .name("Distinguish between reminder date and due date")
      .desc(
        "Use custom emoji ⏰ instead of 📅 and distinguish between reminder date/time and Tasks Plugin's due date.",
      )
      .tag("re-scan")
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableTasksPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());
    this.useReminderTimeFallbackForTasksPlugin = this.settings
      .newSettingBuilder()
      .key("useReminderTimeFallbackForTasksPlugin")
      .name("Fall back to due, scheduled, or start date")
      .desc(
        "When the reminder date (⏰) is missing, use the due date (📅), then the scheduled date (⏳), then the start date (🛫), in that order.",
      )
      .tag("re-scan")
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableTasksPluginReminderFormat.value &&
            this.useCustomEmojiForTasksPlugin.value,
        );
      })
      .build(new RawSerde());
    this.removeTagsForTasksPlugin = this.settings
      .newSettingBuilder()
      .key("removeTagsForTasksPlugin")
      .name("Remove tags from reminder title")
      .desc(
        "If checked, tags(#xxx) are removed from the reminder list view and notification.",
      )
      .tag("re-scan")
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableTasksPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.taskStatuses = this.settings
      .newSettingBuilder()
      .key("taskStatuses")
      .name("Task statuses")
      .desc(
        "One status per line: [symbol] -> [next symbol] TYPE, where TYPE is TODO, IN_PROGRESS, DONE, CANCELLED, ON_HOLD or NON_TASK. " +
          "Decides which lines count as done (DONE/CANCELLED/NON_TASK never remind) and which symbol the Done button writes (the next symbol, when it lands on a done status). " +
          "Applies to every reminder format and to the 'Toggle checklist status' command. " +
          "Lines here extend the defaults (the Tasks plugin's status settings when that plugin is enabled, the built-in [ ]/[x]/[-] set otherwise) and win over them on a duplicate symbol. " +
          "Leave empty to follow the defaults alone.",
      )
      .tag("re-scan")
      .textArea("")
      .placeHolder("[ ] -> [x] TODO\n[x] -> [ ] DONE\n[w] -> [v] ON_HOLD")
      .onAnyValueChanged((context: SettingContext) => {
        // Free text where Tasks has a dropdown: a typo like "DOME" parses
        // happily and quietly reads as TODO, so say so here. Info, not a
        // validation error — `load()` puts stored values straight into
        // `rawValue`, and an old data.json must never fail the settings tab.
        const unknown = unknownStatusTypes(this.taskStatuses.value);
        context.setInfo(
          unknown.length
            ? t("Unknown status types (treated as TODO): {types}", {
                types: unknown.join(", "),
              })
            : null,
        );
      })
      .build(new RawSerde());

    this.dataviewReminderFieldName = this.settings
      .newSettingBuilder()
      .key("dataviewReminderFieldName")
      .name("Reminder field name")
      .desc(
        "The inline field (e.g. [reminder:: 2021-09-08]) read as the reminder date. On a line that also has a due field, this field takes precedence.",
      )
      .tag("re-scan")
      .text("reminder")
      .placeHolder("reminder")
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableDataviewReminderFormat.value,
        );
      })
      .build(new RawSerde());
  }

  addToTab(): void {
    this.settings
      .newPage("Editor")
      .newGroup()
      .addSettings(
        this.autoCompleteTrigger,
        this.convertNonTaskLines,
        this.primaryFormat,
        this.editorReminderDisplay,
      );
  }
}
