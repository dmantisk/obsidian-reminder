# Phase 4 Completion — Svelte 5 Migration

You are continuing Phase 4 of the Obsidian plugin modernization project.

The objective is to finish the Svelte 5 migration correctly, eliminate the remaining Svelte 4 compatibility requirements, and ensure all migrated components work reliably.

This is a continuation of existing work, not a new migration from scratch.

## Overall objectives

Complete the following:

1. Fix the build error in `Calendar.svelte`.
2. Complete the Svelte 5 migration of `ReminderListByDate.svelte`.
3. Verify the other previously migrated Svelte components.
4. Remove `compatibility: { componentApi: 4 }` from `esbuild.config.mjs`.
5. Eliminate remaining dependencies on the Svelte 4 imperative component API.
6. Verify that the entire relevant Svelte component tree builds and behaves correctly.

Backward compatibility with Svelte 4 is NOT required.

However, preserve all existing plugin functionality, user settings, reminder data, interactions and visual behaviour.

Do not introduce unnecessary abstractions or workarounds.

---

# PART 1 — Establish the current state before editing

Do not immediately start modifying code.

First inspect:

- `package.json`
- `package-lock.json`
- `esbuild.config.mjs`
- All relevant `.svelte` files
- All TypeScript files that import or instantiate Svelte components
- Existing tests covering the affected components

Run:

```bash
git status --short
git diff --stat
```

Review the current working tree carefully.

IMPORTANT:

- Preserve all existing changes.
- Do not discard or overwrite work already performed.
- Do not run `git reset`, `git checkout --` or destructive cleanup commands.
- Do not revert previously migrated components.
- Do not use PowerShell `Set-Content` or `Out-File`.
- Use the editor or targeted patches.
- Avoid rewriting complete files when smaller changes are sufficient.

Confirm the installed Svelte version and available project scripts.

Identify the current Svelte component compilation and preprocessing configuration.

Run the existing build command and capture the complete compiler diagnostic, including:

- Error type.
- File path.
- Line and column.
- Compiler error message.
- Relevant source context.

Do not guess the cause of a compiler error from its line number alone.

---

# PART 2 — Fix Calendar.svelte

File:

`src/plugin/ui/.../Calendar.svelte`

Use the actual repository path if it differs.

The current reported problem is around line 140:

```typescript
event.preventDefault();
```

The agent previously suspected:

```typescript
let handled = false;
```

was responsible.

Do not assume this diagnosis is correct.

A normal local `let` declaration inside a JavaScript function is valid in Svelte 5. Investigate the actual compiler diagnostic and surrounding source.

## 2.1 Inspect handleKeyDown

Inspect the complete `handleKeyDown` function, including:

- Its declaration.
- Its parameter types.
- Its caller.
- Its keyboard event binding in the template.
- Its switch or conditional logic.
- Its return behaviour.
- The surrounding braces and script structure.

Verify that the event object is passed correctly.

For example, a normal Svelte 5 keyboard handler should follow this general pattern:

```typescript
function handleKeyDown(event: KeyboardEvent): void {
  let handled = false;

  switch (event.key) {
    case "Enter":
      // Existing Enter behaviour
      handled = true;
      break;

    default:
      break;
  }

  if (handled) {
    event.preventDefault();
  }
}
```

This is an illustrative pattern, not an instruction to replace the existing implementation blindly.

Preserve the original keyboard behaviour.

## 2.2 Verify Svelte 5 event binding

Check the corresponding template event handler.

Use Svelte 5 event attributes instead of legacy event directives.

For example:

```svelte
<div onkeydown={handleKeyDown}>
```

Do not use the Svelte 4 form:

```svelte
<div on:keydown={handleKeyDown}>
```

Ensure the handler receives the correct native KeyboardEvent.

Do not rely on an implicit global `event` variable.

## 2.3 Preserve calendar functionality

Verify the existing behaviour for:

- Enter key selection.
- Arrow key navigation.
- Escape key handling, if supported.
- Focus management.
- Selected date handling.
- Preventing default browser behaviour where necessary.
- Calendar navigation.
- Date selection.
- Footer snippet rendering.

Do not change keyboard interaction semantics merely to make the compiler accept the file.

## 2.4 Calendar checkpoint

After correcting the issue:

1. Compile the component.
2. Run the project's build command.
3. Confirm the exact previous compiler error is resolved.
4. Check that no new Svelte warnings were introduced.
5. Inspect the Git diff.

Do not proceed with unrelated changes if the Calendar component is still failing to compile.

---

# PART 3 — Complete ReminderListByDate.svelte migration

Find the actual file:

`ReminderListByDate.svelte`

This component still contains Svelte 4 syntax.

Migrate it completely to Svelte 5.

The reported outstanding patterns include:

