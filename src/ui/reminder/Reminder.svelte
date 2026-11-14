<script lang="typescript">
  import { onMount, tick } from "svelte";
  import { t } from "i18n";
  import { MarkdownRenderer } from "obsidian";
  import type { Reminder } from "model/reminder";
  import type { DateTime, Later } from "model/time";
  import { createIconText } from "ui/common/icon-text";

  let {
    reminder,
    onRemindMeLater,
    onDone,
    onOpenFile,
    onMute,
    onPauseAllNotifications,
    onMuteAll,
    variant = "modal",
    onClose,
    focusDone = false,
    shortcutsEnabled = true,
    laters = [],
  }: {
    reminder: Reminder;
    onRemindMeLater: (time: DateTime) => void;
    onDone: () => void;
    onOpenFile: () => void;
    onMute: () => void;
    onPauseAllNotifications: () => void;
    onMuteAll: () => void;
    variant?: "modal" | "toast";
    onClose?: () => void;
    focusDone?: boolean;
    shortcutsEnabled?: boolean;
    laters?: Array<Later>;
  } = $props();

  let selectedIndex = $state<number>();
  let doneButton = $state<HTMLButtonElement>();
  let laterSelect = $state<HTMLSelectElement>();
  let containerEl = $state<HTMLElement>();
  let titleEl = $state<HTMLElement>();
  let taskTitleEl = $state<HTMLElement>();
  let taskDescEl = $state<HTMLElement>();
  let fileIconEl = $state<HTMLElement>();
  let doneIconEl = $state<HTMLElement>();
  let muteIconEl = $state<HTMLElement>();

  // Translated labels. The keyboard mnemonics below refer to the English
  // letter (Alt+D / Alt+M / Alt+S), so the underlined letter is only shown
  // when the label still starts with it; a translation into a language
  // without that chord renders the plain label.
  let isTaskNotes = $derived(reminder.source === "tasknotes");
  let doneLabel = $derived(t(isTaskNotes ? "Open" : "Done"));
  let muteLabel = $derived(t("Mute"));
  let showDoneMnemonic = $derived(doneLabel.toUpperCase().startsWith("D"));
  let showMuteMnemonic = $derived(muteLabel.toUpperCase().startsWith("M"));

  function remindMeLater() {
    const selected = laters[selectedIndex];
    if (selected == null) {
      return;
    }
    onRemindMeLater(selected.later());
  }

  // Alt (Option on macOS) or Ctrl mnemonic shortcuts, matched on `evt.code`
  // (not `evt.key`) because macOS Option+letter produces symbol characters
  // (e.g. Option+D -> "∂"), while `evt.code` stays the physical key ("KeyD").
  // Ctrl is the fallback for environments where OS-level tools (window
  // managers, launchers) intercept Option/Alt chords before they reach
  // Obsidian -- common on macOS, where Ctrl+letter is nearly always free.
  function handleKeydown(evt: KeyboardEvent) {
    if (!shortcutsEnabled) {
      // See the `shortcutsEnabled` prop doc: only the most recently shown
      // toast has this true. Older toasts fall back to mouse/touch only.
      return;
    }
    const alt = evt.altKey && !evt.ctrlKey;
    const ctrl = evt.ctrlKey && !evt.altKey;
    if ((!alt && !ctrl) || evt.metaKey || evt.shiftKey) {
      return;
    }
    switch (evt.code) {
      case "KeyD":
        evt.preventDefault();
        evt.stopPropagation();
        onDone();
        break;
      case "KeyM":
        evt.preventDefault();
        evt.stopPropagation();
        onMute();
        break;
      case "KeyO":
        evt.preventDefault();
        evt.stopPropagation();
        onOpenFile();
        break;
      case "KeyS":
        evt.preventDefault();
        evt.stopPropagation();
        laterSelect.focus();
        break;
    }
  }

  onMount(async () => {
    if (variant === "toast") {
      // Toasts are non-intrusive corner cards: never steal focus from
      // whatever the user is doing, unlike the modal below.
      return;
    }
    await tick();
    if (focusDone) {
      doneButton.focus();
    } else {
      // Without an explicit focus target, Obsidian's Modal focuses the first
      // focusable element in the modal (the file-name button), so a stray
      // Enter would open the note. Focusing the inert container instead makes
      // a stray Enter a no-op, while Tab still reaches the buttons.
      containerEl.focus();
    }
  });

  // Render markdown content and icons after each update
    $effect(() => {
    // Render title markdown
    if (titleEl) {
      titleEl.empty();
      MarkdownRenderer.renderMarkdown(
        reminder.title,
        titleEl,
        reminder.file,
        window.app.plugins.plugins["obsidian-reminder-plugin"],
      );
      titleEl.childNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          n.style.display = "inline";
        }
      });
    }

    // Render tasknotes title markdown
    if (taskTitleEl && reminder.tasknotes?.taskTitle) {
      taskTitleEl.empty();
      MarkdownRenderer.renderMarkdown(
        reminder.tasknotes.taskTitle,
        taskTitleEl,
        reminder.file,
        window.app.plugins.plugins["obsidian-reminder-plugin"],
      );
      taskTitleEl.childNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          n.style.display = "inline";
        }
      });
    }

    // Render tasknotes description markdown
    if (taskDescEl && reminder.tasknotes?.description) {
      taskDescEl.empty();
      MarkdownRenderer.renderMarkdown(
        reminder.tasknotes.description,
        taskDescEl,
        reminder.file,
        window.app.plugins.plugins["obsidian-reminder-plugin"],
      );
      taskDescEl.childNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          n.style.display = "inline";
        }
      });
    }

    // Create icon-text elements
    if (fileIconEl) {
      createIconText(fileIconEl, "link", reminder.file);
    }
    if (doneIconEl) {
      createIconText(doneIconEl, "check-small", "");
    }
    if (muteIconEl) {
      createIconText(muteIconEl, "minus-with-circle", "");
    }
  });
