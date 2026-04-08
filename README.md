# V8 Coverage Source Map Drift in Vue SFC with @nuxt/ui

## Description

When `@nuxt/ui` is loaded as a Nuxt module, V8 code coverage reports a **phantom "if" branch** in Vue Single File Components (SFCs). All tests pass, every line/statement/function
is fully covered, yet `@vitest/coverage-v8` reports **50% branch coverage** because of a ghost branch mapped to a line that contains no conditional.

**The issue is caused by `@nuxt/ui`** — removing it from `nuxt.config.ts` makes coverage reporting accurate. Nuxt itself (without `@nuxt/ui`) does not exhibit this problem.

## Reproduction

```bash
pnpm install
pnpm run test:coverage
```

### Expected

All 4 tests pass. Coverage should be **100%** across all metrics since every line, branch, function, and statement is exercised.

### Actual

All 4 tests pass, but coverage reports:

```
------------|---------|----------|---------|---------|-------------------
File        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------|---------|----------|---------|---------|-------------------
 MyForm.vue |     100 |       50 |     100 |     100 | 29
------------|---------|----------|---------|---------|-------------------
ERROR: Coverage for branches (50%) does not meet global threshold (100%)
```

- **Branches: 50%** — a phantom `"if"` branch appears at line 29, but line 29 in the source is `}` (the closing brace of `triggerFormSubmit`), not an `if` statement
- The actual `if (form.value)` is on **line 26** — the branch location has drifted by **+3 lines**
- Statements, functions, and lines are all **100%** — only the branch position is wrong
- A `console.log` inside the `if` body (line 27) **prints during the test run**, proving the branch IS exercised:

```
stdout | app/components/MyForm.spec.ts > MyForm > should emit submitData when the form is submitted with valid data.
Form ref is available, submitting form...
```

## Root Cause Analysis

### It's `@nuxt/ui`, not Nuxt

Removing `@nuxt/ui` from `modules` in `nuxt.config.ts` and replacing the Nuxt UI components with plain HTML equivalents (while keeping the identical `<script setup>` logic) produces **accurate** coverage reporting — branch coverage is 100%.

### Source Map Position Drift

The source map drift manifests as a **3-line shift** for the branch position:

| Coverage data        | Reported source position | Actual source position      | Shift    |
|----------------------|--------------------------|-----------------------------|----------|
| `if` branch location | Line 29 (`}`)            | Line 26 (`if (form.value)`) | +3 lines |

### Vite Transform Pipeline

Instrumentation of the Vite plugin pipeline reveals the following transform chain for `MyForm.vue`:

| Order | Plugin                   | Enforce | Effect                                                                                              |
|-------|--------------------------|---------|-----------------------------------------------------------------------------------------------------|
| 1     | `@vitejs/plugin-vue`     | `pre`   | Compiles SFC (`<script setup>` + `<template>`) into JS with render function. Produces source map #1 |
| 2     | `vite:esbuild`           | —       | Strips TypeScript type annotations. Produces source map #2 (chained with #1)                        |
| 3     | `nuxt:imports-transform` | `post`  | Injects auto-import for `useTemplateRef` from `vue`. Produces source map #3 (chained with #2)       |

When `@nuxt/ui` is loaded, it registers additional Vite plugins (`@tailwindcss/vite`, `unplugin-vue-components`, `unplugin-auto-import`, and several `nuxt:ui:*` plugins). While **none of these plugins directly transform `MyForm.vue`** (verified by instrumentation), their presence in the plugin pipeline alters how Vite processes and chains source maps through `@ampproject/remapping`.

The result is that the final chained source map contains incorrect position data for the `triggerFormSubmit` function body, causing V8 coverage byte offsets to map the `if` branch
to the wrong source line.

### Evidence from `coverage-final.json`

With `@nuxt/ui` loaded:

```json
{
  "branchMap": {
    "0": {
      "type": "if",
      "loc": {
        "start": {
          "line": 29,
          "column": 0
        }
      }
    }
  },
  "b": {
    "0": [
      1,
      0
    ]
  }
}
```

Line 29 in source is `}` — the closing brace of `triggerFormSubmit`. The `if (form.value)` is on line 26. The branch counts `[1, 0]` indicate one path was taken and the other was
not, yet both paths are exercised in the tests (the truthy path submits the form; the falsy path is the implicit else of a single-branch `if`).

Without `@nuxt/ui`, no phantom branch is reported and coverage is 100%.

### Key Finding: `unplugin-vue-components` does NOT transform the file

Through pipeline instrumentation, I confirmed that `unplugin-vue-components` (registered by `@nuxt/ui`) does **not** actually modify `MyForm.vue` — the `_resolveComponent()` calls
remain in the final output. The only plugin that transforms the file is Nuxt's own `nuxt:imports-transform`.

However, the mere **presence** of `@nuxt/ui`'s plugins in the Vite pipeline affects the source map chaining outcome. This suggests the issue is in how Vite's `@ampproject/remapping` handles the source map chain when additional (non-transforming) plugins are registered.

## Environment

| Package                 | Version |
|-------------------------|---------|
| nuxt                    | 4.4.2   |
| @nuxt/ui                | 3.3.7   |
| vitest                  | 4.1.3   |
| @vitest/coverage-v8     | 4.1.3   |
| vue                     | 3.5.32  |
| vite                    | 7.3.2   |
| unplugin-vue-components | 30.0.0  |
| unplugin-auto-import    | 20.3.0  |

## Minimal Trigger Conditions

All of these are required simultaneously in the same SFC:

- `@nuxt/ui` module loaded in `nuxt.config.ts`
- `useTemplateRef` referencing a template element
- `defineExpose` exposing a function
- An async function with an `if` guard (e.g., `triggerFormSubmit`)
- A template using Nuxt UI components (`UForm`, `UFormField`, `UInput`)

Removing any one of `defineExpose`, `useTemplateRef`, or the async function with guard eliminates the misreported coverage.

## Related Issues

- [`unplugin-vue-components#333`](https://github.com/unplugin/unplugin-vue-components/issues/333) — "Vite plugin breaks vitest coverage report" (open since March 2022)
- [`unplugin-vue-components#219`](https://github.com/unplugin/unplugin-vue-components/issues/219) — "this plugin destroy sourcemap" (open since November 2021)
- No existing issues on `nuxt/ui` for this problem