- `export let`
- `afterUpdate`
- `on:dragstart`
- `on:click`
- `bind:this={titleElements[i]}`

Inspect the entire file, not just these listed occurrences.

Also inspect all its parent and child components to understand the existing prop and event relationships.

## 3.1 Migrate component properties

Replace Svelte 4:

```typescript
export let reminders;
export let selectedDate;
```

With appropriately typed Svelte 5 properties:

```typescript
let { reminders, selectedDate } = $props<Props>();
```

Use the actual types, defaults and property names from the existing implementation.

Requirements:

- Define an appropriate Props interface where useful.
- Preserve optional and required properties.
- Preserve existing default values.
- Preserve derived behaviour.
- Do not introduce unnecessary `$bindable()` declarations.
- Only use `$bindable()` when the parent genuinely needs two-way binding.

Inspect all component call sites before changing property ownership.

Do not make child components mutate props that should be owned by the parent.

Use callback props where communication from a child to its parent is needed.

## 3.2 Migrate reactivity

Replace legacy reactive behaviour with appropriate Svelte 5 runes.

Use:

- `$state()` for mutable reactive state.
- `$derived()` for computed values.
- `$effect()` for reactive side effects.
- `$effect.pre()` only when work genuinely needs to happen before DOM updates.

Do not mechanically convert every old variable into `$state`.

Determine whether each variable needs reactivity.

Avoid unnecessary effects.

Avoid effects that repeatedly update the same state they depend on, which can create reactive loops.

Keep pure calculations in `$derived` instead of `$effect`.

## 3.3 Replace afterUpdate correctly

Inspect the exact purpose of each `afterUpdate` callback.

Do not blindly replace it with `$effect`.

Determine whether the original callback is intended to:

- Access DOM elements after rendering.
- Synchronize scroll position.
- Update focus.
- Measure elements.
- Update non-reactive external state.
- React to a specific collection changing.
- Perform one-time initialization.

Choose the correct implementation.

Use `$effect()` for post-render reactive side effects.

Use `$effect.pre()` when the original behaviour needs to run before scheduled DOM updates.

Use `tick()` when code needs to wait for pending DOM updates.

Use `onMount()` for one-time initialization.

Include the appropriate cleanup functions where necessary.

The replacement must preserve the original timing and behaviour, not merely compile.

## 3.4 Migrate DOM event handlers

Replace legacy event directives:

```svelte
on:click={handler}
on:dragstart={handler}
```

With:

```svelte
onclick={handler}
ondragstart={handler}
```

Check all other event directives in the component.

Ensure:

- Handlers have appropriate TypeScript event types.
- The original event propagation behaviour remains intact.
- Required `preventDefault()` calls remain.
- Required `stopPropagation()` calls remain.
- Drag-and-drop data transfer is preserved.
- Click behaviour and selection are unchanged.

Do not automatically add event modifiers or change handler ordering.

## 3.5 Review bind:this={titleElements[i]}

Inspect the existing DOM reference collection:

```svelte
bind:this={titleElements[i]}
```

Determine exactly how the references are used.

Consider whether:

- The array should remain a plain non-reactive array.
- A `$state` collection is genuinely needed.
- A Map keyed by stable reminder or date identifiers would be more reliable.
- The implementation should use another simpler DOM-reference pattern.

Remember that `bind:this` references are only available after the relevant element has mounted.

Avoid relying on their availability before rendering.

Pay particular attention to:

- List additions.
- List removals.
- Reordering.
- Filtering.
- Date changes.
- Conditional rendering.
- Scrolling to a particular title.
- Focusing the correct element.

If the list can be reordered or items removed, prefer stable identifiers over assuming that array indices always represent the same DOM elements.

Do not introduce unnecessary state simply to hold DOM references.

## 3.6 Preserve component functionality

Verify all existing ReminderListByDate functionality, including:

- Grouping reminders by date.
- Rendering date headings.
- Expanding and collapsing sections.
- Selecting reminders.
- Dragging and dropping reminders.
- Click interactions.
- Keyboard interactions.
- Scrolling to selected reminders.
- Empty states.
- Reactive list updates.

Preserve all existing styling and visual behaviour.

## 3.7 ReminderListByDate checkpoint

After migration:

1. Confirm there are no `export let` declarations.
2. Confirm there is no `afterUpdate` usage in runes mode.
3. Confirm all DOM event handlers use Svelte 5 event attributes.
4. Confirm prop types are correct.
5. Confirm DOM references remain correctly associated with their items.
6. Compile the component.
7. Run TypeScript checking.
8. Inspect the Git diff.

Do not proceed if this component produces compilation errors.

---

# PART 4 — Verify all previously migrated Svelte components

Previously migrated components:

- TimePicker.svelte
- DateTimeChooser.svelte
- Reminder.svelte
- Calendar.svelte