</script>

<!-- Capture phase so the shortcuts run before Obsidian's own keymap/hotkey
handlers (e.g. Ctrl+O would otherwise also trigger the quick switcher).
`<svelte:window>` can't be placed inside an `{#if}` block, so disabled
instances (older toasts; see `shortcutsEnabled`) are excluded inside
`handleKeydown` itself instead. -->
<svelte:window onkeydown|capture={handleKeydown} />

<main bind:this={containerEl} tabindex="-1" class:toast={variant === "toast"}>
  {#if variant === "toast"}
    <button
      class="reminder-toast-close"
      onclick={onClose}
      aria-label={t("Close")}
    >
      ×
    </button>
  {/if}
  {#if reminder.source === "tasknotes" && reminder.tasknotes}
    <div class="tasknotes-details">
      <h3 class="reminder-title" aria-label={reminder.tasknotes.taskTitle}>
        <span class="reminder-markdown" bind:this={taskTitleEl}></span>
      </h3>
      {#if reminder.tasknotes.description}
        <div class="tasknotes-description">
          <span class="reminder-markdown" bind:this={taskDescEl}></span>
        </div>
      {/if}
      <div class="tasknotes-anchor">
        {t("TaskNotes")} · {t(
          reminder.tasknotes.anchor.type === "due"
            ? "Due date"
            : reminder.tasknotes.anchor.type === "scheduled"
              ? "Scheduled date"
              : "Absolute time",
        )}: {reminder.tasknotes.anchor.time.toString()}
      </div>
    </div>
  {:else}
    <h3 class="reminder-title" aria-label={reminder.title}>
      <span class="reminder-markdown" bind:this={titleEl}></span>
    </h3>
  {/if}
  <button
    class="reminder-file"
    onclick={onOpenFile}
    aria-label={`${reminder.file} (Alt+O / Ctrl+O)`}
    aria-keyshortcuts="Alt+O Control+O"
  >
    <span class="icon-text" bind:this={fileIconEl}></span>
  </button>
  <div class="reminder-actions">
    <button
      class="mod-cta"
      onclick={onDone}
      bind:this={doneButton}
      title="Alt+D / Ctrl+D"
      aria-keyshortcuts="Alt+D Control+D"
    >
      <span class="icon-text" bind:this={doneIconEl}></span><span
        >{#if showDoneMnemonic}<span class="mnemonic">D</span>{doneLabel.slice(
            1,
          )}{:else}{doneLabel}{/if}</span
      >
    </button>
    <button
      onclick={onMute}
      title="Alt+M / Ctrl+M"
      aria-keyshortcuts="Alt+M Control+M"
    >
      <span class="icon-text" bind:this={muteIconEl}></span><span
        >{#if showMuteMnemonic}<span class="mnemonic">M</span>{muteLabel.slice(
            1,
          )}{:else}{muteLabel}{/if}</span
      >
    </button>
    <select
      class="dropdown later-select"
      bind:value={selectedIndex}
      bind:this={laterSelect}
      onchange={remindMeLater}
      title="Alt+S / Ctrl+S"
      aria-keyshortcuts="Alt+S Control+S"
    >
      <!-- placeholder -->
      <option selected disabled hidden>{t("Snooze")}</option>
      <!-- options -->
      {#each laters as later, i (i)}
        <option value={i} selected={selectedIndex === i}>{later.label}</option>
      {/each}
    </select>
  </div>
  {#if variant === "modal"}
    <div class="reminder-secondary-actions">
      <button
        class="reminder-footer-action"
        onclick={onPauseAllNotifications}
        title={t(
          "Pause all notifications for a chosen duration. Reminders are not muted: anything still overdue notifies you again after the pause ends.",
        )}
      >
        {t("Pause all notifications…")}
      </button>
      <button
        class="reminder-footer-action"
        onclick={onMuteAll}
        title={t(
          "Mute every currently overdue reminder. Muted reminders stay silent (even across restarts) until you snooze them or change their date.",
        )}
      >
        {t("Mute all reminders…")}
      </button>
    </div>
  {/if}
</main>

<style>
  main:focus {
    outline: none;
  }

  .reminder-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .reminder-title {
    margin: 0.3rem 0;
  }
  .tasknotes-details {
    margin-bottom: 0.5rem;
  }
  .tasknotes-description {
    margin: -0.5rem 0 0.5rem;
    color: var(--text-normal);
  }
  .tasknotes-anchor {
    color: var(--text-muted);
    font-size: var(--font-smaller);
  }

  .reminder-file {
    color: var(--text-muted);
    cursor: pointer;
    background-color: transparent;
    text-decoration: underline;
    box-shadow: none;
  }

  .reminder-file:hover {
    color: var(--text-normal);
    text-decoration: underline;
  }

  .later-select {
    font-size: 14px;
  }

  .reminder-secondary-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .reminder-footer-action {
    display: block;
    margin-top: 0.75rem;
    padding: 0;
    color: var(--text-faint);
    cursor: pointer;
    background-color: transparent;
    border: none;
    text-decoration: underline;
    box-shadow: none;
    font-size: 12px;
  }

  .reminder-footer-action:hover {
    color: var(--text-muted);
  }

  .mnemonic {
    text-decoration: underline;
  }

  main.toast {
    position: relative;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 8px);
    box-shadow: var(--shadow-s);
    padding: 12px 14px;
  }

  main.toast .reminder-title {
    margin: 0 1.5rem 0.3rem 0;
    font-size: 0.95rem;
  }

  main.toast .reminder-actions {
    margin-top: 0.4rem;
    gap: 0.4rem;
  }

  main.toast .reminder-actions button,
  main.toast .later-select {
    font-size: var(--font-ui-small);
  }

  main.toast .reminder-actions button {
    padding: 2px 10px;
  }

  main.toast .reminder-file {
    display: block;
    width: 100%;
    text-align: left;
    text-decoration: none;
  }

  main.toast .reminder-file:hover {
    text-decoration: underline;
  }

  main.toast .reminder-file :global(.icon-text) {
    display: flex;
    width: 100%;
  }

  main.toast .reminder-file :global(.icon) {
    flex-shrink: 0;
  }

  main.toast .reminder-file :global(.text) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reminder-toast-close {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 0;
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    color: var(--text-muted);
    background-color: transparent;
    border: none;
    box-shadow: none;
    cursor: pointer;
    font-size: 16px;
  }

  .reminder-toast-close:hover {
    color: var(--text-normal);
  }
</style>