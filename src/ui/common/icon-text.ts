import { setIcon } from "obsidian";

/**
 * Creates an icon + text element pair.
 * Replaces the IconText.svelte component with a vanilla TS helper.
 */
export function createIconText(
  container: HTMLElement,
  icon: string,
  text: string,
): HTMLElement {
  const wrapper = container.createSpan({ cls: "icon-text" });
  const iconEl = wrapper.createSpan({ cls: "icon" });
  setIcon(iconEl, icon);
  wrapper.createSpan({ cls: "text", text });
  return wrapper;
}
