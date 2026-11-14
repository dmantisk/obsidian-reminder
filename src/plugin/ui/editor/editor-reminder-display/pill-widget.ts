import { t } from "i18n";
import { setIcon } from "obsidian";
import type ReminderPlugin from "main";
import { EditorView, WidgetType } from "@codemirror/view";
import { openChooserAndApplyEdit } from "./edit-reminder";
import type { ReminderLocation } from "./edit-reminder";
import type { ReminderPillSpan } from "./types";

/** Renders a single reminder's time text as a clickable "⏰ <time>" pill. */
export class ReminderPillWidget extends WidgetType {
  /**
   * The tooltip as rendered, captured when the widget is built.
   *
   * It is part of `eq()` because it is the only rendered text that follows the
   * language: after a language change the span text and the reminder are
   * unchanged, so without comparing the tooltip CodeMirror would keep the old
   * DOM (and the old language) until the line itself changed.
   */
  private readonly title: string;

  constructor(
    private readonly span: ReminderPillSpan,
    private readonly plugin: ReminderPlugin,
  ) {
    super();
    this.title = t("Reminder: {title}", { title: span.reminder.title });
  }

  override eq(other: ReminderPillWidget): boolean {
    // Compare content only, not positions: the click flow re-resolves the
    // reminder from the widget's current DOM position, so correctness never
    // depends on the captured span. Ignoring positions lets CodeMirror keep
    // the DOM of every pill below an unrelated edit instead of tearing it
    // down and rebuilding it on each decoration rebuild.
    return (
      this.span.text === other.span.text &&
      this.span.reminder.title === other.span.reminder.title &&
      this.title === other.title
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const container = createSpan({ cls: "reminder-pill" });
    container.setAttribute("role", "button");
    container.setAttribute("tabindex", "0");
    container.setAttribute("title", this.title);

    const icon = container.createSpan({ cls: "icon" });
    setIcon(icon, "clock");
    container.createSpan({
      cls: "text",
      text: this.span.reminder.time.toString(),
    });

    const activate = () => {
      void this.activate(view, container);
    };

    container.addEventListener("click", activate);
    container.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        activate();
      }
    });
    container.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    });

    return container;
  }

  override destroy(dom: HTMLElement): void {
    // No Svelte component to destroy
  }

  override ignoreEvent(): boolean {
    return false;
  }

  private async activate(
    view: EditorView,
    container: HTMLElement,
  ): Promise<void> {
    try {
      await openChooserAndApplyEdit(view, this.plugin, () =>
        locatePill(view, container),
      );
    } catch {
      // The chooser was cancelled (or a genuine failure occurred); either
      // way there's nothing to recover, leave the document untouched.
    }
  }
}

/**
 * Reads the pill's line straight off its own DOM position, which — unlike the
 * span captured when the decoration was built — is always current.
 */
function locatePill(
  view: EditorView,
  container: HTMLElement,
): ReminderLocation | null {
  if (!view.dom.contains(container)) {
    // The widget was removed while e.g. the chooser modal was open;
    // posAtDOM() would throw on a detached node.
    return null;
  }
  const pos = view.posAtDOM(container);
  return { lineNumber: view.state.doc.lineAt(pos).number, preferPos: pos };
}
