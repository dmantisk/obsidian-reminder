<script lang="typescript">
  import { monthShortName, weekdayShortName } from "i18n";
  import { moment } from "model/moment";
  import { createEventDispatcher, onMount, Snippet } from "svelte";
  import { Calendar } from "./calendar";
  import { TimedInputHandler } from "./timed-input-handler";

  let {
    value = moment(),
    weekStart = 0,
    footer,
  }: {
    value: moment.Moment;
    weekStart: number;
    footer?: Snippet<[]>;
  } = $props();

  const dispatch = createEventDispatcher<{
    select: moment.Moment;
    focus: null;
    blur: null;
  }>();

  let calendar = $derived(
    new Calendar(moment().startOf("day"), value.startOf("day"), weekStart),
  );
  // Day names come from the plugin's own translations rather than from
  // moment, so the calendar header follows the language setting even when
  // moment has no locale data for it.
  let daysOfWeek = $derived(
    Array.from({ length: 7 }, (_, i) =>
      weekdayShortName(calendar.weekStart + i),
    ),
  );

  let table: HTMLElement;
  let footerElement: HTMLElement;
  let calendarEl: HTMLElement;

  export function focus() {
    calendarEl.focus();
  }

  function onClick(clicked: moment.Moment) {
    value = clicked;
  }
  function onDoubleClick(clicked: moment.Moment) {
    value = clicked;
    dispatchSelect();
  }
  function previousMonth() {
    value = value.add(-1, "month");
  }
  function nextMonth() {
    value = value.add(1, "month");
  }
  function dispatchSelect() {
    dispatch("select", value);
  }
  const timedInputHandler = new TimedInputHandler();
  function handleKeyDown(event: KeyboardEvent) {
      let handled = false;
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      let input = timedInputHandler.handle(event.key);
      if (input.length === 1) {
        const date = parseInt(input);
        if (date > 0) {
          value = value.set("date", date);
        }
      } else if (input.length === 2) {
        if (input.startsWith("0")) {
          input = input.slice(1);
        }
        value = value.set("date", parseInt(input));
      } else if (input.length === 4) {
        let month = input.slice(0, 2);
        let date = input.slice(2, 4);
        if (month.startsWith("0")) {
          month = month.slice(1);
        }
        if (date.startsWith("0")) {
          date = date.slice(1);
        }
        value = value.set("month", parseInt(month) - 1);
        value = value.set("date", parseInt(date));
      }
        handled = true;
    }
      if (!handled) {
        timedInputHandler.clear();
        if (event.key === "ArrowLeft" || (event.ctrlKey && event.key === "B")) {
          value = value.add(-1, "day");
          event.preventDefault();
        } else if (
          event.key === "ArrowRight" ||
          (event.ctrlKey && event.key === "F")
        ) {
          value = value.add(1, "day");
          event.preventDefault();
        } else if (
          event.key === "ArrowUp" ||
          (event.ctrlKey && event.key === "P")
        ) {
          value = value.add(-7, "day");
        } else if (
          event.key === "ArrowDown" ||
          (event.ctrlKey && event.key === "N")
        ) {
          value = value.add(7, "day");
          event.preventDefault();
        } else if (event.key === "Enter") {
          dispatchSelect();
          event.preventDefault();
        }
    }
  }

  onMount(() => {
    // Force the footer slot to be the same width as the table
    footerElement.style.width = table.clientWidth + "px";
  });
</script>

<div
  class="reminder-calendar"
  tabindex="0"
  role="grid"
  bind:this={calendarEl}
  onfocus={() => {
    dispatch("focus");
  }}
  onblur={() => {
    dispatch("blur");
  }}
  onkeydown={handleKeyDown}
>
  <div class="year-month">
    <button tabindex="-1" class="month-nav" onclick={() => previousMonth()}
      ><</button
    >
    <span class="month"
      >{monthShortName(calendar.current.monthStart.month())}</span
    >
    <span class="year">{calendar.current.monthStart.format("YYYY")}</span
    >
    <button tabindex="-1" class="month-nav" onclick={() => nextMonth()}
      >></button
    >
  </div>
  <table bind:this={table}>
    <thead>
      <tr>
        {#each daysOfWeek as day (day)}
          <th>{day}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each calendar.current.weeks as week (week.key)}
        <tr>
          {#each week.days as day (day.date.valueOf())}
            <td>
              <button
                tabindex="-1"
                class="calendar-date"
                class:is-selected={day.isToday(value)}
                class:other-month={!calendar.current.isThisMonth(day.date)}
                class:is-holiday={day.isHoliday()}
                class:is-past={day.date.isBefore(calendar.today)}
                onclick={() => onClick(day.date)}
                ondblclick={() => onDoubleClick(day.date)}
              >
                {day.date.format("D")}
              </button>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="footer" bind:this={footerElement}>
    {@render footer?.()}
  </div>
</div>

<style>
  button {
    background-color: transparent;
    box-shadow: none;
  }
  button:hover {
    box-shadow: var(--input-shadow);
  }
  .reminder-calendar {
    display: inline-block;
    padding: 0.5rem;
  }
  .reminder-calendar:focus {
    border-radius: var(--input-radius);
    box-shadow: 0 0 0px 1px var(--background-modifier-border-focus);
  }
  .reminder-calendar .year-month {
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
  }
  .reminder-calendar .month-nav {
    color: var(--text-muted);
    margin-left: 1rem;
    margin-right: 1rem;
    cursor: pointer;
  }
  .reminder-calendar .month {
    color: var(--text-muted);
  }
  .reminder-calendar .year {
    color: var(--text-accent);
  }
  .reminder-calendar th {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .reminder-calendar .calendar-date {
    text-align: center;
    min-width: 2rem;
    max-width: 2rem;
  }
  .reminder-calendar .calendar-date:hover {
    background-color: var(--background-secondary-alt);
    border-radius: var(--input-radius);
  }
  .reminder-calendar .is-selected {
    background-color: var(--text-accent) !important;
    color: var(--text-normal) !important;
    border-radius: var(--input-radius);
  }
  .reminder-calendar .other-month,
  .reminder-calendar .is-past,
  .reminder-calendar .is-holiday {
    color: var(--text-faint) !important;
  }
</style>