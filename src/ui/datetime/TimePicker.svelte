<script lang="typescript">
  import { createEventDispatcher } from "svelte";
  import { TimedInputHandler } from "./timed-input-handler";

  let { value = "00:00", step = 15 }: { value: string; step: number } = $props();
  const dispatch = createEventDispatcher<{ select: string; focus: void; blur: void }>();

  function handleSelect() {
    dispatch("select", value);
  }

  function handleFocus() {
    dispatch("focus");
  }

  function handleBlur() {
    dispatch("blur");
  }

  function generateOptions(): string[] {
    const options: string[] = [];
    for (let i = 0; i < 60 * 24; i += step) {
      const hour = Math.floor(i / 60);
      const minute = i % 60;
      options.push(
        `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      );
    }
    return options;
  }

  const options = generateOptions();

  const timedInputHandler = new TimedInputHandler();
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      const input = timedInputHandler.handle(event.key);
      switch (input.length) {
        case 1: {
          const hour = input.padStart(2, "0");
          const candidates = options.filter((o) => o.startsWith(hour));
          if (candidates.length > 1) {
            value = candidates[0];
          }
          break;
        }
        case 2: {
          const prefix = input + ":";
          const candidates = options.filter((o) => o.startsWith(prefix));
          if (candidates.length > 1) {
            value = candidates[0];
          }
          break;
        }
        case 4: {
          const time = input.slice(0, 2) + ":" + input.slice(2, 4);
          if (options.includes(time)) {
            value = time;
          }
          break;
        }
      }
      return;
    }
    timedInputHandler.clear();

    if (event.key === "Enter") {
      handleSelect();
      event.preventDefault();
      return;
    }
  }
</script>

<select
  class="time-picker"
  bind:value
  ondblclick={handleSelect}
  onfocus={handleFocus}
  onblur={handleBlur}
  onkeydown={handleKeyDown}
>
  {#each options as option (option)}
    <option value={option}>{option}</option>
  {/each}
</select>

<style>
  .time-picker {
    padding: 0 0.5rem;
  }
  select.time-picker:focus {
    box-shadow: 0 0 0px 1px var(--background-modifier-border-focus);
  }
</style>