Inspect each complete component.

Do not assume that successful syntax migration guarantees correct runtime behaviour.

## 4.1 Verify Svelte 5 runes

Check:

- `$props()`
- `$state()`
- `$derived()`
- `$effect()`
- `$effect.pre()`

Verify that each rune is used appropriately.

Identify accidental non-reactive state.

Identify unnecessary effects.

Check that objects and arrays use the correct reactivity model.

Remember that wrapping class instances in `$state()` does not automatically make their internal class fields reactive.

## 4.2 Verify snippets

The previous migration replaced named slots with snippet props.

Inspect:

- DateTimeChooser.svelte
- Calendar.svelte
- All parent components passing snippet content.
- All child components rendering those snippets.

Verify that:

1. Old named-slot usage is removed.
2. Snippets are passed correctly.
3. Snippet properties have appropriate TypeScript types where needed.
4. Optional snippets are handled correctly.
5. Snippet content renders at the correct location.
6. Default content remains correct.

Do not change component layout unnecessarily.

## 4.3 Verify lifecycle and cleanup

Inspect event registration, timers, observers and asynchronous operations.

Ensure that:

- Event handlers do not accumulate after component updates.
- Intervals and timers are cleared.
- Observers are disconnected.
- Subscriptions are cleaned up.
- Effects return appropriate cleanup functions.
- Component unmounting releases resources.

Avoid introducing memory leaks during migration.

---

# PART 5 — Remove Svelte 4 component API compatibility

File:

`esbuild.config.mjs`

Current configuration reportedly contains:

```javascript
compatibility: {
  componentApi: 4;
}
```

The objective is to remove this compatibility setting completely.

However, do not remove it until all old imperative component API usages have been located and migrated.

## 5.1 Search the entire repository

Search for:

- `new Component(`
- `new SomeSvelteComponent(`
- `SvelteComponent`
- `SvelteComponentTyped`
- `.$set(`
- `.$on(`
- `.$destroy(`
- Old component constructor types.
- Legacy imperative component lifecycle patterns.

Inspect both TypeScript and JavaScript call sites.

Do not restrict the search to `.svelte` files.

## 5.2 Replace old component instantiation

Where a Svelte component is manually instantiated, use the Svelte 5 imperative component API.

Use:

- `mount()` for component creation.
- `unmount()` for component destruction.
- Appropriate props and lifecycle handling.

For example, the general pattern is:

```typescript
import { mount, unmount } from "svelte";
import MyComponent from "./MyComponent.svelte";

const instance = mount(MyComponent, {
  target,
  props: {
    // component properties
  },
});

// When the component is no longer needed:
await unmount(instance);
```

Adapt this to the actual Obsidian plugin lifecycle.

Preserve:

- Target element.
- Initial props.
- Context.
- DOM placement.
- Event callbacks.
- Cleanup timing.
- Component ownership.

If the old implementation uses `$set()` to update properties, replace that behaviour with an appropriate Svelte 5 reactive props strategy.

If `$destroy()` was used for cleanup, replace it with `unmount()` and integrate cleanup into the existing Obsidian lifecycle.

If `$on()` was used for component events, use callback props.

Do not introduce `svelte/legacy` wrappers or `createClassComponent()` merely to retain the old API.

Those are migration aids, not the intended final architecture.

## 5.3 Remove compatibility configuration

Once all old API dependencies have been eliminated:

Remove:

```javascript
compatibility: {
  componentApi: 4;
}
```

Do not leave obsolete compatibility options in the build configuration.

Do not introduce other compatibility workarounds.

Inspect the final configuration and confirm the Svelte 5 compiler defaults are being used.

---

# PART 6 — Repository-wide Svelte 5 migration audit

Search all relevant project files for remaining Svelte 4 constructs.

Inspect at least:

- `export let`
- `on:click`
- `on:dragstart`
- Other `on:event` directives
- `afterUpdate`
- `beforeUpdate`
- `createEventDispatcher`
- Legacy `<slot>` usage
- Legacy `slot="..."` usage
- `let:` directives
- `$$props`
- `$$restProps`
- Legacy component instantiation
- Svelte 4 component class types
- `componentApi: 4`

Also inspect for other deprecated constructs that are relevant to the installed Svelte version.

For each match:

1. Determine whether it is actual executable legacy code.
2. Determine whether it belongs to Phase 4.
3. Migrate it if it is in scope.
4. Do not modify unrelated dependencies or third-party code.
5. Document any remaining deliberate exceptions.

The goal is to ensure that all project-owned components covered by Phase 4 use the intended Svelte 5 architecture.

A simple text search is not sufficient to establish that the migration is correct.

Use compiler diagnostics and actual call-site inspection.

---

# PART 7 — Verification and testing

