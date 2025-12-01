## JS Execution Mode - Functional Requirements

This document defines all functional requirements related to **client-side JavaScript execution** in Nanobrowser, including:

- The existing **Allow Code Generation** toggle (global setting)
- The new **Fast JS Mode** (JS-only execution, minimal planning for JS tasks)
- How these modes interact with the **Planner** and **Navigator** agents

---

### 1. Settings & Modes

#### 1.1 Allow Code Generation (existing)

- **Key**: `GeneralSettingsConfig.allowCodeGeneration`
- **Storage**: `@extension/storage` → `generalSettingsStore`
- **Default**: `false`
- **Controls**:
  - Whether the Navigator is allowed to use the `execute_code` action and run JavaScript in the page.
  - Whether the Navigator system prompt includes the “Code Execution” section (`NavigatorPrompt`).
- **UI Locations**:
  - Options page (`pages/options`) → General settings checkbox.
  - Side-panel header (`pages/side-panel`) → inline checkbox toggle.

**Behavior:**

- When `allowCodeGeneration === false`:
  - `execute_code` action is **not registered** in the Navigator action registry.
  - Navigator prompt **omits** the code execution instructions.
  - Any JS-related behavior must be done manually by the user (no in-page execution).
- When `allowCodeGeneration === true`:
  - `execute_code` is available to the Navigator.
  - Navigator prompt includes explicit instructions to **use `execute_code`** for page manipulation tasks.

#### 1.2 Fast JS Mode (new)

- **Key**: `GeneralSettingsConfig.fastJsMode`
- **Storage**: `@extension/storage` → `generalSettingsStore`
- **Default**: `false`
- **UI Location**:
  - Options page (`pages/options`) → General settings checkbox:
    - Label: “Fast JS Mode”
    - Description: “Skip planning and execute Navigator directly for client-side JavaScript tasks”

**Purpose:**

- For **client-side JS / DOM manipulation tasks only**, skip the Planner and let the Navigator execute directly (primarily via `execute_code`), while:
  - Keeping the full Planner → Navigator loop for **all other tasks**.
  - Still respecting `allowCodeGeneration` (Fast JS Mode has no effect if JS is globally disabled).

---

### 2. Execution Behavior Matrix

For each new task, the Executor determines how to orchestrate Planner vs Navigator based on:

- `allowCodeGeneration`
- `fastJsMode`
- Whether the task is detected as a **client-side JS task** (see §3).

#### 2.1 Non-JS Tasks

- Condition: `isClientSideJsTask(task) === false`

| allowCodeGeneration | fastJsMode | Behavior                                   |
|---------------------|-----------:|--------------------------------------------|
| false               |    false   | Normal Planner ↔ Navigator loop           |
| true                |    false   | Normal Planner ↔ Navigator loop           |
| false               |    true    | Normal Planner ↔ Navigator loop           |
| true                |    true    | Normal Planner ↔ Navigator loop           |

> **Requirement:** Fast JS Mode must **not** change behavior for non-JS tasks.

#### 2.2 Client-side JS Tasks

- Condition: `allowCodeGeneration === true && fastJsMode === true && isClientSideJsTask(task) === true`

| Mode               | Behavior                                                                 |
|--------------------|--------------------------------------------------------------------------|
| Fast JS Mode **on**  | **Skip Planner** completely for this task and run only Navigator steps |
| Fast JS Mode **off** | Normal Planner ↔ Navigator loop (even for JS tasks)                    |

**Details when Fast JS Mode is ON for a JS task:**

- During `Executor.execute()`:
  - `runPlanner()` is **never called** for that task.
  - The `for` loop still enforces `maxSteps`.
  - `navigate()` is called each step until:
    - The Navigator `done` action sets `isDone`, or
    - Max steps / cancellation / failure is reached.
- Planner-related completion logic (`checkTaskCompletion`) is bypassed for that task because Planner is never invoked.

---

### 3. JS Task Detection

#### 3.1 Detection Input

- The detection is based on the **current task string**:
  - `const currentTask = this.tasks[this.tasks.length - 1];`
  - This is the user-visible task that started the execution (e.g., the side-panel message).

#### 3.2 Heuristics (`isClientSideJsTask`)

`isClientSideJsTask(task: string): boolean` must:

