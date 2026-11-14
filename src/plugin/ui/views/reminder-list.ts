import { t } from "i18n";
import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { MarkdownRenderer } from "obsidian";
import type ReminderPlugin from "main";
import { Reminder } from "model/reminder";
import { GroupedReminder, groupReminders } from "model/reminder-grouping";
import { VIEW_TYPE_REMINDER_LIST } from "plugin/ui/constants";

class ReminderListView extends ItemView {
  private unsubscribeFormats: (() => void)[] = [];

  constructor(
    private plugin: ReminderPlugin,
    leaf: WorkspaceLeaf,
    private onOpenReminder: (reminder: Reminder) => void,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_REMINDER_LIST;
  }

  getDisplayText(): string {
    return t("Reminders");
  }

  override getIcon(): string {
    return "clock";
  }

  override async onOpen(): Promise<void> {
    this.render();

    // Subscribe to display format changes
    const formats = [
      this.plugin.settings.display.yearMonthDisplayFormat,
      this.plugin.settings.display.monthDayDisplayFormat,
      this.plugin.settings.display.shortDateWithWeekdayDisplayFormat,
      this.plugin.settings.display.timeDisplayFormat,
    ];
    this.unsubscribeFormats = formats.map((fmt) =>
      fmt.rawValue.onChanged(() => this.render()),
    );
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("reminder-list-view");

    const groups = this.remindersForView();

    for (const group of groups) {
      const groupEl = contentEl.createDiv("reminder-group");

      const headerEl = groupEl.createDiv("group-header");
      headerEl.createSpan({
        text: group.name,
        cls: "group-name" + (group.isOverdue ? " group-name-overdue" : ""),
      });
      if (group.reminders.length > 0) {
        headerEl.createSpan({
          text: String(group.reminders.length),
          cls: "group-count",
        });
      }

      const listEl = groupEl.createDiv("reminder-list");
      for (const reminder of group.reminders) {
        const itemEl = listEl.createEl("button", {
          cls: "reminder-list-item hover-highlight",
        });
        itemEl.setAttribute("aria-label", this.tooltip(reminder));
        itemEl.setAttribute("draggable", "true");

        itemEl.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData("text/plain", this.generateLink(reminder));
        });
        itemEl.addEventListener("click", () => {
          this.onOpenReminder(reminder);
        });

        itemEl.createSpan({
          cls: "reminder-time",
          text: group.timeToString(reminder.effectiveTime),
        });

        const titleContainer = itemEl.createDiv("reminder-title-container");
        if (reminder.source === "tasknotes") {
          titleContainer.createSpan({
            cls: "reminder-source",
            text: "TN",
            attr: { title: t("TaskNotes") },
          });
        }
        const titleEl = titleContainer.createSpan({ cls: "reminder-title" });
        // Render markdown title
        void MarkdownRenderer.render(
          this.plugin.app,
          this.displayTitle(reminder),
          titleEl,
          reminder.file,
          this,
        );

        if (reminder.source === "markdown") {
          titleContainer.createSpan({
            cls: "reminder-file",
            text: reminder.getFileName(),
          });
        }
      }
    }
  }

  private displayTitle(reminder: Reminder): string {
    return reminder.source === "tasknotes"
      ? reminder.tasknotes?.taskTitle || reminder.getFileName()
      : reminder.title;
  }

  private tooltip(reminder: Reminder): string {
    const source =
      reminder.source === "tasknotes" ? `${t("TaskNotes")} - ` : "";
    return `[${reminder.effectiveTime.toString()}] ${this.displayTitle(reminder)} - ${source}${reminder.getFileName()}`;
  }

  private generateLink(reminder: Reminder): string {
    const aFile = this.app.vault.getAbstractFileByPath(reminder.file);
    const destinationFile = this.app.workspace.getActiveFile();
    let linkMd: string;
    if (!(aFile instanceof TFile) || destinationFile == null) {
      linkMd = `[[${reminder.getFileName()}]]`;
    } else {
      linkMd = this.app.fileManager.generateMarkdownLink(
        aFile,
        destinationFile.path,
      );
    }
    const title = this.displayTitle(reminder);
    return `${title} - ${linkMd}`;
  }

  private remindersForView(): GroupedReminder[] {
    return groupReminders(
      this.plugin.reminders.reminders,
      this.plugin.settings.notifications.reminderTime.value,
      {
        yearMonthFormat:
          this.plugin.settings.display.yearMonthDisplayFormat.value,
        monthDayFormat:
          this.plugin.settings.display.monthDayDisplayFormat.value,
        shortDateWithWeekdayFormat:
          this.plugin.settings.display.shortDateWithWeekdayDisplayFormat.value,
        timeFormat: this.plugin.settings.display.timeDisplayFormat.value,
      },
    );
  }

  override onClose(): Promise<void> {
    this.unsubscribeFormats.forEach((unsub) => unsub());
    this.unsubscribeFormats = [];
    return Promise.resolve();
  }
}

/**
 * Register the reminder list view using Obsidian's DeferredView (1.13+).
 * This provides lazy loading without a custom proxy class.
 */
export function registerReminderListView(
  plugin: ReminderPlugin,
  onOpenReminder: (reminder: Reminder) => void,
): void {
  plugin.registerView(
    VIEW_TYPE_REMINDER_LIST,
    (leaf: WorkspaceLeaf) => new ReminderListView(plugin, leaf, onOpenReminder),
  );
}

/**
 * Opens the reminder list view, creating it if necessary.
 */
export function openReminderListView(plugin: ReminderPlugin): void {
  const workspace = plugin.app.workspace;
  if (workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST).length) {
    return;
  }
  void workspace.getRightLeaf(false)?.setViewState({
    type: VIEW_TYPE_REMINDER_LIST,
  });
}

/**
 * Reveals the reminder list view if it exists.
 */
export function revealReminderListView(plugin: ReminderPlugin): Promise<void> {
  const workspace = plugin.app.workspace;
  const leaf = workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST)[0];
  if (leaf == null) {
    return Promise.resolve();
  }
  return workspace.revealLeaf(leaf);
}