After completing the implementation, inspect package.json to identify the actual available scripts.

Run the following checks where available:

```bash
npx tsc --noEmit
```

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

Also run Svelte-specific validation if the project provides it, such as:

```bash
npx svelte-check
```

Do not install new dependencies merely to run a command if an equivalent existing project script is available.

## 7.1 Build verification

Confirm:

- Every Svelte component compiles.
- No Svelte compiler errors remain.
- No errors arise from snippets.
- No errors arise from Svelte 5 prop types.
- No errors arise from old imperative component usage.
- The compatibility.componentApi option has been removed.
- The build generates the expected plugin output.
- `main.js` is still generated at the repository root if required by the release workflow.

## 7.2 Functional verification

Test or establish automated coverage for:

### Calendar

- Enter key behaviour.
- Keyboard navigation.
- Date selection.
- Focus handling.
- Footer rendering.

### ReminderListByDate

- Rendering reminders.
- Grouping.
- Expanding and collapsing.
- Clicking.
- Drag and drop.
- Scrolling and focus.
- Reactive updates when reminders change.
- Removing and reordering reminders.

### TimePicker

- Displaying the selected time.
- Updating the selected time.
- Input interactions.

### DateTimeChooser

- Date selection.
- Time selection.
- Snippet rendering.
- Parent-child communication.

### Reminder

- Rendering.
- State updates.
- User interactions.
- Component cleanup.

Do not claim manual UI tests passed unless they were actually performed inside Obsidian.

If Obsidian is unavailable, document the manual acceptance tests that still need to be performed.

## 7.3 Warnings

Inspect all Svelte warnings.

Do not automatically ignore them.

Distinguish:

- Existing unrelated warnings.
- Warnings introduced by this migration.
- Deprecated syntax still requiring migration.
- Harmless warnings that are genuinely unavoidable.

Fix newly introduced warnings and migration-related warnings.

Do not suppress warnings just to make the build output clean.

---

# PART 8 — Code quality and final review

Review the entire Git diff.

Check for:

- Unnecessary `$state()` usage.
- Unnecessary `$effect()` usage.
- Reactive loops.
- Incorrect `$derived()` logic.
- Duplicate event handlers.
- Missing cleanup.
- Unnecessary wrapper functions.
- Unnecessary compatibility abstractions.
- Incorrect event typing.
- Prop mutation.
- Incorrect snippet typing.
- Broken focus or scrolling behaviour.
- Unstable DOM reference associations.
- Unintended visual changes.
- Accidental encoding changes.

Keep the implementation straightforward.

Do not add abstractions solely to make the migration look more sophisticated.

Prefer idiomatic Svelte 5 and normal TypeScript.

Do not use Svelte 4 compatibility APIs.

Do not change unrelated business logic.

---

# PART 9 — Final report

Provide a detailed completion report.

Include:

## A. Files changed

List each modified file and the reason for the change.

## B. Calendar.svelte

Explain:

- The actual cause of the compiler error.
- The correction implemented.
- Whether keyboard behaviour was preserved.

## C. ReminderListByDate.svelte

Explain:

- How props were migrated.
- How afterUpdate was replaced.
- How event handlers were migrated.
- How DOM references were handled.
- How drag-and-drop functionality was preserved.

## D. Other components

Report the final migration status of:

- TimePicker.svelte
- DateTimeChooser.svelte
- Reminder.svelte
- Calendar.svelte
- ReminderListByDate.svelte

## E. Svelte 4 compatibility

Confirm:

- `compatibility.componentApi: 4` removed.
- Old imperative component API usages eliminated.
- Svelte 4 event syntax removed from the migrated project-owned components.
- No unnecessary `svelte/legacy` compatibility wrappers introduced.

## F. Verification table

| Check               | Result      |
| ------------------- | ----------- |
| TypeScript          | PASS / FAIL |
| Svelte compilation  | PASS / FAIL |
| Tests               | PASS / FAIL |
| ESLint              | PASS / FAIL |
| Build               | PASS / FAIL |
| Root main.js output | PASS / FAIL |
| Legacy syntax audit | PASS / FAIL |

For each result, give the actual command and its exit status.

Distinguish pre-existing unrelated problems from new problems.

## G. Remaining work

List:

- Outstanding errors.
- Outstanding warnings.
- Manual Obsidian tests still required.
- Any remaining migration exceptions.
- Any unresolved risks.

## H. Final assessment

State whether Phase 4 is:

- COMPLETE
- PARTIALLY COMPLETE
- BLOCKED

Do not claim Phase 4 is complete until the relevant components compile, the old compatibility setting is removed, all in-scope migration requirements are satisfied, and the available verification checks have been completed.

Do not create a Git commit.

Do not reset the repository.

Preserve all user changes.