- **Return true** for tasks that clearly ask for **in-page JS / DOM manipulation**, e.g.:
  - “use JS to …”
  - “run this JavaScript in the page …”
  - “change the background color to blue using JS”
  - “hide this element with JS”
  - “download first title and reactions as JSON using JavaScript”
- **Return true** when the task obviously *contains code* or asks to execute it:
  - Contains code fences (````` ``` `````), `function (`, `()=>`, or similar JS patterns.
- **Return false** for generic navigation / research / multi-step tasks that do not clearly request code execution.

Implementation may use:

- Lowercased keyword search (`javascript`, `js`, `execute code`, `run code`, `dom`, `css`, `selector`, etc.)
- Simple regexes to detect inline code (`function\s*\(`, `=>`, triple backticks).

> **Requirement:** Detection must be conservative enough to avoid turning off planning for complex non-JS tasks.

---

### 4. Executor Behavior (Code-Level Requirements)

#### 4.1 Inputs

- `generalSettings` is passed into `Executor` (from `chrome-extension/src/background/index.ts`):
  - Must now contain `allowCodeGeneration` and `fastJsMode`.

#### 4.2 New Internal Flags

Inside `Executor.execute()`:

- Compute per-task flags **before** the step loop:

```ts
const currentTask = this.tasks[this.tasks.length - 1];
const fastJsModeEnabled =
  this.generalSettings?.fastJsMode === true &&
  this.generalSettings?.allowCodeGeneration === true;
const jsOnlyForThisTask =
  fastJsModeEnabled && this.isClientSideJsTask(currentTask);
```

#### 4.3 Planner Invocation Logic

- Existing logic (simplified):

```ts
if (this.planner && (context.nSteps % context.options.planningInterval === 0 || navigatorDone)) {
  navigatorDone = false;
  latestPlanOutput = await this.runPlanner();
  if (this.checkTaskCompletion(latestPlanOutput)) {
    break;
  }
}
```

- **New requirement**:
  - Wrap this call so that it **does not execute when `jsOnlyForThisTask === true`**:

```ts
const shouldRunPlanner =
  this.planner &&
  !jsOnlyForThisTask &&
  (context.nSteps % context.options.planningInterval === 0 || navigatorDone);

if (shouldRunPlanner) {
  navigatorDone = false;
  latestPlanOutput = await this.runPlanner();
  if (this.checkTaskCompletion(latestPlanOutput)) {
    break;
  }
}
```

#### 4.4 Navigator Execution Logic

- Navigator execution (`navigate()`) remains unchanged:

```ts
navigatorDone = await this.navigate();
```

- When `jsOnlyForThisTask === true`:
  - Navigator is responsible for interpreting the task and using `execute_code` where appropriate.
  - No Planner plans or validations are injected for that task.

---

### 5. UI Requirements

#### 5.1 Options Page (General Settings)

- Add a **new checkbox**:
  - Label key: `options_general_fastJsMode`
  - Description key: `options_general_fastJsMode_desc`
- Behavior:
  - Toggling the checkbox updates `generalSettings.fastJsMode` via `generalSettingsStore.updateSettings`.
  - UI must optimistically update and then sync back from storage (same pattern as existing settings).

#### 5.2 Side-Panel

- The side-panel **does not need** a separate toggle for Fast JS Mode.
- It relies on:
  - Header toggle for `allowCodeGeneration` (already implemented).
  - Fast JS Mode value loaded via `generalSettingsStore` into the background, used by the Executor.

---

### 6. Backwards Compatibility & Safety

- If `fastJsMode` is undefined (older stored settings):
  - `generalSettingsStore.getSettings()` must default it to `false`.
- If `allowCodeGeneration === false`:
  - Fast JS Mode must be effectively **disabled**, regardless of its stored value.
- Existing behaviors (planning interval, replay, etc.) must remain unchanged for non-JS tasks.

---

### 7. Summary

- **Allow Code Generation**: Master switch enabling JS execution (`execute_code`) and JS prompt section.
- **Fast JS Mode**: Optional optimization; when enabled and the task is detected as a **client-side JS task**, the Executor:
  - **Skips Planner entirely** for that task.
  - Runs Navigator directly, relying on `execute_code` and other Navigator actions.
  - Keeps full Planner behavior for all other (non-JS) tasks.


